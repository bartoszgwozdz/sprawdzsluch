package dev.gwozdz.audiogram.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReportDto {
    private String id;
    private LocalDate date;
    private String method;
    private int minFreq;   // np. 100
    private int maxFreq;   // np. 13000
    private int avgLeft;
    private String leftSummary;
    private int avgRight;
    private String rightSummary;
    private String recommendation;
}

