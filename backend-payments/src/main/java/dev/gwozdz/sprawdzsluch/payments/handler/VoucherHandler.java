package dev.gwozdz.sprawdzsluch.payments.handler;

import dev.gwozdz.sprawdzsluch.payments.model.Payment;
import dev.gwozdz.sprawdzsluch.payments.model.PaymentStatus;
import dev.gwozdz.sprawdzsluch.payments.service.VoucherService;
import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class VoucherHandler implements PaymentHandler {

  private static final String PAYMENT_TYPE = "VOUCHER";
  private final VoucherService voucherService;

  @Override
  public Payment processPayment(String testId, Payment voucherCode) {
    log.info("Przetwarzanie płatności voucherem dla testu: {}", testId);

    // Sprawdź czy voucher jest ważny przez voucherService
    boolean isVoucherValid = voucherService.validateVoucher(voucherCode);

    Payment payment = new Payment();
    payment.setTestId(testId);
    payment.setPaymentMethod(PAYMENT_TYPE);
    payment.setPaymentDate(LocalDateTime.now());
    payment.setAmount(BigDecimal.valueOf(0.0)); // Voucher zazwyczaj oznacza darmową usługę

    if (isVoucherValid) {
      payment.setPaymentStatus(PaymentStatus.COMPLETED);
//      voucherService.useVoucher(voucherCode);
    } else {
      payment.setPaymentStatus(PaymentStatus.FAILED);
    }

    return payment;
  }

  @Override
  public boolean supports(String paymentType) {
    return PAYMENT_TYPE.equals(paymentType);
  }
}