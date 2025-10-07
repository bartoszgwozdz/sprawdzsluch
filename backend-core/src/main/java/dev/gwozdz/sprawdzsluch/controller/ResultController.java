package dev.gwozdz.sprawdzsluch.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import dev.gwozdz.sprawdzsluch.entity.HearingResult;
import dev.gwozdz.sprawdzsluch.service.ResultService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/results")
public class ResultController {
    private final ResultService resultService;

    public ResultController(ResultService resultService) {
        this.resultService = resultService;
    }

    @PostMapping
    public ResponseEntity<HearingResult> save(@RequestBody HearingResult result) {
        try {
            result.setStatus("NEW");
            HearingResult savedResult = resultService.saveWithUniqueCheck(result);
            return ResponseEntity.ok(savedResult);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // Wykorzystuje indeks złożony: testId + userEmail (najczęściej używane)
    @GetMapping("/test/{testId}/user/{userEmail}")
    public ResponseEntity<HearingResult> getByTestIdAndUserEmail(
            @PathVariable String testId, 
            @PathVariable String userEmail) {
        return resultService.findByTestIdAndUserEmail(testId, userEmail)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Wykorzystuje indeks: testId (prefix indeksu złożonego)
    @GetMapping("/test/{testId}")
    public ResponseEntity<HearingResult> getByTestId(@PathVariable String testId) {
        return resultService.findByTestId(testId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Historia użytkownika - wykorzystuje indeks
    @GetMapping("/user/{userEmail}")
    public List<HearingResult> getUserHistory(@PathVariable String userEmail) {
        return resultService.getUserHistory(userEmail);
    }

    // Wyniki użytkownika według statusu - wykorzystuje indeks złożony
    @GetMapping("/user/{userEmail}/status/{status}")
    public List<HearingResult> getUserResultsByStatus(
            @PathVariable String userEmail, 
            @PathVariable String status) {
        return resultService.getUserResultsByStatus(userEmail, status);
    }

    // Panel administratora - wykorzystuje indeks z sortowaniem
    @GetMapping("/status/{status}")
    public List<HearingResult> getResultsByStatus(@PathVariable String status) {
        return resultService.getResultsByStatus(status);
    }

    // Statystyki użytkownika
    @GetMapping("/user/{userEmail}/status/{status}/count")
    public Map<String, Long> getUserStatsForStatus(
            @PathVariable String userEmail, 
            @PathVariable String status) {
        long count = resultService.countUserResultsByStatus(userEmail, status);
        return Map.of("count", count);
    }

    // Sprawdzenie unikalności testId dla użytkownika
    @GetMapping("/test/{testId}/user/{userEmail}/unique")
    public Map<String, Boolean> checkTestIdUnique(
            @PathVariable String testId, 
            @PathVariable String userEmail) {
        boolean isUnique = resultService.isTestIdUniqueForUser(testId, userEmail);
        return Map.of("isUnique", isUnique);
    }

    // Najnowsze wyniki według statusu (dla panelu admina)
    @GetMapping("/latest/status/{status}")
    public List<HearingResult> getLatestByStatus(@PathVariable String status) {
        return resultService.getLatestResultsByStatus(status);
    }
}

