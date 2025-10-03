package dev.gwozdz.audiogram.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Data
public class HearingResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String userEmail;

    @Lob
    private String payloadJson;

    private String status; // NEW, PAID, SENT

    @ManyToOne
    private Payment payment;

    private LocalDateTime createdAt = LocalDateTime.now();
}



