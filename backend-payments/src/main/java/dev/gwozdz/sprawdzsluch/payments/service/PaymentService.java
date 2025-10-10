package dev.gwozdz.sprawdzsluch.payments.service;

import dev.gwozdz.sprawdzsluch.payments.dto.PaymentCompletedEvent;
import dev.gwozdz.sprawdzsluch.payments.dto.TestResultStoredEvent;
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
public class PaymentService {
    
    private final PaymentRepository paymentRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final VoucherService voucherService;
    
    public PaymentService(PaymentRepository paymentRepository, 
                         KafkaTemplate<String, Object> kafkaTemplate,
                         VoucherService voucherService) {
        this.paymentRepository = paymentRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.voucherService = voucherService;
    }
    
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
            System.out.println("Utworzono nowy payment: " + savedPayment);
            
        } catch (Exception e) {
            System.err.println("Błąd podczas przetwarzania TestResultStoredEvent: " + e.getMessage());
        }
    }
    
    /**
     * Przetwarza płatność - może być voucher lub PayNow
     */
    public Payment processPayment(String testId, String paymentMethod, String paymentData) {
        Payment payment = paymentRepository.findByTestId(testId)
                .orElseThrow(() -> new IllegalArgumentException("Payment nie został znaleziony dla testId: " + testId));
        
        if (payment.getPaymentStatus() != PaymentStatus.PENDING) {
            throw new IllegalStateException("Payment nie jest w statusie PENDING");
        }
        
        try {
            if ("VOUCHER".equals(paymentMethod)) {
                // Walidacja vouchera
                boolean isValid = voucherService.validateVoucher(paymentData);
                if (isValid) {
                    payment.setPaymentStatus(PaymentStatus.COMPLETED);
                    payment.setPaymentMethod("VOUCHER");
                    payment.setCompletedAt(LocalDateTime.now());
                } else {
                    payment.setPaymentStatus(PaymentStatus.FAILED);
                    payment.setFailureReason("Nieprawidłowy voucher");
                }
            } else if ("PAYNOW".equals(paymentMethod)) {
                // Integracja z PayNow - na razie symulacja
                payment.setPaymentStatus(PaymentStatus.COMPLETED);
                payment.setPaymentMethod("PAYNOW");
                payment.setExternalPaymentId(paymentData);
                payment.setCompletedAt(LocalDateTime.now());
            } else {
                throw new IllegalArgumentException("Nieobsługiwany sposób płatności: " + paymentMethod);
            }
            
            Payment savedPayment = paymentRepository.save(payment);
            
            // Jeśli płatność zakończona sukcesem, wyślij event do Kafka
            if (savedPayment.getPaymentStatus() == PaymentStatus.COMPLETED) {
                sendPaymentCompletedEvent(savedPayment);
            }
            
            return savedPayment;
            
        } catch (Exception e) {
            System.err.println("Błąd podczas przetwarzania płatności: " + e.getMessage());
            payment.setPaymentStatus(PaymentStatus.FAILED);
            payment.setFailureReason(e.getMessage());
            return paymentRepository.save(payment);
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
     * Pobiera payment po testId
     */
    public Payment getPaymentByTestId(String testId) {
        return paymentRepository.findByTestId(testId)
                .orElseThrow(() -> new IllegalArgumentException("Payment nie został znaleziony dla testId: " + testId));
    }
}