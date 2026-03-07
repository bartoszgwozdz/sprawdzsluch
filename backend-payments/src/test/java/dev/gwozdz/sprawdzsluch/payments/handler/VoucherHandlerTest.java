package dev.gwozdz.sprawdzsluch.payments.handler;

import dev.gwozdz.sprawdzsluch.payments.model.Payment;
import dev.gwozdz.sprawdzsluch.payments.model.PaymentStatus;
import dev.gwozdz.sprawdzsluch.payments.service.VoucherService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("VoucherHandler")
class VoucherHandlerTest {

    @Mock
    private VoucherService voucherService;

    @InjectMocks
    private VoucherHandler voucherHandler;

    private Payment payment;

    @BeforeEach
    void setUp() {
        payment = new Payment();
        payment.setTestId("TEST-ABC123");
        payment.setUserEmail("test@example.com");
        payment.setVoucherCode("REKRUTACJA");
    }

    @Nested
    @DisplayName("processPayment - prawidłowy voucher")
    class ValidVoucher {

        @BeforeEach
        void mockValid() {
            when(voucherService.validateVoucher("REKRUTACJA")).thenReturn(true);
        }

        @Test
        @DisplayName("powinien ustawić status COMPLETED")
        void shouldSetStatusCompleted() {
            Payment result = voucherHandler.processPayment("TEST-ABC123", payment);

            assertThat(result.getPaymentStatus()).isEqualTo(PaymentStatus.COMPLETED);
        }

        @Test
        @DisplayName("powinien ustawić kwotę 0")
        void shouldSetAmountToZero() {
            Payment result = voucherHandler.processPayment("TEST-ABC123", payment);

            assertThat(result.getAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        }

        @Test
        @DisplayName("powinien ustawić metodę płatności VOUCHER")
        void shouldSetPaymentMethodToVoucher() {
            Payment result = voucherHandler.processPayment("TEST-ABC123", payment);

            assertThat(result.getPaymentMethod()).isEqualTo("VOUCHER");
        }

        @Test
        @DisplayName("powinien ustawić datę płatności")
        void shouldSetPaymentDate() {
            Payment result = voucherHandler.processPayment("TEST-ABC123", payment);

            assertThat(result.getPaymentDate()).isNotNull();
        }
    }

    @Nested
    @DisplayName("processPayment - nieprawidłowy voucher")
    class InvalidVoucher {

        @BeforeEach
        void mockInvalid() {
            when(voucherService.validateVoucher("REKRUTACJA")).thenReturn(false);
        }

        @Test
        @DisplayName("powinien ustawić status FAILED")
        void shouldSetStatusFailed() {
            Payment result = voucherHandler.processPayment("TEST-ABC123", payment);

            assertThat(result.getPaymentStatus()).isEqualTo(PaymentStatus.FAILED);
        }

        @Test
        @DisplayName("powinien ustawić kwotę 0 nawet gdy voucher nieprawidłowy")
        void shouldSetAmountToZeroEvenWhenInvalid() {
            Payment result = voucherHandler.processPayment("TEST-ABC123", payment);

            assertThat(result.getAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        }

        @Test
        @DisplayName("powinien ustawić metodę płatności VOUCHER nawet gdy nieprawidłowy")
        void shouldSetPaymentMethodEvenWhenInvalid() {
            Payment result = voucherHandler.processPayment("TEST-ABC123", payment);

            assertThat(result.getPaymentMethod()).isEqualTo("VOUCHER");
        }
    }

    @Test
    @DisplayName("supports powinien zwrócić true tylko dla VOUCHER")
    void shouldSupportOnlyVoucherType() {
        assertThat(voucherHandler.supports("VOUCHER")).isTrue();
        assertThat(voucherHandler.supports("PAYU")).isFalse();
        assertThat(voucherHandler.supports("CARD")).isFalse();
        assertThat(voucherHandler.supports("voucher")).isFalse();
        assertThat(voucherHandler.supports(null)).isFalse();
    }
}
