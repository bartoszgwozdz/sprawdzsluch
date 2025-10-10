package dev.gwozdz.sprawdzsluch.entity;

import java.time.LocalDateTime;
import java.util.Map;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "hearing_results")
@CompoundIndex(def = "{'testId': 1, 'userEmail': 1}", unique = true)
@Data
public class TestResult {

  @Id
  private String id;

  private String testId;

  private String userEmail;

  private int maxAudibleFrequency;

  private Map<Integer, Double> hearingLevels;

  private String status; // NEW, PAID, SENT

  private LocalDateTime executed;

  private String voucherCode;

  private String paymentMethod;

  @CreatedDate
  private LocalDateTime createdAt;
}



