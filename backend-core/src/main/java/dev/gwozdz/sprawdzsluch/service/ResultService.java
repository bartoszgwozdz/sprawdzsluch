package dev.gwozdz.sprawdzsluch.service;

import dev.gwozdz.sprawdzsluch.dto.TestResultDto;
import dev.gwozdz.sprawdzsluch.entity.TestProcessingStatus;
import dev.gwozdz.sprawdzsluch.entity.TestResult;
import dev.gwozdz.sprawdzsluch.repository.TestProcessingStatusRepository;
import dev.gwozdz.sprawdzsluch.repository.TestResultRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.validator.routines.EmailValidator;
import org.apache.coyote.BadRequestException;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResultService {

  private static final Set<String> SUPPORTED_PAYMENT_METHODS = Set.of("VOUCHER", "CARD_SANDBOX", "CARD");

  private final PaymentNotificationService paymentNotificationService;
  private final TestResultRepository resultRepository;

  @Autowired(required = false)
  private TestProcessingStatusRepository statusRepository;

  // Cache testId -> wygaśnięcie, aby uniknąć zapytań do DB przy duplikatach
  private final Map<String, Instant> processedCache = new ConcurrentHashMap<>();
  private static final Duration CACHE_TTL = Duration.ofMinutes(10);

  @SuppressWarnings("null")
  public boolean processResults(TestResultDto testResultDto) throws BadRequestException {
    validateEmail(testResultDto.getUserEmail());
    normalizeAndValidatePaymentMethod(testResultDto);
    MDC.put("userEmail", testResultDto.getUserEmail());

    // testId generowany deterministycznie po stronie serwera
    String testId = generateTestId(testResultDto);
    testResultDto.setTestId(testId);
    MDC.put("testId", testId);

    updateStatus(testId, "SUBMITTED", "Test został przesłany", null, null);

    // Sprawdź cache (brak zapytania do DB dla znanych duplikatów)
    Instant cachedUntil = processedCache.get(testId);
    if (cachedUntil != null && Instant.now().isBefore(cachedUntil)) {
      log.info("testId {} w cache — idempotentna odpowiedź", testId);
      return true;
    }

    // Leniwe czyszczenie wygaśniętych wpisów
    processedCache.entrySet().removeIf(e -> Instant.now().isAfter(e.getValue()));

    // Sprawdź DB (pierwsze wywołanie lub cache wygasł)
    if (resultRepository.existsByTestIdAndUserEmail(testId, testResultDto.getUserEmail())) {
      processedCache.put(testId, Instant.now().plus(CACHE_TTL));
      log.info("testId {} istnieje w DB — idempotentna odpowiedź", testId);
      return true;
    }

    // Nowe zgłoszenie
    TestResult testResult = convertToTestResult(testResultDto);
    TestResult savedTestResult = resultRepository.save(testResult);
    if (savedTestResult != null) {
      testResult = savedTestResult;
    }
    processedCache.put(testId, Instant.now().plus(CACHE_TTL));

    updateStatus(testId, "PROCESSING", "Wynik zapisany, trwa przetwarzanie płatności", null, null);

    paymentNotificationService.notifyPaymentService(testResult);
    return true;
  }

  /**
   * UUID v3 (deterministyczny) z email + maxFrequency + posortowanych hearingLevels.
   * Ten sam zestaw danych zawsze daje ten sam testId.
   */
  private String generateTestId(TestResultDto dto) {
    String hearingStr = dto.getHearingLevels() == null ? "" :
        dto.getHearingLevels().entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(e -> e.getKey() + ":" + e.getValue())
            .collect(Collectors.joining(","));

    String raw = dto.getUserEmail() + "|" + dto.getMaxAudibleFrequency() + "|" + hearingStr;
    String uuid = UUID.nameUUIDFromBytes(raw.getBytes(StandardCharsets.UTF_8))
        .toString().replace("-", "").toUpperCase();
    return "TEST-" + uuid;
  }

  private TestResult convertToTestResult(TestResultDto dto) throws BadRequestException {
    if (dto.getMaxAudibleFrequency() < 1000 || dto.getMaxAudibleFrequency() > 20000) {
      throw new BadRequestException("Max audible frequency must be between 1000 and 20000 Hz.");
    }

    validateHearingLevels(dto.getHearingLevels());

    TestResult testResult = new TestResult();
    testResult.setTestId(dto.getTestId());
    testResult.setUserEmail(dto.getUserEmail());
    testResult.setMaxAudibleFrequency(dto.getMaxAudibleFrequency());
    testResult.setHearingLevels(dto.getHearingLevels());
    testResult.setPaymentMethod(dto.getPaymentMethod());
    testResult.setVoucherCode(dto.getVoucherCode());
    testResult.setStatus("NEW");

    return testResult;
  }

  private void validateEmail(String email) throws BadRequestException {
    if (!EmailValidator.getInstance().isValid(email)) {
      throw new BadRequestException("Incorrect email format.");
    }
  }

  private void normalizeAndValidatePaymentMethod(TestResultDto dto) throws BadRequestException {
    String rawMethod = dto.getPaymentMethod() == null ? "" : dto.getPaymentMethod().trim();
    String method = rawMethod.toUpperCase(Locale.ROOT);

    if (!SUPPORTED_PAYMENT_METHODS.contains(method)) {
      throw new BadRequestException("Unsupported payment method.");
    }

    if ("CARD".equals(method)) {
      method = "CARD_SANDBOX";
    }

    if ("VOUCHER".equals(method)) {
      String voucherCode = dto.getVoucherCode() == null ? "" : dto.getVoucherCode().trim();
      if (voucherCode.isEmpty()) {
        throw new BadRequestException("Voucher code is required for VOUCHER payment.");
      }
      dto.setVoucherCode(voucherCode);
    }

    dto.setPaymentMethod(method);
  }

  private void validateHearingLevels(Map<Integer, Double> hearingLevels) throws BadRequestException {
    if (hearingLevels == null || hearingLevels.isEmpty()) {
      throw new BadRequestException("Hearing levels are required.");
    }

    for (Map.Entry<Integer, Double> entry : hearingLevels.entrySet()) {
      Integer frequency = entry.getKey();
      Double gain = entry.getValue();

      if (frequency == null || frequency < 20 || frequency > 20000) {
        throw new BadRequestException("Frequency must be between 20 and 20000 Hz.");
      }

      if (gain == null || !Double.isFinite(gain) || gain < -120.0 || gain > 120.0) {
        throw new BadRequestException("Gain must be in range [-120.0, 120.0].");
      }
    }
  }

  private void updateStatus(String testId, String status, String message, String paymentUrl,
      String redirectUrl) {
    if (statusRepository == null) {
      return;
    }

    TestProcessingStatus processingStatus = statusRepository.findByTestId(testId)
        .orElse(new TestProcessingStatus(testId));
    processingStatus.setStatus(status);
    processingStatus.setMessage(message);
    processingStatus.setPaymentUrl(paymentUrl);
    processingStatus.setRedirectUrl(redirectUrl);
    statusRepository.save(processingStatus);
  }
}
