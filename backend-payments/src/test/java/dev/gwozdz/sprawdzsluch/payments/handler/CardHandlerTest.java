package dev.gwozdz.sprawdzsluch.payments.handler;

import dev.gwozdz.sprawdzsluch.payments.model.Payment;
import dev.gwozdz.sprawdzsluch.payments.model.PaymentStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("CardHandler")
class CardHandlerTest {

    private CardHandler cardHandler;
    private Payment payment;

    @BeforeEach
    void setUp() {
        cardHandler = new CardHandler();
        payment = new Payment();
        payment.setTestId("TEST-XYZ789");
        payment.setUserEmail("card@example.com");
    }

    @Test
    @DisplayName("powinien ustawić status COMPLETED dla płatności kartą")
    void shouldSetStatusCompleted() {
        Payment result = cardHandler.processPayment("TEST-XYZ789", payment);

        assertThat(result.getPaymentStatus()).isEqualTo(PaymentStatus.COMPLETED);
    }

    @Test
    @DisplayName("powinien ustawić metodę płatności CARD")
    void shouldSetPaymentMethodToCard() {
        Payment result = cardHandler.processPayment("TEST-XYZ789", payment);

        assertThat(result.getPaymentMethod()).isEqualTo("CARD");
    }

    @Test
    @DisplayName("powinien ustawić kwotę 50.0")
    void shouldSetAmount() {
        Payment result = cardHandler.processPayment("TEST-XYZ789", payment);

        assertThat(result.getAmount()).isEqualByComparingTo(new BigDecimal("50.0"));
    }

    @Test
    @DisplayName("powinien ustawić datę płatności")
    void shouldSetPaymentDate() {
        Payment result = cardHandler.processPayment("TEST-XYZ789", payment);

        assertThat(result.getPaymentDate()).isNotNull();
    }

    @Test
    @DisplayName("supports powinien zwrócić true tylko dla CARD")
    void shouldSupportOnlyCardType() {
        assertThat(cardHandler.supports("CARD")).isTrue();
        assertThat(cardHandler.supports("PAYU")).isFalse();
        assertThat(cardHandler.supports("VOUCHER")).isFalse();
        assertThat(cardHandler.supports("card")).isFalse();
        assertThat(cardHandler.supports(null)).isFalse();
    }
}
