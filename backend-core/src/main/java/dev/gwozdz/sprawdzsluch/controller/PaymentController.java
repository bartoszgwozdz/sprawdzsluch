package dev.gwozdz.sprawdzsluch.controller;

import dev.gwozdz.sprawdzsluch.entity.Payment;
import dev.gwozdz.sprawdzsluch.entity.PaymentStatus;
import dev.gwozdz.sprawdzsluch.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;

    /**
     * Tworzy nową płatność (inicjalizacja).
     * Frontend wysyła userEmail + testId, backend tworzy payment w DB
     * i zwraca paynowPaymentId (który potem wysyłasz do Paynow).
     */
    @PostMapping("/create")
    public ResponseEntity<Payment> createPayment(@RequestBody Map<String, String> request)
    {
        String userEmail = request.get("userEmail");
        String testId = request.get("testId");
        String paynowPaymentId = request.get("paynowPaymentId"); // otrzymany z Paynow init API

        Payment payment = paymentService.createPayment(userEmail, testId, paynowPaymentId);
        return ResponseEntity.ok(payment);
    }

    /**
     * Endpoint wywoływany przez Paynow w formie callbacku (webhook).
     * W JSON przychodzi m.in. paymentId i status.
     */
    @PostMapping("/notify")
    public ResponseEntity<String> notifyPayment(@RequestBody Map<String, String> payload)
    {
        String paynowPaymentId = payload.get("paymentId");
        String status = payload.get("status");

        Payment payment = paymentService.handlePaynowCallback(paynowPaymentId, status);

        // Jeśli CONFIRMED → trigger: PDF + email
        if (payment.getStatus() == PaymentStatus.PAID) {
            // TODO: wywołanie HtmlService → PdfService → EmailService
        }

        return ResponseEntity.ok("OK");
    }

    /**
     * Sprawdzenie statusu płatności po paynowPaymentId.
     * Używane przez frontend (np. po redirectUrl z Paynow).
     */
    @GetMapping("/status/{paynowPaymentId}")
    public ResponseEntity<Map<String, Object>> getStatus(@PathVariable String paynowPaymentId)
    {
        Payment payment = paymentService.updateStatus(paynowPaymentId, PaymentStatus.IN_PROGRESS);

        return ResponseEntity.ok(Map.of(
                "paymentId", payment.getPaynowPaymentId(),
                "status", payment.getStatus()
        ));
    }
}


