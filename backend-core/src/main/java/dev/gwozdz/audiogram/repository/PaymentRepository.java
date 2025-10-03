package dev.gwozdz.audiogram.repository;

import dev.gwozdz.audiogram.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByPaynowPaymentId(String payuOrderId);
}
