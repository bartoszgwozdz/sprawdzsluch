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
    
    /**
     * Przetwarza płatność voucher
     */
    @PostMapping("/process/voucher")
    public ResponseEntity<Payment> processVoucherPayment(
            @RequestParam String testId,
            @RequestParam String voucherCode) {
        
        System.out.println("Przetwarzanie płatności voucher dla testId: " + testId + ", voucher: " + voucherCode);
        
        try {
            Payment payment = paymentService.processPayment(testId, "VOUCHER", voucherCode);
            return ResponseEntity.ok(payment);
        } catch (Exception e) {
            System.err.println("Błąd podczas przetwarzania płatności voucher: " + e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * Przetwarza płatność PayNow
     */
    @PostMapping("/process/paynow")
    public ResponseEntity<Payment> processPayNowPayment(
            @RequestParam String testId,
            @RequestParam String externalPaymentId) {
        
        System.out.println("Przetwarzanie płatności PayNow dla testId: " + testId + ", externalPaymentId: " + externalPaymentId);
        
        try {
            Payment payment = paymentService.processPayment(testId, "PAYNOW", externalPaymentId);
            return ResponseEntity.ok(payment);
        } catch (Exception e) {
            System.err.println("Błąd podczas przetwarzania płatności PayNow: " + e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }
}