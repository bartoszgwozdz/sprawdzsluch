package dev.gwozdz.sprawdzsluch.payments.service;

import dev.gwozdz.sprawdzsluch.payments.dto.PaymentCompletedEvent;
import dev.gwozdz.sprawdzsluch.payments.dto.TestResultStoredEvent;
import dev.gwozdz.sprawdzsluch.payments.handler.PaymentHandler;
import dev.gwozdz.sprawdzsluch.payments.handler.PaymentHandlerFactory;
import dev.gwozdz.sprawdzsluch.payments.model.Payment;
import dev.gwozdz.sprawdzsluch.payments.model.PaymentStatus;
import dev.gwozdz.sprawdzsluch.payments.repository.PaymentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;

@Slf4j
@Service
public class PaymentService {
    
    private final PaymentRepository paymentRepository;
    private final PaymentHandlerFactory paymentHandlerFactory;
    private final WebClient pdfServiceClient;

    public PaymentService(
            PaymentRepository paymentRepository,
            PaymentHandlerFactory paymentHandlerFactory,
            @Value("${services.pdf.url:http://localhost:3001}") String pdfServiceUrl) {
        this.paymentRepository = paymentRepository;
        this.paymentHandlerFactory = paymentHandlerFactory;
        this.pdfServiceClient = WebClient.builder()
                .baseUrl(pdfServiceUrl)
                .build();
    }

    
    /**
     * Obsługuje nowy wynik testu — wywoływany przez HTTP POST z backend-core
     */
    public void handleTestResultStored(TestResultStoredEvent event) {
        log.info("Otrzymano request przetworzenia płatności dla testu: {}", event.getTestId());
        
        try {
            // Sprawdź czy payment już nie istnieje
            if (paymentRepository.existsByTestId(event.getTestId())) {
                log.info("Payment dla testId {} już istnieje", event.getTestId());
                return;
            }
            
            // Tworzenie nowego payment
            Payment payment = new Payment();
            payment.setTestId(event.getTestId());
            payment.setUserEmail(event.getUserEmail());
            payment.setAmount(event.getAmount());
            payment.setCurrency("PLN");
            payment.setPaymentStatus(PaymentStatus.PENDING);
            payment.setCreatedAt(LocalDateTime.now());

            // Zapis do MongoDB
            Payment savedPayment = paymentRepository.save(payment);
            processPayment(savedPayment);
            
        } catch (Exception e) {
            log.error("Błąd podczas przetwarzania TestResultStoredEvent: {}", e.getMessage());
        }
    }
    
    /**
     * Przetwarza płatność - może być voucher lub PayNow
     */
    private void processPayment(Payment payment) {
        
        if (payment.getPaymentStatus() != PaymentStatus.PENDING) {
            throw new IllegalStateException("Payment nie jest w statusie PENDING");
        }
        String paymentMethod = payment.getPaymentMethod();
        try {
            PaymentHandler handler = paymentHandlerFactory.getHandler(paymentMethod);
            payment = handler.processPayment(payment.getTestId(), payment);
            PaymentStatus paymentStatus = payment.getPaymentStatus();
            if(paymentStatus == PaymentStatus.COMPLETED) {
                notifyPdfService(payment);
            }
            
        } catch (Exception e) {
            log.error("Błąd podczas przetwarzania płatności: {}", e.getMessage());
            payment.setPaymentStatus(PaymentStatus.FAILED);
            payment.setFailureReason(e.getMessage());
            paymentRepository.save(payment);
            log.warn("Płatność nieudana dla testu: {}, powód: {}", payment.getTestId(), e.getMessage());
        }
    }
    
    /**
     * Powiadamia backend-pdf o zakończonej płatności przez HTTP POST
     */
    private void notifyPdfService(Payment payment) {
        PaymentCompletedEvent event = new PaymentCompletedEvent(
                payment.getTestId(),
                payment.getUserEmail(),
                payment.getId(),
                payment.getPaymentMethod()
        );
        
        pdfServiceClient.post()
                .uri("/api/v1/payment-completed")
                .bodyValue(event)
                .retrieve()
                .bodyToMono(String.class)
                .subscribe(
                        response -> log.info("Powiadomiono backend-pdf o płatności dla testu {}: {}", event.getTestId(), response),
                        error -> log.error("Błąd podczas powiadamiania backend-pdf o teście {}: {}", event.getTestId(), error.getMessage())
                );
        
        log.info("Wysłano PaymentCompletedEvent do backend-pdf: testId={}", event.getTestId());
    }
    
    /**
     * Pobiera payment po testId
     */
    public Payment getPaymentByTestId(String testId) {
        return paymentRepository.findByTestId(testId)
                .orElseThrow(() -> new IllegalArgumentException("Payment nie został znaleziony dla testId: " + testId));
    }
}