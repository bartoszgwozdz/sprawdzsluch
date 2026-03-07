package dev.gwozdz.sprawdzsluch.payments.handler;

import dev.gwozdz.sprawdzsluch.payments.service.VoucherService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("PaymentHandlerFactory")
class PaymentHandlerFactoryTest {

    private PaymentHandlerFactory factory;

    @BeforeEach
    void setUp() {
        VoucherService voucherService = new VoucherService();
        // Rejestrujemy wszystkie handlery tak jak robi to Spring
        List<PaymentHandler> handlers = List.of(
                new VoucherHandler(voucherService),
                new PayuHandler(),
                new CardHandler()
        );
        factory = new PaymentHandlerFactory(handlers);
    }

    @Test
    @DisplayName("powinien zwrócić VoucherHandler dla typu VOUCHER")
    void shouldReturnVoucherHandlerForVoucher() {
        PaymentHandler handler = factory.getHandler("VOUCHER");

        assertThat(handler).isInstanceOf(VoucherHandler.class);
    }

    @Test
    @DisplayName("powinien zwrócić PayuHandler dla typu PAYU")
    void shouldReturnPayuHandlerForPayu() {
        PaymentHandler handler = factory.getHandler("PAYU");

        assertThat(handler).isInstanceOf(PayuHandler.class);
    }

    @Test
    @DisplayName("powinien zwrócić CardHandler dla typu CARD")
    void shouldReturnCardHandlerForCard() {
        PaymentHandler handler = factory.getHandler("CARD");

        assertThat(handler).isInstanceOf(CardHandler.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"BLIK", "TRANSFER", "CASH", "", "UNKNOWN"})
    @DisplayName("powinien rzucić IllegalArgumentException dla nieznanego typu płatności")
    void shouldThrowForUnknownPaymentType(String unknownType) {
        assertThatThrownBy(() -> factory.getHandler(unknownType))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(unknownType);
    }

    @Test
    @DisplayName("powinien rzucić IllegalArgumentException dla null")
    void shouldThrowForNullPaymentType() {
        assertThatThrownBy(() -> factory.getHandler(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("typ płatności jest case-sensitive")
    void paymentTypeShouldBeCaseSensitive() {
        // handlery porównują przez equals — małe litery nie są obsługiwane
        assertThatThrownBy(() -> factory.getHandler("voucher"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> factory.getHandler("payu"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
