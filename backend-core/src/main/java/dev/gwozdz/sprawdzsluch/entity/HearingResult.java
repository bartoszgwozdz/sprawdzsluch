package dev.gwozdz.sprawdzsluch.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.time.LocalDateTime;

@Document(collection = "hearing_results")
@Data
public class HearingResult {

    @Id
    private String id;

    private String testId;

    private String userEmail;

    private String payloadJson; 

    private String status; // NEW, PAID, SENT

    @DocumentReference
    private Payment payment;

    private LocalDateTime createdAt = LocalDateTime.now();
}



