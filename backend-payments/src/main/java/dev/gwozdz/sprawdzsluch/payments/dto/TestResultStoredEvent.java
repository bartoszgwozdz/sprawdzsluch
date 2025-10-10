package dev.gwozdz.sprawdzsluch.payments.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * DTO reprezentujące wiadomość z Kafka topic: sprawdzsluch-result-stored
 */
public class TestResultStoredEvent {
    
    private String testId;
    private String userEmail;
    private int maxAudibleFrequency;
    private Map<Integer, Double> hearingLevels;
    private String paymentMethod;
    private String voucherCode;
    private LocalDateTime createdAt;
    
    // Metadane dla event
    private String eventType = "TEST_RESULT_STORED";
    private LocalDateTime eventTimestamp;
    
    public TestResultStoredEvent() {}
    
    // Gettery
    public String getTestId() { return testId; }
    public String getUserEmail() { return userEmail; }
    public int getMaxAudibleFrequency() { return maxAudibleFrequency; }
    public Map<Integer, Double> getHearingLevels() { return hearingLevels; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getVoucherCode() { return voucherCode; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getEventType() { return eventType; }
    public LocalDateTime getEventTimestamp() { return eventTimestamp; }
    
    // Settery
    public void setTestId(String testId) { this.testId = testId; }
    public void setUserEmail(String userEmail) { this.userEmail = userEmail; }
    public void setMaxAudibleFrequency(int maxAudibleFrequency) { this.maxAudibleFrequency = maxAudibleFrequency; }
    public void setHearingLevels(Map<Integer, Double> hearingLevels) { this.hearingLevels = hearingLevels; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public void setVoucherCode(String voucherCode) { this.voucherCode = voucherCode; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public void setEventTimestamp(LocalDateTime eventTimestamp) { this.eventTimestamp = eventTimestamp; }
    
    /**
     * Zwraca stałą kwotę dla testu słuchu
     */
    public BigDecimal getAmount() {
        return new BigDecimal("24.99");
    }
}