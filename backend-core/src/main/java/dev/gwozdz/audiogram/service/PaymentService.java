package dev.gwozdz.audiogram.service;

import dev.gwozdz.audiogram.entity.Payment;
import dev.gwozdz.audiogram.entity.PaymentStatus;
import dev.gwozdz.audiogram.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;

    /**
     * Tworzy nowy rekord płatności.
     */
    public Payment createPayment(String userEmail, String testId, String paynowPaymentId)
    {
        Payment payment = Payment.builder()
                .userEmail(userEmail)
                .testId(testId)
                .paynowPaymentId(paynowPaymentId)
                .status(PaymentStatus.INITIATED)
                .build();

        return paymentRepository.save(payment);
    }

    public Payment findByPaynowPaymentId(String externalId)
    {
        return paymentRepository.findByPaynowPaymentId(externalId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + externalId));
    }

    public Payment save(Payment payment)
    {
        return paymentRepository.save(payment);
    }

    /**
     * Aktualizuje status płatności.
     */
    @Transactional
    public Payment updateStatus(String paynowPaymentId, PaymentStatus newStatus)
    {
        Payment payment = paymentRepository.findByPaynowPaymentId(paynowPaymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found: " + paynowPaymentId));

        payment.setStatus(newStatus);
        return paymentRepository.save(payment);
    }

    /**
     * Obsługa callbacku z Paynow.
     * Mapuje status Paynow → nasz PaymentStatus.
     */
    @Transactional
    public Payment handlePaynowCallback(String paynowPaymentId, String paynowStatus)
    {
        PaymentStatus status = mapPaynowStatus(paynowStatus);
        return updateStatus(paynowPaymentId, status);
    }

    /**
     * Mapowanie statusów Paynow → aplikacja.
     */
    private PaymentStatus mapPaynowStatus(String paynowStatus)
    {
        return switch (paynowStatus) {
            case "NEW" -> PaymentStatus.INITIATED;
            case "PENDING" -> PaymentStatus.IN_PROGRESS;
            case "CONFIRMED" -> PaymentStatus.PAID;
            case "REJECTED", "ERROR" -> PaymentStatus.FAILED;
            case "CANCELED" -> PaymentStatus.CANCELED;
            default -> throw new IllegalArgumentException("Unknown Paynow status: " + paynowStatus);
        };
    }
}


