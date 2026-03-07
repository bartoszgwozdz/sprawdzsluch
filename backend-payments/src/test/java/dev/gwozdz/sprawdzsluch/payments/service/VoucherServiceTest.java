package dev.gwozdz.sprawdzsluch.payments.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("VoucherService")
class VoucherServiceTest {

    private VoucherService voucherService;

    @BeforeEach
    void setUp() {
        voucherService = new VoucherService();
    }

    @Nested
    @DisplayName("validateVoucher - prawidłowe vouchery")
    class ValidVouchers {

        @Test
        @DisplayName("powinien zaakceptować voucher REKRUTACJA (wielkie litery)")
        void shouldAcceptRekrutacjaUpperCase() {
            assertThat(voucherService.validateVoucher("REKRUTACJA")).isTrue();
        }

        @Test
        @DisplayName("powinien zaakceptować voucher rekrutacja (małe litery — normalizacja)")
        void shouldAcceptRekrutacjaLowerCase() {
            assertThat(voucherService.validateVoucher("rekrutacja")).isTrue();
        }

        @Test
        @DisplayName("powinien zaakceptować voucher z białymi znakami na początku/końcu")
        void shouldAcceptVoucherWithWhitespace() {
            assertThat(voucherService.validateVoucher("  REKRUTACJA  ")).isTrue();
        }

        @Test
        @DisplayName("powinien zaakceptować voucher mieszane wielkości liter")
        void shouldAcceptMixedCase() {
            assertThat(voucherService.validateVoucher("Rekrutacja")).isTrue();
        }
    }

    @Nested
    @DisplayName("validateVoucher - nieprawidłowe vouchery")
    class InvalidVouchers {

        @ParameterizedTest
        @NullAndEmptySource
        @DisplayName("powinien odrzucić null i pusty ciąg")
        void shouldRejectNullAndEmpty(String code) {
            assertThat(voucherService.validateVoucher(code)).isFalse();
        }

        @Test
        @DisplayName("powinien odrzucić ciąg składający się tylko z białych znaków")
        void shouldRejectBlankString() {
            assertThat(voucherService.validateVoucher("   ")).isFalse();
        }

        @ParameterizedTest
        @ValueSource(strings = {"INVALID", "TEST123", "VOUCHER", "FREE", "DISCOUNT"})
        @DisplayName("powinien odrzucić nieznane vouchery")
        void shouldRejectUnknownVouchers(String code) {
            assertThat(voucherService.validateVoucher(code)).isFalse();
        }

        @Test
        @DisplayName("powinien odrzucić częściowe dopasowanie")
        void shouldRejectPartialMatch() {
            assertThat(voucherService.validateVoucher("REKRUT")).isFalse();
        }
    }

    @Nested
    @DisplayName("deactivateVoucher")
    class DeactivateVoucher {

        @Test
        @DisplayName("deactivateVoucher nie powinien rzucać wyjątku")
        void shouldNotThrow() {
            // metoda jest stubem (TODO w kodzie) — weryfikujemy brak błędu
            org.junit.jupiter.api.Assertions.assertDoesNotThrow(
                    () -> voucherService.deactivateVoucher("REKRUTACJA")
            );
        }
    }
}
