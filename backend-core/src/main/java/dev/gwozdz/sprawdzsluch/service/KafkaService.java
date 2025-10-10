package dev.gwozdz.sprawdzsluch.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.gwozdz.sprawdzsluch.entity.TestProcessingStatus;
import dev.gwozdz.sprawdzsluch.repository.TestProcessingStatusRepository;
import java.time.LocalDateTime;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class KafkaService {

  private final KafkaTemplate<String, String> kafkaTemplate;
  private final ObjectMapper objectMapper;
  private final TestProcessingStatusRepository statusRepository;

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

      // KROK 3: Update status na PROCESSED
      updateTestStatus(testId, "PROCESSED", "Wyniki zostały zapisane");

      // Symulacja dodatkowego processing
      Thread.sleep(800);

      // KROK 4: Sprawdź metodę płatności i podejmij decyzję
      String paymentMethod = (String) testData.get("paymentMethod");
      if ("voucher".equals(paymentMethod)) {
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