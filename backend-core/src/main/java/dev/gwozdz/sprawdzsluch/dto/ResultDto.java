package dev.gwozdz.sprawdzsluch.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ResultDto {
    private String frequency;       // np. "500 Hz"
    private int leftEarDb;          // np. 20
    private String leftEarStatus;   // np. "norma", "lekki", "umiarkowany"
    private String leftEarBadgeClass; // np. "ok", "mild", "moderate"

    private int rightEarDb;
    private String rightEarStatus;
    private String rightEarBadgeClass;
}

