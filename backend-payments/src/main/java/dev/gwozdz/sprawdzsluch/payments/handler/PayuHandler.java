package dev.gwozdz.sprawdzsluch.payments.handler;

import dev.gwozdz.sprawdzsluch.payments.model.Payment;
import dev.gwozdz.sprawdzsluch.payments.model.PaymentStatus;
import java.math.BigDecimal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
public class PayuHandler implements PaymentHandler {

  private static final String PAYMENT_TYPE = "PAYU";

  @Override
  public Payment processPayment(String testId, Payment payment) {
    log.info("Przetwarzanie płatności PayU dla testu: {}", testId);
    // Implementacja integracji z PayU

    Payment payment = new Payment();
    payment.setTestId(testId);
    payment.setPaymentMethod(PAYMENT_TYPE);
    payment.setPaymentStatus(PaymentStatus.PENDING); // Zazwyczaj płatności PayU są najpierw w statusie PENDING
    payment.setPaymentDate(LocalDateTime.now());
    payment.setAmount(BigDecimal.valueOf(50.0)); // Przykładowa kwota

    // Tutaj byłoby wywołanie API PayU

    return payment;
  }

  @Override
  public boolean supports(String paymentType) {
    return PAYMENT_TYPE.equals(paymentType);
  }
}