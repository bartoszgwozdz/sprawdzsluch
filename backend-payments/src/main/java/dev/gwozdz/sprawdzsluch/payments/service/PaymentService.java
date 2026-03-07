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
            if (paymentRepository.existsByTestIdAndUserEmail(event.getTestId(), event.getUserEmail())) {
                log.info("Payment dla testId {} i email {} już istnieje", event.getTestId(), event.getUserEmail());
                return;
            }
            
            // Tworzenie nowego payment
            Payment payment = new Payment();
            payment.setTestId(event.getTestId());
            payment.setUserEmail(event.getUserEmail());
            payment.setAmount(event.getAmount());
            payment.setCurrency("PLN");
            payment.setPaymentStatus(PaymentStatus.PENDING);
            payment.setPaymentMethod(event.getPaymentMethod());
            payment.setVoucherCode(event.getVoucherCode());
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
            payment.setUpdatedAt(LocalDateTime.now());
            paymentRepository.save(payment);

            if (payment.getPaymentStatus() == PaymentStatus.COMPLETED) {
                notifyPdfService(payment);
            }

        } catch (Exception e) {
            log.error("Błąd podczas przetwarzania płatności: {}", e.getMessage());
            payment.setPaymentStatus(PaymentStatus.FAILED);
            payment.setFailureReason(e.getMessage());
            payment.setUpdatedAt(LocalDateTime.now());
            paymentRepository.save(payment);
        }
    }
    
    /**
     * Powiadamia backend-pdf o zakończonej płatności przez HTTP POST
     */
    private void notifyPdfService(Payment payment) {
        if (payment.isPdfSent()) {
            log.info("PDF już wysłany dla testu {}, pomijam", payment.getTestId());
            return;
        }

        PaymentCompletedEvent event = new PaymentCompletedEvent(
                payment.getTestId(),
                payment.getUserEmail(),
                payment.getId(),
                payment.getPaymentMethod()
        );

        try {
            pdfServiceClient.post()
                    .uri("/api/v1/payment-completed")
                    .bodyValue(event)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(); // synchronicznie — wiemy czy się udało

            payment.setPdfSent(true);
            payment.setPdfSentAt(LocalDateTime.now());
            payment.setUpdatedAt(LocalDateTime.now());
            paymentRepository.save(payment);
            log.info("PDF wysłany dla testu {}", payment.getTestId());

        } catch (Exception e) {
            log.error("Błąd podczas powiadamiania backend-pdf o teście {}: {}", payment.getTestId(), e.getMessage());
            // pdfSent=false — można ponowić ręcznie lub przez mechanizm retry
        }
    }
    
    /**
     * Pobiera payment po testId
     */
    public Payment getPaymentByTestId(String testId) {
        return paymentRepository.findByTestId(testId)
                .orElseThrow(() -> new IllegalArgumentException("Payment nie został znaleziony dla testId: " + testId));
    }
}