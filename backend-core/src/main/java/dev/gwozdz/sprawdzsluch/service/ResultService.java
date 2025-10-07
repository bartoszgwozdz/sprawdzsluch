package dev.gwozdz.sprawdzsluch.service;

import dev.gwozdz.sprawdzsluch.entity.HearingResult;
import dev.gwozdz.sprawdzsluch.repository.HearingResultRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ResultService {
    private final HearingResultRepository repo;

    public ResultService(HearingResultRepository repo) {
        this.repo = repo;
    }

    public HearingResult save(HearingResult result) {
        return repo.save(result);
    }

    public HearingResult find(String id) {
        return repo.findById(id).orElseThrow();
    }

    // Wykorzystuje indeks złożony: testId + userEmail
    public Optional<HearingResult> findByTestIdAndUserEmail(String testId, String userEmail) {
        return repo.findByTestIdAndUserEmail(testId, userEmail);
    }

    // Wykorzystuje indeks: testId (prefix indeksu złożonego)
    public Optional<HearingResult> findByTestId(String testId) {
        return repo.findByTestId(testId);
    }

    // Wszystkie wyniki użytkownika według statusu (wykorzystuje indeks)
    public List<HearingResult> getUserResultsByStatus(String userEmail, String status) {
        return repo.findByUserEmailAndStatus(userEmail, status);
    }

    // Historia użytkownika (sortowana po dacie)
    public List<HearingResult> getUserHistory(String userEmail) {
        return repo.findByUserEmailOrderByCreatedAtDesc(userEmail);
    }

    // Wyniki według statusu (wykorzystuje indeks z sortowaniem)
    public List<HearingResult> getResultsByStatus(String status) {
        return repo.findByStatusOrderByCreatedAtDesc(status);
    }

    // Wyniki w przedziale czasowym dla statusu
    public List<HearingResult> getResultsByStatusAndDateRange(String status, LocalDateTime startDate, LocalDateTime endDate) {
        return repo.findByStatusAndCreatedAtBetweenOrderByCreatedAtDesc(status, startDate, endDate);
    }

    // Statystyki użytkownika
    public long countUserResultsByStatus(String userEmail, String status) {
        return repo.countByUserEmailAndStatus(userEmail, status);
    }

    // Sprawdzenie unikalności testId dla użytkownika
    public boolean isTestIdUniqueForUser(String testId, String userEmail) {
        return !repo.existsByTestIdAndUserEmail(testId, userEmail);
    }

    // Bezpieczne zapisywanie z sprawdzeniem unikalności
    public HearingResult saveWithUniqueCheck(HearingResult result) {
        if (!isTestIdUniqueForUser(result.getTestId(), result.getUserEmail())) {
            throw new IllegalArgumentException(
                String.format("TestId '%s' already exists for user '%s'", 
                    result.getTestId(), result.getUserEmail())
            );
        }
        return repo.save(result);
    }

    // Panel administratora - najnowsze wyniki według statusu
    public List<HearingResult> getLatestResultsByStatus(String status) {
        return repo.findTopByStatusOrderByCreatedAtDesc(status);
    }

    public Map<String, Object> getVariablesFromResult(HearingResult result) {
        return HashMap.newHashMap(1);
    }
}

