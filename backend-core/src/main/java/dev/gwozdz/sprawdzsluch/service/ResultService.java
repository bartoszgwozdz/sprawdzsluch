package dev.gwozdz.sprawdzsluch.service;

import dev.gwozdz.sprawdzsluch.dto.TestResultDto;
import dev.gwozdz.sprawdzsluch.entity.TestResult;
import dev.gwozdz.sprawdzsluch.repository.TestResultRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.validator.routines.EmailValidator;
import org.apache.coyote.BadRequestException;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResultService {

  private final PaymentNotificationService paymentNotificationService;
  private final TestResultRepository resultRepository;

  // Cache testId -> wygaśnięcie, aby uniknąć zapytań do DB przy duplikatach
  private final Map<String, Instant> processedCache = new ConcurrentHashMap<>();
  private static final Duration CACHE_TTL = Duration.ofMinutes(10);

  public boolean processResults(TestResultDto testResultDto) throws BadRequestException {
    validateEmail(testResultDto.getUserEmail());
    MDC.put("userEmail", testResultDto.getUserEmail());

    // testId generowany deterministycznie po stronie serwera
    String testId = generateTestId(testResultDto);
    testResultDto.setTestId(testId);
    MDC.put("testId", testId);

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
    testResult = resultRepository.save(testResult);
    processedCache.put(testId, Instant.now().plus(CACHE_TTL));

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
    if (dto.getMaxAudibleFrequency() < 1000) {
      throw new BadRequestException("Max audible frequency cannot be negative.");
    }

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
}
