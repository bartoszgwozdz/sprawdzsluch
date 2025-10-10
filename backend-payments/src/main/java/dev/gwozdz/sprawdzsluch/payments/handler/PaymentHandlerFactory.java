package dev.gwozdz.sprawdzsluch.payments.handler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentHandlerFactory {

  private final List<PaymentHandler> paymentHandlers;

  /**
   * Tworzy instancję właściwego handlera płatności na podstawie typu płatności
   *
   * @param paymentType typ płatności (np. CARD, VOUCHER, PAYU)
   * @return instancja handlera obsługująca dany typ płatności
   * @throws IllegalArgumentException jeśli nie znaleziono handlera dla danego typu płatności
   */
  public PaymentHandler getHandler(String paymentType) {
    return paymentHandlers.stream()
        .filter(handler -> handler.supports(paymentType))
        .findFirst()
        .orElseThrow(() -> {
          log.error("Nie znaleziono handlera dla typu płatności: {}", paymentType);
          return new IllegalArgumentException("Nieobsługiwany typ płatności: " + paymentType);
        });
  }
}