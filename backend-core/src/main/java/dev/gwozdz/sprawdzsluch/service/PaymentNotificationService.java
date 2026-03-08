package dev.gwozdz.sprawdzsluch.service;

import dev.gwozdz.sprawdzsluch.entity.TestResult;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

/**
 * Serwis do powiadamiania backend-payments o nowych wynikach testów
 * poprzez HTTP POST (zamiennik Kafka producera).
 */
@Service
@Slf4j
public class PaymentNotificationService {

    private final WebClient webClient;

    public PaymentNotificationService(
            @Value("${services.payments.url:http://localhost:8091}") String paymentsBaseUrl) {
        this.webClient = WebClient.builder()
                .baseUrl(paymentsBaseUrl)
                .build();
    }

    /**
     * Wysyła informację o zapisanym wyniku testu do backend-payments
     */
    public void notifyPaymentService(TestResult testResult) {
        try {
            Map<String, Object> payload = Map.of(
                    "testId", testResult.getTestId(),
                    "userEmail", testResult.getUserEmail(),
                    "maxAudibleFrequency", testResult.getMaxAudibleFrequency(),
                    "hearingLevels", testResult.getHearingLevels() != null ? testResult.getHearingLevels() : Map.of(),
                    "paymentMethod", testResult.getPaymentMethod() != null ? testResult.getPaymentMethod() : "",
                    "voucherCode", testResult.getVoucherCode() != null ? testResult.getVoucherCode() : ""
            );

            // Przechwytujemy correlationId przed subscribe() — MDC nie jest dostępne przez granicę wątku
            String correlationId = MDC.get("correlationId");

            webClient.post()
                    .uri("/api/payments/process")
                    .header("X-Correlation-Id", correlationId != null ? correlationId : "")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    .subscribe(
                            response -> log.info("Powiadomiono backend-payments o teście {}: {}", testResult.getTestId(), response),
                            error -> log.error("Błąd podczas powiadamiania backend-payments o teście {}: {}", testResult.getTestId(), error.getMessage())
                    );

            log.info("Wysłano powiadomienie o teście {} do backend-payments", testResult.getTestId());
        } catch (Exception e) {
            log.error("Błąd podczas wysyłania powiadomienia do backend-payments", e);
            throw new RuntimeException("Błąd podczas powiadamiania serwisu płatności", e);
        }
    }
}
