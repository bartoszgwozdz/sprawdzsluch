package dev.gwozdz.sprawdzsluch.payments.handler;

import dev.gwozdz.sprawdzsluch.payments.model.Payment;

public interface PaymentHandler {
  /**
   * Przetwarza płatność na podstawie przekazanych danych
   *
   * @param testId  id testu, dla którego jest przetwarzana płatność
   * @param payment dane płatności specyficzne dla danego typu płatności
   * @return obiekt Payment po przetworzeniu
   */
  Payment processPayment(String testId, Payment payment);

  /**
   * Sprawdza, czy ten handler obsługuje dany typ płatności
   *
   * @param paymentType typ płatności do obsługi
   * @return true jeśli handler obsługuje dany typ płatności
   */
  boolean supports(String paymentType);
}