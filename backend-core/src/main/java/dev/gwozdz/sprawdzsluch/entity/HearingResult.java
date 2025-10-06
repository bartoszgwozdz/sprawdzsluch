package dev.gwozdz.sprawdzsluch.entity;

import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import lombok.Data;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.time.LocalDateTime;

@Document(collection = "hearing_results")
@Data
public class HearingResult {

    @Id
    private Long id;

    private String userEmail;

    @Lob
    private String payloadJson;

    private String status; // NEW, PAID, SENT

    @DocumentReference
    private Payment payment;

    private LocalDateTime createdAt = LocalDateTime.now();
}



