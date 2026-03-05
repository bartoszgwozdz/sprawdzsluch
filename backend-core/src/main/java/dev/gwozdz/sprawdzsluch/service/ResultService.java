package dev.gwozdz.sprawdzsluch.service;

import dev.gwozdz.sprawdzsluch.dto.TestResultDto;
import dev.gwozdz.sprawdzsluch.entity.TestResult;
import dev.gwozdz.sprawdzsluch.repository.TestResultRepository;
import lombok.RequiredArgsConstructor;
import org.apache.commons.validator.routines.EmailValidator;
import org.apache.coyote.BadRequestException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ResultService {

  private final PaymentNotificationService paymentNotificationService;
  private final TestResultRepository resultRepository;


  public boolean processResults(TestResultDto testResultDto) throws BadRequestException {
    //validation before checking existance to avoid
    //malicious sql injection through email and testId parameters
    validateFields(testResultDto);
    checkIfExists(testResultDto);

    //save proper entity
    TestResult testResult = convertToTestResult(testResultDto);
    testResult = resultRepository.save(testResult);

    //notify backend-payments about new test result via HTTP
    paymentNotificationService.notifyPaymentService(testResult);
    return true;
  }

  //it is theoretically possible that testId can duplicate
  //what we want to avoid
  private void checkIfExists(TestResultDto dto) throws BadRequestException {

    if (resultRepository.existsByTestIdAndUserEmail(dto.getTestId(), dto.getUserEmail())) {
      throw new BadRequestException("Test ID related to this email already exists.");
    }
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

  private void validateFields(TestResultDto dto) throws BadRequestException {
    validateTestId(dto.getTestId());
    validateEmail(dto.getUserEmail());
  }

  private void validateEmail(String email) throws BadRequestException {
    if (!EmailValidator.getInstance().isValid(email)) {
      throw new BadRequestException("Incorrect email format.");
    }
  }

  private void validateTestId(String testId) throws BadRequestException {
    if (!(testId.startsWith("TEST-") && testId.length() > 21)) {
      throw new BadRequestException("Incorrect testId format.");
    }
  }
}

