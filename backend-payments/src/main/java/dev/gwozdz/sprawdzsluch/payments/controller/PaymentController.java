package dev.gwozdz.sprawdzsluch.payments.controller;

import dev.gwozdz.sprawdzsluch.payments.model.Payment;
import dev.gwozdz.sprawdzsluch.payments.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    
    private final PaymentService paymentService;
    
    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
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