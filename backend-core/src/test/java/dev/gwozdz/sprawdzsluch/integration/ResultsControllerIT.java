package dev.gwozdz.sprawdzsluch.integration;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import dev.gwozdz.sprawdzsluch.entity.TestResult;
import dev.gwozdz.sprawdzsluch.repository.TestResultRepository;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("integration-test")
@DisplayName("[IT] ResultsController")
class ResultsControllerIT {

    @Container
    @ServiceConnection
    static final MongoDBContainer MONGODB = new MongoDBContainer("mongo:7.0");

    // WireMock jako zamiennik backend-payments
    static WireMockServer wireMockPayments;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        wireMockPayments = new WireMockServer(wireMockConfig().dynamicPort());
        wireMockPayments.start();
        registry.add("services.payments.url", wireMockPayments::baseUrl);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private TestResultRepository testResultRepository;

    @BeforeEach
    void setUp() {
        testResultRepository.deleteAll();
        wireMockPayments.resetAll();
        // domyślny stub — payments przyjmuje wszystko
        wireMockPayments.stubFor(
                post(urlEqualTo("/api/payments/process"))
                        .willReturn(aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"success\":true}"))
        );
    }

    @AfterEach
    void tearDown() {
        testResultRepository.deleteAll();
    }

    // --- helper ---

    private Map<String, Object> buildValidPayload(String email) {
        return Map.of(
                "userEmail", email,
                "maxAudibleFrequency", 12000,
                "hearingLevels", Map.of("1000", -5.0, "2000", 0.0, "4000", 10.0),
                "paymentMethod", "VOUCHER",
                "voucherCode", "REKRUTACJA"
        );
    }

    @Nested
    @DisplayName("POST /api/results/submit")
    class SubmitEndpoint {

        @Test
        @DisplayName("prawidłowe dane → 200, testId w odpowiedzi, zapis w MongoDB")
        void validPayload_returns200_savesToMongo() {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    "/api/results/submit", buildValidPayload("save-test@example.com"), Map.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

            Map<?, ?> body = response.getBody();
            assertThat(body).isNotNull();
            assertThat(body.get("success")).isEqualTo(true);
            assertThat(body.get("testId")).asString().startsWith("TEST-");

            String testId = (String) body.get("testId");

            // weryfikacja MongoDB
            Optional<TestResult> saved = testResultRepository.findByTestId(testId);
            assertThat(saved).isPresent();
            assertThat(saved.get().getUserEmail()).isEqualTo("save-test@example.com");
            assertThat(saved.get().getMaxAudibleFrequency()).isEqualTo(12000);
            assertThat(saved.get().getStatus()).isEqualTo("NEW");
        }

        @Test
        @DisplayName("prawidłowe dane → backend-payments zostaje powiadomiony (async)")
        void validPayload_notifiesPaymentsService() {
            restTemplate.postForEntity("/api/results/submit", buildValidPayload("notify-test@example.com"), Map.class);

            // WebClient.subscribe() jest fire-and-forget — czekamy z Awaitility
            // matchujemy po e-mailu tego konkretnego testu, aby uniknąć false-positive z poprzednich testów
            Awaitility.await()
                    .atMost(Duration.ofSeconds(5))
                    .untilAsserted(() ->
                            wireMockPayments.verify(
                                    postRequestedFor(urlEqualTo("/api/payments/process"))
                                            .withRequestBody(containing("notify-test@example.com")))
                    );
        }

        @Test
        @DisplayName("nieprawidłowy e-mail → 400")
        void invalidEmail_returns400() {
            Map<String, Object> payload = Map.of(
                    "userEmail", "to-nie-email",
                    "maxAudibleFrequency", 8000,
                    "hearingLevels", Map.of("1000", 0.0),
                    "paymentMethod", "VOUCHER",
                    "voucherCode", "REKRUTACJA"
            );

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    "/api/results/submit", payload, Map.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).containsKey("error");

            // nic nie powinno trafić do MongoDB ani payments
            assertThat(testResultRepository.count()).isZero();
            wireMockPayments.verify(0, postRequestedFor(anyUrl()));
        }

        @Test
        @DisplayName("maxAudibleFrequency < 1000 → 400")
        void lowFrequency_returns400() {
            Map<String, Object> payload = Map.of(
                    "userEmail", "test@example.com",
                    "maxAudibleFrequency", 500,
                    "hearingLevels", Map.of("500", 0.0),
                    "paymentMethod", "VOUCHER",
                    "voucherCode", "REKRUTACJA"
            );

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    "/api/results/submit", payload, Map.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(testResultRepository.count()).isZero();
        }

        @Test
        @DisplayName("identyczne dane wysłane dwa razy → idempotentna odpowiedź, 1 rekord w DB")
        void samePayloadTwice_idempotentResponse_singleRecordInDb() {
            Map<String, Object> payload = buildValidPayload("idem@example.com");

            ResponseEntity<Map> first = restTemplate.postForEntity(
                    "/api/results/submit", payload, Map.class);
            ResponseEntity<Map> second = restTemplate.postForEntity(
                    "/api/results/submit", payload, Map.class);

            assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);

            // ten sam testId
            assertThat(first.getBody().get("testId"))
                    .isEqualTo(second.getBody().get("testId"));

            // tylko jeden rekord w bazie
            assertThat(testResultRepository.count()).isOne();
        }
    }

    @Nested
    @DisplayName("GET /api/results/status/{testId}")
    class StatusEndpoint {

        @Test
        @DisplayName("nieznany testId → 404")
        void unknownTestId_returns404() {
            ResponseEntity<Object> response = restTemplate.getForEntity(
                    "/api/results/status/NONEXISTENT-TEST", Object.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("GET /api/results/status (wszystkie statusy)")
    class AllStatusesEndpoint {

        @Test
        @DisplayName("pusty serwis → zwraca count=0")
        void emptyDb_returnsCountZero() {
            ResponseEntity<Map> response = restTemplate.getForEntity(
                    "/api/results/status", Map.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().get("count")).isEqualTo(0);
        }
    }
}
