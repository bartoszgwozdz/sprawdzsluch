package dev.gwozdz.sprawdzsluch.dto;

import java.time.LocalDateTime;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TestResultDto {

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

