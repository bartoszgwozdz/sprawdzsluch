package dev.gwozdz.sprawdzsluch.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DocumentReference;

import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "hearing_results")
@CompoundIndex(def = "{'testId': 1, 'userEmail': 1}", unique = true)
@CompoundIndex(def = "{'userEmail': 1, 'status': 1}")
@CompoundIndex(def = "{'status': 1, 'createdAt': -1}")
@Data
public class HearingResult {

    @Id
    private String id;

    private String testId;
    
    private String userEmail;

    private int maxAudibleFrequency;

    private Map<Integer, Double> hearingLevels;

    private String payloadJson;

    private String status; // NEW, PAID, SENT

    @DocumentReference
    private Payment payment;

    private LocalDateTime executed;

    private String voucherCode;
}



