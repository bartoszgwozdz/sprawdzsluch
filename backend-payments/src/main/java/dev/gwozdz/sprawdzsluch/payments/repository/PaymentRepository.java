package dev.gwozdz.sprawdzsluch.payments.repository;

import dev.gwozdz.sprawdzsluch.payments.model.Payment;
import dev.gwozdz.sprawdzsluch.payments.model.PaymentStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends MongoRepository<Payment, String> {
    
    Optional<Payment> findByTestId(String testId);
    
    List<Payment> findByPaymentStatus(PaymentStatus status);
    
    List<Payment> findByUserEmail(String userEmail);
    
    Optional<Payment> findByExternalPaymentId(String externalPaymentId);
    
    boolean existsByTestId(String testId);
}