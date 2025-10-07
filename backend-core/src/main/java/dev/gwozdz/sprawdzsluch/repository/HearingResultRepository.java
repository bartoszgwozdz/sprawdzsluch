package dev.gwozdz.sprawdzsluch.repository;

import dev.gwozdz.sprawdzsluch.entity.HearingResult;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface HearingResultRepository extends MongoRepository<HearingResult, String> {

    // Wykorzystuje indeks złożony: testId + userEmail (unikalny)
    Optional<HearingResult> findByTestIdAndUserEmail(String testId, String userEmail);

    // Wykorzystuje indeks złożony: testId (prefix)
    Optional<HearingResult> findByTestId(String testId);

    // Wykorzystuje indeks złożony: userEmail + status
    List<HearingResult> findByUserEmailAndStatus(String userEmail, String status);

    // Wszystkie wyniki użytkownika (sortowane po dacie)
    List<HearingResult> findByUserEmailOrderByCreatedAtDesc(String userEmail);

    // Wykorzystuje indeks złożony: status + createdAt (sortowanie)
    List<HearingResult> findByStatusOrderByCreatedAtDesc(String status);

    // Wyniki w danym przedziale czasowym dla statusu
    List<HearingResult> findByStatusAndCreatedAtBetweenOrderByCreatedAtDesc(
            String status, LocalDateTime startDate, LocalDateTime endDate);

    // Liczba wyników dla użytkownika według statusu
    long countByUserEmailAndStatus(String userEmail, String status);

    // Sprawdzenie czy testId już istnieje dla użytkownika
    boolean existsByTestIdAndUserEmail(String testId, String userEmail);

    // Custom query - najnowsze wyniki według statusu (z limitem)
    @Query(value = "{ 'status': ?0 }", sort = "{ 'createdAt': -1 }")
    List<HearingResult> findTopByStatusOrderByCreatedAtDesc(String status);
}
