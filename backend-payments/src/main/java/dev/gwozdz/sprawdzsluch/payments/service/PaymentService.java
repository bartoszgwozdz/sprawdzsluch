package dev.gwozdz.sprawdzsluch.payments.service;

import dev.gwozdz.sprawdzsluch.payments.dto.PaymentCompletedEvent;
import dev.gwozdz.sprawdzsluch.payments.dto.TestResultStoredEvent;
import dev.gwozdz.sprawdzsluch.payments.handler.PaymentHandler;
import dev.gwozdz.sprawdzsluch.payments.handler.PaymentHandlerFactory;
import dev.gwozdz.sprawdzsluch.payments.model.Payment;
import dev.gwozdz.sprawdzsluch.payments.model.PaymentStatus;
import dev.gwozdz.sprawdzsluch.payments.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {
    
    private final PaymentRepository paymentRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final PaymentHandlerFactory paymentHandlerFactory;

    
    /**
     * Nasłuchuje wiadomości z topic: sprawdzsluch-result-stored
     * Tworzy payment dla każdego nowego testu słuchu
     */
    @KafkaListener(topics = "sprawdzsluch-result-stored", groupId = "payment-service-group")
    public void handleTestResultStored(TestResultStoredEvent event) {
        System.out.println("Otrzymano wiadomość z topic sprawdzsluch-result-stored: " + event);
        
        try {
            // Sprawdź czy payment już nie istnieje
            if (paymentRepository.existsByTestId(event.getTestId())) {
                System.out.println("Payment dla testId " + event.getTestId() + " już istnieje");
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
//            System.out.println("Utworzono nowy payment: " + savedPayment);
            processPayment(savedPayment);
            
        } catch (Exception e) {
            System.err.println("Błąd podczas przetwarzania TestResultStoredEvent: " + e.getMessage());
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
                sendPaymentCompletedEvent(payment);
            }
            
        } catch (Exception e) {
            System.err.println("Błąd podczas przetwarzania płatności: " + e.getMessage());
            payment.setPaymentStatus(PaymentStatus.FAILED);
            payment.setFailureReason(e.getMessage());
            paymentRepository.save(payment);
            sendPaymentFailedEvent(payment);
        }
    }
    
    /**
     * Wysyła event o zakończonej płatności do topic: sprawdzsluch-payment-completed
     */
    private void sendPaymentCompletedEvent(Payment payment) {
        PaymentCompletedEvent event = new PaymentCompletedEvent(
                payment.getTestId(),
                payment.getUserEmail(),
                payment.getId(),
                payment.getPaymentMethod()
        );
        
        kafkaTemplate.send("sprawdzsluch-payment-completed", event.getTestId(), event);
        System.out.println("Wysłano PaymentCompletedEvent do Kafka: " + event);
    }

    /**
     * Wysyła event o zakończonej płatności do topic: sprawdzsluch-payment-completed
     */
    private void sendPaymentFailedEvent(Payment payment) {
        PaymentCompletedEvent event = new PaymentCompletedEvent(
            payment.getTestId(),
            payment.getUserEmail(),
            payment.getId(),
            payment.getPaymentMethod()
        );

        kafkaTemplate.send("sprawdzsluch-payment-failed", event.getTestId(), event);
        System.out.println("Wysłano PaymentCompletedEvent do Kafka: " + event);
    }
    
    /**
     * Pobiera payment po testId
     */
    public Payment getPaymentByTestId(String testId) {
        return paymentRepository.findByTestId(testId)
                .orElseThrow(() -> new IllegalArgumentException("Payment nie został znaleziony dla testId: " + testId));
    }
}