package dev.gwozdz.sprawdzsluch.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.gwozdz.sprawdzsluch.entity.HearingResult;
import dev.gwozdz.sprawdzsluch.entity.TestProcessingStatus;
import dev.gwozdz.sprawdzsluch.repository.TestProcessingStatusRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class HearingTestKafkaService {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final TestProcessingStatusRepository statusRepository;
    private final ResultService resultService;
    
    private static final String HEARING_TEST_TOPIC = "hearing-test-results";

    /**
     * Wysyła dane testu do Kafka topic
     */
    public void sendToKafka(String topic, String key, Object data) {
        try {
            String jsonData = objectMapper.writeValueAsString(data);
            kafkaTemplate.send(topic, key, jsonData);
            log.info("Wysłano do Kafka topic '{}' z kluczem '{}'", topic, key);
        } catch (JsonProcessingException e) {
            log.error("Błąd serializacji danych dla Kafka", e);
            throw new RuntimeException("Błąd podczas wysyłania do Kafka", e);
        }
    }

    /**
     * Kafka Consumer - przetwarza wyniki testu słuchu
     */
    @KafkaListener(topics = HEARING_TEST_TOPIC, groupId = "sprawdzsluch-consumer-group")
    public void processHearingTestResults(String message) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> testData = objectMapper.readValue(message, Map.class);
            String testId = (String) testData.get("testId");
            
            log.info("Przetwarzanie testu słuchu: {}", testId);
            
            // KROK 1: Update status na PROCESSING
            updateTestStatus(testId, "PROCESSING", "Przetwarzanie wyników testu...");
            
            // Symulacja processing time
            Thread.sleep(1500);
            
            // KROK 2: Zapisz wyniki do bazy danych
            saveTestToDatabase(testData);
            
            // KROK 3: Update status na PROCESSED
            updateTestStatus(testId, "PROCESSED", "Wyniki zostały zapisane");
            
            // Symulacja dodatkowego processing
            Thread.sleep(800);
            
            // KROK 4: Sprawdź metodę płatności i podejmij decyzję
            String paymentMethod = (String) testData.get("paymentMethod");
            if ("voucher".equals(paymentMethod)) {
                handleVoucherPayment(testId, testData);
            } else {
                handleCardPayment(testId, testData);
            }
            
        } catch (Exception e) {
            log.error("Błąd podczas przetwarzania testu słuchu", e);
            String testId = extractTestIdFromMessage(message);
            if (testId != null) {
                updateTestStatus(testId, "ERROR", "Wystąpił błąd podczas przetwarzania: " + e.getMessage());
            }
        }
    }

    /**
     * Zapisuje wyniki testu do bazy danych MongoDB
     */
    private void saveTestToDatabase(Map<String, Object> testData) {
        try {
            HearingResult hearingResult = new HearingResult();
            hearingResult.setTestId((String) testData.get("testId"));
            hearingResult.setUserEmail((String) testData.get("userEmail"));
            hearingResult.setMaxAudibleFrequency((Integer) testData.get("maxAudibleFrequency"));
            hearingResult.setPaymentMethod((String) testData.get("paymentMethod"));
            hearingResult.setStatus("NEW");
            
            if (testData.get("voucherCode") != null) {
                hearingResult.setVoucherCode((String) testData.get("voucherCode"));
            }
            
            // Konwertuj executed string do LocalDateTime jeśli istnieje
            if (testData.get("executed") != null) {
                hearingResult.setExecuted(LocalDateTime.parse((String) testData.get("executed")));
            }
            
            // Konwertuj hearingLevels z array do Map<Integer, Double>
            if (testData.get("hearingLevels") instanceof List) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> hearingLevelsList = (List<Map<String, Object>>) testData.get("hearingLevels");
                Map<Integer, Double> hearingLevelsMap = new HashMap<>();
                
                for (Map<String, Object> level : hearingLevelsList) {
                    Integer frequency = (Integer) level.get("frequency");
                    Double gain = ((Number) level.get("gain")).doubleValue();
                    hearingLevelsMap.put(frequency, gain);
                }
                
                hearingResult.setHearingLevels(hearingLevelsMap);
            }
            
            resultService.save(hearingResult);
            log.info("Zapisano wyniki testu do bazy: {}", hearingResult.getTestId());
            
        } catch (Exception e) {
            log.error("Błąd podczas zapisywania wyników testu do bazy", e);
            throw e;
        }
    }

    /**
     * Obsługuje płatność voucher
     */
    private void handleVoucherPayment(String testId, Map<String, Object> testData) {
        String voucherCode = (String) testData.get("voucherCode");
        
        if (isValidVoucher(voucherCode)) {
            String redirectUrl = "/report/pdf?testId=" + testId;
            updateTestStatus(testId, "COMPLETED", "Voucher został zaakceptowany. Przekierowywanie do raportu...", 
                           null, redirectUrl);
            log.info("Voucher payment completed for test: {}", testId);
        } else {
            updateTestStatus(testId, "ERROR", "Nieprawidłowy kod voucher: " + voucherCode);
            log.warn("Invalid voucher code for test {}: {}", testId, voucherCode);
        }
    }

    /**
     * Obsługuje płatność kartą
     */
    private void handleCardPayment(String testId, Map<String, Object> testData) {
        try {
            // TODO: Integracja z PayNow API - na razie symulacja
            String paymentUrl = "https://sandbox.paynow.pl/payment/" + testId + "?amount=24.99";
            
            updateTestStatus(testId, "PAYMENT_REQUIRED", "Wymagana płatność kartą. Przekierowywanie...", 
                           paymentUrl, null);
            log.info("Card payment required for test: {}", testId);
            
        } catch (Exception e) {
            log.error("Błąd podczas tworzenia płatności kartą", e);
            updateTestStatus(testId, "ERROR", "Błąd podczas tworzenia płatności");
        }
    }

    /**
     * Aktualizuje status przetwarzania testu
     */
    private void updateTestStatus(String testId, String status, String message) {
        updateTestStatus(testId, status, message, null, null);
    }

    private void updateTestStatus(String testId, String status, String message, 
                                String paymentUrl, String redirectUrl) {
        try {
            TestProcessingStatus statusEntity = statusRepository.findByTestId(testId)
                .orElse(new TestProcessingStatus(testId));
            
            statusEntity.setStatus(status);
            statusEntity.setMessage(message);
            statusEntity.setPaymentUrl(paymentUrl);
            statusEntity.setRedirectUrl(redirectUrl);
            statusEntity.setUpdatedAt(LocalDateTime.now());
            
            statusRepository.save(statusEntity);
            log.debug("Updated status for test {}: {} - {}", testId, status, message);
            
        } catch (Exception e) {
            log.error("Błąd podczas aktualizacji statusu testu: {}", testId, e);
        }
    }

    /**
     * Walidacja voucher - na razie prosta implementacja
     */
    private boolean isValidVoucher(String voucherCode) {
        // TODO: Implement proper voucher validation
        return "TEST123".equals(voucherCode) || 
               "VALID".equals(voucherCode) || 
               "DEMO".equals(voucherCode);
    }

    /**
     * Helper method do wyciągnięcia testId z niepoprawnej wiadomości
     */
    private String extractTestIdFromMessage(String message) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(message, Map.class);
            return (String) data.get("testId");
        } catch (Exception e) {
            log.warn("Nie można wyciągnąć testId z wiadomości", e);
            return null;
        }
    }
}