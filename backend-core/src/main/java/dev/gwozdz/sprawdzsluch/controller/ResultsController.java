package dev.gwozdz.sprawdzsluch.controller;

import dev.gwozdz.sprawdzsluch.dto.TestResultDto;
import dev.gwozdz.sprawdzsluch.entity.TestProcessingStatus;
import dev.gwozdz.sprawdzsluch.repository.TestProcessingStatusRepository;
import dev.gwozdz.sprawdzsluch.service.ResultService;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/results")
@RequiredArgsConstructor
@Slf4j
public class ResultsController {

  private final ResultService resultService;
  private final TestProcessingStatusRepository statusRepository;

  /**
   * Endpoint do przesyłania wyników testu słuchu
   */
  @PostMapping("/submit")
  public ResponseEntity<Map<String, Object>> submitHearingTest(
      @RequestBody TestResultDto testData) {
    try {
      log.info("Received test result: {}", testData.getTestId());
      resultService.processResults(testData);
      return ResponseEntity.ok(Map.of(
          "success", true,
          "testId", testData.getTestId(),
          "statusUrl", "/api/results/status/" + testData.getTestId()
      ));
    } catch (Exception e) {
      log.error(e.getMessage(), e);
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
  }

  /**
   * Endpoint do sprawdzania statusu przetwarzania testu
   */
  @GetMapping("/status/{testId}")
  public ResponseEntity<TestProcessingStatus> getTestStatus(@PathVariable String testId) {
    log.debug("Sprawdzanie statusu testu: {}", testId);

    return statusRepository.findByTestId(testId)
        .map(status -> {
          log.debug("Status testu {}: {}", testId, status.getStatus());
          return ResponseEntity.ok(status);
        })
        .orElseGet(() -> {
          log.warn("Nie znaleziono statusu dla testu: {}", testId);
          return ResponseEntity.notFound().build();
        });
  }

  /**
   * Endpoint pomocniczy do sprawdzania wszystkich statusów (dla debugowania)
   */
  @GetMapping("/status")
  public ResponseEntity<Map<String, Object>> getAllStatuses() {
    try {
      var allStatuses = statusRepository.findAll();
      return ResponseEntity.ok(Map.of(
          "count", allStatuses.size(),
          "statuses", allStatuses
      ));
    } catch (Exception e) {
      log.error("Błąd podczas pobierania wszystkich statusów", e);
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Błąd podczas pobierania statusów"));
    }
  }

  /**
   * Endpoint do ręcznego uruchomienia przetwarzania (dla testów)
   */
  @PostMapping("/reprocess/{testId}")
  public ResponseEntity<Map<String, Object>> reprocessTest(@PathVariable String testId) {
    try {
      var status = statusRepository.findByTestId(testId);
      if (status.isEmpty()) {
        return ResponseEntity.notFound().build();
      }

      // Reset status i wyślij ponownie do Kafka
      TestProcessingStatus resetStatus = status.get();
      resetStatus.setStatus("SUBMITTED");
      resetStatus.setMessage("Test przesłany ponownie do przetworzenia");
      resetStatus.setPaymentUrl(null);
      resetStatus.setRedirectUrl(null);
      statusRepository.save(resetStatus);

      // Tutaj moglibyśmy ponownie wysłać do Kafka, ale na razie tylko resetujemy status

      return ResponseEntity.ok(Map.of(
          "success", true,
          "message", "Test został przesłany ponownie do przetworzenia",
          "testId", testId
      ));

    } catch (Exception e) {
      log.error("Błąd podczas ponownego przetwarzania testu: {}", testId, e);
      return ResponseEntity.internalServerError()
          .body(Map.of("error", "Błąd podczas ponownego przetwarzania"));
    }
  }

  /**
   * Generuje unikalny ID testu
   */
  private String generateTestId() {
    return "TEST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
  }
}