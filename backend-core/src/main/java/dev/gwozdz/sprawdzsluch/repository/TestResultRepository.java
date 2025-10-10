package dev.gwozdz.sprawdzsluch.repository;

import dev.gwozdz.sprawdzsluch.entity.TestResult;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface TestResultRepository extends MongoRepository<TestResult, String> {

  // Wykorzystuje indeks złożony: testId + userEmail (unikalny)
  Optional<TestResult> findByTestIdAndUserEmail(String testId, String userEmail);

  // Wykorzystuje indeks złożony: testId (prefix)
  Optional<TestResult> findByTestId(String testId);

  // Wykorzystuje indeks złożony: userEmail + status
  List<TestResult> findByUserEmailAndStatus(String userEmail, String status);

  // Wszystkie wyniki użytkownika (sortowane po dacie)
  List<TestResult> findByUserEmailOrderByCreatedAtDesc(String userEmail);

  // Wykorzystuje indeks złożony: status + createdAt (sortowanie)
  List<TestResult> findByStatusOrderByCreatedAtDesc(String status);

  // Wyniki w danym przedziale czasowym dla statusu
  List<TestResult> findByStatusAndCreatedAtBetweenOrderByCreatedAtDesc(
      String status, LocalDateTime startDate, LocalDateTime endDate);

  // Liczba wyników dla użytkownika według statusu
  long countByUserEmailAndStatus(String userEmail, String status);

  // Sprawdzenie czy testId już istnieje dla użytkownika
  boolean existsByTestIdAndUserEmail(String testId, String userEmail);

  // Custom query - najnowsze wyniki według statusu (z limitem)
  @Query(value = "{ 'status': ?0 }", sort = "{ 'createdAt': -1 }")
  List<TestResult> findTopByStatusOrderByCreatedAtDesc(String status);
}
