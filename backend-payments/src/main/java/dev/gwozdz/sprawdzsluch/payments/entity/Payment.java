package dev.gwozdz.sprawdzsluch.payments.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "payments")
@Data
@NoArgsConstructor
public class Payment {

    @Id
    private String id;

    @Indexed
    private String testId;

    @Indexed
    private String userEmail;

    private String paymentMethod; // card, blik, voucher

    private String voucherCode;

    private PaymentStatus status; // PENDING, COMPLETED, FAILED, CANCELLED

    private BigDecimal amount;

    private String currency = "PLN";

    // PayNow specific fields
    private String paynowPaymentId;
    private String paynowStatus;
    private String paynowUrl;

    // Audit fields
    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    private LocalDateTime completedAt;

    private String errorMessage;

    public Payment(String testId, String userEmail, String paymentMethod) {
        this.testId = testId;
        this.userEmail = userEmail;
        this.paymentMethod = paymentMethod;
        this.status = PaymentStatus.PENDING;
        this.amount = new BigDecimal("24.99");
    }

    public enum PaymentStatus {
        PENDING,    // Oczekuje na płatność
        COMPLETED,  // Płatność zakończona pomyślnie
        FAILED,     // Płatność nieudana
        CANCELLED   // Płatność anulowana
    }
}