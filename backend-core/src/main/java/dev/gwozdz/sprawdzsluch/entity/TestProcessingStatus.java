package dev.gwozdz.sprawdzsluch.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "test_processing_status")
@Data
@NoArgsConstructor
public class TestProcessingStatus {

    @Id
    private String id;

    @Indexed(unique = true)
    private String testId;

    private String status; // SUBMITTED, PROCESSING, PROCESSED, PAYMENT_REQUIRED, COMPLETED, ERROR

    private String message;

    private String paymentUrl;    // dla płatności kartą

    private String redirectUrl;   // dla voucherów (bezpośrednio do PDF)

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public TestProcessingStatus(String testId) {
        this.testId = testId;
        this.status = "SUBMITTED";
        this.message = "Test został przesłany";
    }

    public TestProcessingStatus(String testId, String status, String message) {
        this.testId = testId;
        this.status = status;
        this.message = message;
    }

    public TestProcessingStatus(String testId, String status, String message, 
                               String paymentUrl, String redirectUrl) {
        this.testId = testId;
        this.status = status;
        this.message = message;
        this.paymentUrl = paymentUrl;
        this.redirectUrl = redirectUrl;
    }
}