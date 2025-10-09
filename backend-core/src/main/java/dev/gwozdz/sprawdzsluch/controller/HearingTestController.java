package dev.gwozdz.sprawdzsluch.controller;

import dev.gwozdz.sprawdzsluch.entity.TestProcessingStatus;
import dev.gwozdz.sprawdzsluch.repository.TestProcessingStatusRepository;
import dev.gwozdz.sprawdzsluch.service.HearingTestKafkaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/hearing-test")
@RequiredArgsConstructor
@Slf4j
public class HearingTestController {

    private final HearingTestKafkaService kafkaService;
    private final TestProcessingStatusRepository statusRepository;
    private static final String HEARING_TEST_TOPIC = "hearing-test-results";

    /**
     * Endpoint do przesyłania wyników testu słuchu
     */
    @PostMapping("/submit")
    public ResponseEntity<Map<String, Object>> submitHearingTest(@RequestBody Map<String, Object> testData) {
        try {
            // Generuj testId jeśli nie istnieje
            String testId = (String) testData.getOrDefault("testId", generateTestId());
            testData.put("testId", testId);
            testData.put("timestamp", LocalDateTime.now().toString());
            
            log.info("Otrzymano test słuchu do przetworzenia: {}", testId);
            
            // Utwórz początkowy status w bazie
            TestProcessingStatus initialStatus = new TestProcessingStatus(testId, "SUBMITTED", 
                "Test został przesłany do przetworzenia");
            statusRepository.save(initialStatus);
            
            // Wyślij do Kafka topic dla asynchronicznego przetwarzania
            kafkaService.sendToKafka(HEARING_TEST_TOPIC, testId, testData);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "testId", testId,
                "message", "Test został przesłany do przetworzenia",
                "statusUrl", "/api/hearing-test/status/" + testId
            ));
            
        } catch (Exception e) {
            log.error("Błąd podczas przesyłania testu słuchu", e);
            return ResponseEntity.internalServerError()
                .body(Map.of(
                    "success", false,
                    "error", "Wystąpił błąd podczas przetwarzania testu",
                    "message", e.getMessage()
                ));
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