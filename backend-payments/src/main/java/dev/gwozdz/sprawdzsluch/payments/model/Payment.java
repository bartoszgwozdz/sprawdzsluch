package dev.gwozdz.sprawdzsluch.payments.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "payments")
public class Payment {
    
    @Id
    private String id;
    
    @Indexed(unique = true)
    private String testId;
    
    private String userEmail;
    private BigDecimal amount;
    private String currency;
    private PaymentStatus paymentStatus;
    private String paymentMethod; // VOUCHER, PAYNOW
    private String externalPaymentId; // ID od PayNow
    private String failureReason;
    
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
    private LocalDateTime updatedAt;
    
    // Konstruktor domyślny
    public Payment() {}
    
    // Gettery i settery
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public String getTestId() { return testId; }
    public void setTestId(String testId) { this.testId = testId; }
    
    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
    
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(PaymentStatus paymentStatus) { this.paymentStatus = paymentStatus; }
    
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    
    public String getExternalPaymentId() { return externalPaymentId; }
    public void setExternalPaymentId(String externalPaymentId) { this.externalPaymentId = externalPaymentId; }
    
    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }
    
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}