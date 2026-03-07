package dev.gwozdz.sprawdzsluch.payments.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@Document(collection = "payments")
@CompoundIndex(def = "{'testId': 1, 'userEmail': 1}", unique = true)
public class Payment {

    @Id
    private String id;

    private String testId;

    private String userEmail;
    private BigDecimal amount;
    private String currency;
    private PaymentStatus paymentStatus;
    private LocalDateTime paymentDate;
    private String paymentMethod; // VOUCHER, PAYNOW
    private String externalPaymentId; // ID od PayNow
    private String failureReason;
    private String voucherCode;
    
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
    private LocalDateTime updatedAt;

    private boolean pdfSent = false;
    private LocalDateTime pdfSentAt;

}