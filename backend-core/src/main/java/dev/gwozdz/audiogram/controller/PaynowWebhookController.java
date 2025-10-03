package dev.gwozdz.audiogram.controller;

import dev.gwozdz.audiogram.entity.Payment;
import dev.gwozdz.audiogram.entity.PaymentStatus;
import dev.gwozdz.audiogram.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/paynow")
public class PaynowWebhookController {

    private final PaymentService paymentService;

    public PaynowWebhookController(PaymentService paymentService)
    {
        this.paymentService = paymentService;
    }

    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(@RequestBody Map<String, Object> body)
    {

        String externalId = (String) body.get("externalId");
        String status = (String) body.get("status");

        Payment payment = paymentService.findByPaynowPaymentId(externalId);
        if ("CONFIRMED".equals(status)) {
            payment.setStatus(PaymentStatus.PAID);
            paymentService.save(payment);

            // 🔥 tutaj generujesz PDF i wysyłasz mailem
        }

        return ResponseEntity.ok("OK");
    }
}
