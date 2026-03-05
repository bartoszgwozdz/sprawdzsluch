package dev.gwozdz.sprawdzsluch.payments.controller;

import dev.gwozdz.sprawdzsluch.payments.dto.TestResultStoredEvent;
import dev.gwozdz.sprawdzsluch.payments.model.Payment;
import dev.gwozdz.sprawdzsluch.payments.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {
    
    private final PaymentService paymentService;
    
    /**
     * Endpoint wywoływany przez backend-core po zapisaniu wyniku testu.
     * Zastępuje Kafka consumer na topic sprawdzsluch-result-stored.
     */
    @PostMapping("/process")
    public ResponseEntity<Map<String, Object>> processTestResult(@RequestBody TestResultStoredEvent event) {
        try {
            log.info("Otrzymano request przetworzenia płatności dla testu: {}", event.getTestId());
            paymentService.handleTestResultStored(event);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "testId", event.getTestId(),
                    "message", "Płatność w trakcie przetwarzania"
            ));
        } catch (Exception e) {
            log.error("Błąd podczas przetwarzania płatności: {}", e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * Pobiera status płatności dla danego testu
     */
    @GetMapping("/status/{testId}")
    public ResponseEntity<Payment> getPaymentStatus(@PathVariable String testId) {
        try {
            Payment payment = paymentService.getPaymentByTestId(testId);
            return ResponseEntity.ok(payment);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}