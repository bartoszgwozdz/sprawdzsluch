package dev.gwozdz.sprawdzsluch.payments.integration;

import com.github.tomakehurst.wiremock.WireMockServer;
import dev.gwozdz.sprawdzsluch.payments.model.Payment;
import dev.gwozdz.sprawdzsluch.payments.model.PaymentStatus;
import dev.gwozdz.sprawdzsluch.payments.repository.PaymentRepository;
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
@DisplayName("[IT] PaymentController")
class PaymentControllerIT {

    @Container
    @ServiceConnection
    static final MongoDBContainer MONGODB = new MongoDBContainer("mongo:7.0");

    // WireMock jako zamiennik backend-pdf
    static WireMockServer wireMockPdf;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        wireMockPdf = new WireMockServer(wireMockConfig().dynamicPort());
        wireMockPdf.start();
        registry.add("services.pdf.url", wireMockPdf::baseUrl);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private PaymentRepository paymentRepository;

    @BeforeEach
    void setUp() {
        paymentRepository.deleteAll();
        wireMockPdf.resetAll();
        // pdf service przyjmuje wszystko domyślnie
        wireMockPdf.stubFor(
                post(urlEqualTo("/api/v1/payment-completed"))
                        .willReturn(aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"status\":\"ok\"}"))
        );
    }

    @AfterEach
    void tearDown() {
        paymentRepository.deleteAll();
    }

    // --- helper ---

    private Map<String, Object> buildVoucherPayload(String testId, String email, String voucherCode) {
        return Map.of(
                "testId", testId,
                "userEmail", email,
                "maxAudibleFrequency", 10000,
                "hearingLevels", Map.of("1000", 0.0, "4000", 5.0),
                "paymentMethod", "VOUCHER",
                "voucherCode", voucherCode
        );
    }

    private Map<String, Object> buildCardPayload(String testId, String email) {
        return Map.of(
                "testId", testId,
                "userEmail", email,
                "maxAudibleFrequency", 10000,
                "hearingLevels", Map.of("1000", 0.0, "4000", 5.0),
                "paymentMethod", "CARD"
        );
    }

    @Nested
    @DisplayName("POST /api/payments/process — voucher")
    class VoucherPayment {

        @Test
        @DisplayName("prawidłowy voucher REKRUTACJA → 200, płatność COMPLETED w MongoDB")
        void validVoucher_returns200_paymentCompletedInDb() {
            Map<String, Object> payload = buildVoucherPayload(
                    "TEST-VOUCHER001", "pawel@example.com", "REKRUTACJA");

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    "/api/payments/process", payload, Map.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody().get("success")).isEqualTo(true);

            // weryfikacja MongoDB — czekamy bo przetwarzanie jest synchroniczne
            Optional<Payment> payment = paymentRepository.findByTestId("TEST-VOUCHER001");
            assertThat(payment).isPresent();
            assertThat(payment.get().getPaymentStatus()).isEqualTo(PaymentStatus.COMPLETED);
            assertThat(payment.get().getUserEmail()).isEqualTo("pawel@example.com");
            assertThat(payment.get().getPaymentMethod()).isEqualTo("VOUCHER");
        }

        @Test
        @DisplayName("prawidłowy voucher → backend-pdf zostaje powiadomiony")
        void validVoucher_notifiesPdfService() {
            restTemplate.postForEntity("/api/payments/process",
                    buildVoucherPayload("TEST-VOUCHER002", "anna@example.com", "REKRUTACJA"),
                    Map.class);

            // notifyPdfService używa .block() — wywołanie synchroniczne
            wireMockPdf.verify(1, postRequestedFor(urlEqualTo("/api/v1/payment-completed")));
        }

        @Test
        @DisplayName("nieprawidłowy voucher → 200 (endpoint przyjmuje), płatność FAILED w MongoDB")
        void invalidVoucher_paymentFailedInDb() {
            Map<String, Object> payload = buildVoucherPayload(
                    "TEST-VOUCHER003", "jan@example.com", "INVALID_CODE");

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    "/api/payments/process", payload, Map.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

            Optional<Payment> payment = paymentRepository.findByTestId("TEST-VOUCHER003");
            assertThat(payment).isPresent();
            assertThat(payment.get().getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
        }

        @Test
        @DisplayName("nieprawidłowy voucher → backend-pdf NIE jest powiadamiany")
        void invalidVoucher_doesNotNotifyPdfService() {
            restTemplate.postForEntity("/api/payments/process",
                    buildVoucherPayload("TEST-VOUCHER004", "ewa@example.com", "INVALID"),
                    Map.class);

            wireMockPdf.verify(0, postRequestedFor(anyUrl()));
        }
    }

    @Nested
    @DisplayName("POST /api/payments/process — karta")
    class CardPayment {

        @Test
        @DisplayName("płatność kartą → 200, płatność COMPLETED w MongoDB")
        void cardPayment_returns200_paymentCompletedInDb() {
            Map<String, Object> payload = buildCardPayload("TEST-CARD001", "klient@example.com");

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    "/api/payments/process", payload, Map.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

            Optional<Payment> payment = paymentRepository.findByTestId("TEST-CARD001");
            assertThat(payment).isPresent();
            assertThat(payment.get().getPaymentStatus()).isEqualTo(PaymentStatus.COMPLETED);
            assertThat(payment.get().getPaymentMethod()).isEqualTo("CARD");
        }

        @Test
        @DisplayName("płatność kartą → backend-pdf jest powiadamiany")
        void cardPayment_notifiesPdfService() {
            restTemplate.postForEntity("/api/payments/process",
                    buildCardPayload("TEST-CARD002", "klient2@example.com"),
                    Map.class);

            wireMockPdf.verify(1, postRequestedFor(urlEqualTo("/api/v1/payment-completed")));
        }
    }

    @Nested
    @DisplayName("POST /api/payments/process — idempotentność")
    class Idempotency {

        @Test
        @DisplayName("te same dane dwa razy → 1 rekord w DB, PDF powiadamiany raz")
        void samePayloadTwice_singlePaymentInDb_pdfNotifiedOnce() {
            Map<String, Object> payload = buildVoucherPayload(
                    "TEST-IDEM001", "idem@example.com", "REKRUTACJA");

            restTemplate.postForEntity("/api/payments/process", payload, Map.class);
            restTemplate.postForEntity("/api/payments/process", payload, Map.class);

            assertThat(paymentRepository.count()).isOne();
            // PDF powiadomiony tylko raz (przy pierwszym zapisie)
            wireMockPdf.verify(1, postRequestedFor(urlEqualTo("/api/v1/payment-completed")));
        }
    }

    @Nested
    @DisplayName("GET /api/payments/status/{testId}")
    class StatusEndpoint {

        @Test
        @DisplayName("po przetworzeniu → 200 ze szczegółami płatności")
        void afterProcessing_returns200WithPayment() {
            restTemplate.postForEntity("/api/payments/process",
                    buildVoucherPayload("TEST-STATUS001", "status@example.com", "REKRUTACJA"),
                    Map.class);

            ResponseEntity<Map> response = restTemplate.getForEntity(
                    "/api/payments/status/TEST-STATUS001", Map.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            Map<?, ?> body = response.getBody();
            assertThat(body.get("testId")).isEqualTo("TEST-STATUS001");
            assertThat(body.get("paymentStatus")).isEqualTo("COMPLETED");
        }

        @Test
        @DisplayName("nieznany testId → 404")
        void unknownTestId_returns404() {
            ResponseEntity<Object> response = restTemplate.getForEntity(
                    "/api/payments/status/NONEXISTENT", Object.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }
    }

    @Nested
    @DisplayName("POST /api/payments/process — błędne dane wejściowe")
    class InputValidation {

        @Test
        @DisplayName("nieznana metoda płatności → 200 (obsługuje wyjątek wewnętrznie), payment FAILED")
        void unknownPaymentMethod_paymentFailed() {
            Map<String, Object> payload = Map.of(
                    "testId", "TEST-ERR001",
                    "userEmail", "err@example.com",
                    "maxAudibleFrequency", 8000,
                    "hearingLevels", Map.of("1000", 0.0),
                    "paymentMethod", "BLIK"
            );

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    "/api/payments/process", payload, Map.class);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

            Optional<Payment> payment = paymentRepository.findByTestId("TEST-ERR001");
            assertThat(payment).isPresent();
            assertThat(payment.get().getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
        }
    }
}
