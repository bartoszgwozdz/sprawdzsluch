package dev.gwozdz.sprawdzsluch.payments.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO reprezentujące wiadomość do Kafka topic: sprawdzsluch-payment-completed
 */
public class PaymentCompletedEvent {
    
    private String testId;
    private String userEmail;
    private String paymentId;
    private String paymentMethod;
    private BigDecimal amount;
    private String currency;
    private LocalDateTime completedAt;
    
    // Metadane dla event
    private String eventType = "PAYMENT_COMPLETED";
    private LocalDateTime eventTimestamp;
    
    public PaymentCompletedEvent() {}
    
    public PaymentCompletedEvent(String testId, String userEmail, String paymentId, String paymentMethod) {
        this.testId = testId;
        this.userEmail = userEmail;
        this.paymentId = paymentId;
        this.paymentMethod = paymentMethod;
        this.amount = new BigDecimal("24.99");
        this.currency = "PLN";
        this.completedAt = LocalDateTime.now();
        this.eventTimestamp = LocalDateTime.now();
    }
    
    // Gettery
    public String getTestId() { return testId; }
    public String getUserEmail() { return userEmail; }
    public String getPaymentId() { return paymentId; }
    public String getPaymentMethod() { return paymentMethod; }
    public BigDecimal getAmount() { return amount; }
    public String getCurrency() { return currency; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public String getEventType() { return eventType; }
    public LocalDateTime getEventTimestamp() { return eventTimestamp; }
    
    // Settery
    public void setTestId(String testId) { this.testId = testId; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
    public void setPaymentId(String paymentId) { this.paymentId = paymentId; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public void setCurrency(String currency) { this.currency = currency; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public void setEventTimestamp(LocalDateTime eventTimestamp) { this.eventTimestamp = eventTimestamp; }
}