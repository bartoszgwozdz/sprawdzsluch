package dev.gwozdz.sprawdzsluch.service;

import dev.gwozdz.sprawdzsluch.dto.TestResultDto;
import dev.gwozdz.sprawdzsluch.entity.TestResult;
import dev.gwozdz.sprawdzsluch.repository.TestResultRepository;
import org.apache.coyote.BadRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ResultService")
class ResultServiceTest {

    @Mock
    private TestResultRepository testResultRepository;

    @Mock
    private PaymentNotificationService paymentNotificationService;

    @InjectMocks
    private ResultService resultService;

    private TestResultDto validDto;

    @BeforeEach
    void setUp() {
        validDto = new TestResultDto();
        validDto.setUserEmail("test@example.com");
        validDto.setMaxAudibleFrequency(8000);
        validDto.setHearingLevels(Map.of(1000, -10.0, 2000, -5.0, 4000, 15.0));
        validDto.setPaymentMethod("VOUCHER");
        validDto.setVoucherCode("REKRUTACJA");
    }

    @Nested
    @DisplayName("processResults - walidacja e-mail")
    class EmailValidation {

        @Test
        @DisplayName("powinien rzucić BadRequestException dla nieprawidłowego e-mail")
        void shouldThrowForInvalidEmail() {
            validDto.setUserEmail("not-an-email");

            assertThatThrownBy(() -> resultService.processResults(validDto))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("email");

            verifyNoInteractions(testResultRepository, paymentNotificationService);
        }

        @Test
        @DisplayName("powinien rzucić BadRequestException dla pustego e-mail")
        void shouldThrowForBlankEmail() {
            validDto.setUserEmail("   ");

            assertThatThrownBy(() -> resultService.processResults(validDto))
                    .isInstanceOf(BadRequestException.class);
        }

        @Test
        @DisplayName("powinien rzucić BadRequestException dla null e-mail")
        void shouldThrowForNullEmail() {
            validDto.setUserEmail(null);

            assertThatThrownBy(() -> resultService.processResults(validDto))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Nested
    @DisplayName("processResults - walidacja częstotliwości")
    class FrequencyValidation {

        @Test
        @DisplayName("powinien rzucić BadRequestException dla freq < 1000")
        void shouldThrowForFrequencyBelowThreshold() {
            validDto.setMaxAudibleFrequency(500);

            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(false);

            assertThatThrownBy(() -> resultService.processResults(validDto))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("frequency");

            verify(testResultRepository, never()).save(any());
        }

        @Test
        @DisplayName("powinien akceptować freq równe 1000")
        void shouldAcceptFrequencyAtThreshold() throws BadRequestException {
            validDto.setMaxAudibleFrequency(1000);

            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(false);
            when(testResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            boolean result = resultService.processResults(validDto);

            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("powinien akceptować wysoką częstotliwość")
        void shouldAcceptHighFrequency() throws BadRequestException {
            validDto.setMaxAudibleFrequency(20000);

            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(false);
            when(testResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            boolean result = resultService.processResults(validDto);

            assertThat(result).isTrue();
        }
    }

    @Nested
    @DisplayName("processResults - zapis nowego wyniku")
    class SaveNewResult {

        @Test
        @DisplayName("powinien zapisać wynik i powiadomić payments dla nowego testu")
        void shouldSaveAndNotifyForNewResult() throws BadRequestException {
            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(false);
            when(testResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            boolean result = resultService.processResults(validDto);

            assertThat(result).isTrue();
            verify(testResultRepository).save(any(TestResult.class));
            verify(paymentNotificationService).notifyPaymentService(any(TestResult.class));
        }

        @Test
        @DisplayName("powinien ustawić status NEW przy pierwszym zapisie")
        void shouldSetStatusToNew() throws BadRequestException {
            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(false);

            ArgumentCaptor<TestResult> captor = ArgumentCaptor.forClass(TestResult.class);
            when(testResultRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            resultService.processResults(validDto);

            assertThat(captor.getValue().getStatus()).isEqualTo("NEW");
        }

        @Test
        @DisplayName("powinien zachować e-mail i dane słuchu w encji")
        void shouldPreserveEmailAndHearingData() throws BadRequestException {
            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(false);

            ArgumentCaptor<TestResult> captor = ArgumentCaptor.forClass(TestResult.class);
            when(testResultRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            resultService.processResults(validDto);

            TestResult saved = captor.getValue();
            assertThat(saved.getUserEmail()).isEqualTo("test@example.com");
            assertThat(saved.getMaxAudibleFrequency()).isEqualTo(8000);
            assertThat(saved.getHearingLevels()).containsKey(1000);
        }
    }

    @Nested
    @DisplayName("processResults - idempotentność")
    class Idempotency {

        @Test
        @DisplayName("powinien zwrócić true bez zapisu gdy wynik istnieje w DB")
        void shouldReturnTrueWithoutSavingWhenRecordExistsInDb() throws BadRequestException {
            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(true);

            boolean result = resultService.processResults(validDto);

            assertThat(result).isTrue();
            verify(testResultRepository, never()).save(any());
            verifyNoInteractions(paymentNotificationService);
        }

        @Test
        @DisplayName("powinien zwrócić true z cache bez zapytania do DB przy duplikacie")
        void shouldReturnTrueFromCacheWithoutDbQuery() throws BadRequestException {
            // pierwsze wywołanie - zapisuje do DB i kafki
            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(false);
            when(testResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            resultService.processResults(validDto);
            reset(testResultRepository, paymentNotificationService);

            // drugie wywołanie - powinno trafić w cache
            boolean result = resultService.processResults(validDto);

            assertThat(result).isTrue();
            verifyNoInteractions(testResultRepository, paymentNotificationService);
        }

        @Test
        @DisplayName("testId powinien być deterministyczny dla tych samych danych")
        void testIdShouldBeDeterministic() throws BadRequestException {
            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(false);

            ArgumentCaptor<TestResult> captor1 = ArgumentCaptor.forClass(TestResult.class);
            when(testResultRepository.save(captor1.capture())).thenAnswer(inv -> inv.getArgument(0));
            resultService.processResults(validDto);
            String firstTestId = captor1.getValue().getTestId();

            // resetujemy wszystko i tworzymy nową instancję serwisu
            ResultService freshService = new ResultService(paymentNotificationService, testResultRepository);
            reset(testResultRepository, paymentNotificationService);

            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(false);
            ArgumentCaptor<TestResult> captor2 = ArgumentCaptor.forClass(TestResult.class);
            when(testResultRepository.save(captor2.capture())).thenAnswer(inv -> inv.getArgument(0));
            freshService.processResults(validDto);
            String secondTestId = captor2.getValue().getTestId();

            assertThat(firstTestId).isEqualTo(secondTestId);
            assertThat(firstTestId).startsWith("TEST-");
        }

        @Test
        @DisplayName("testId powinien różnić się dla różnych danych")
        void testIdShouldDifferForDifferentData() throws BadRequestException {
            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(false);
            when(testResultRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            ArgumentCaptor<TestResult> captor = ArgumentCaptor.forClass(TestResult.class);
            when(testResultRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            resultService.processResults(validDto);
            String firstTestId = captor.getValue().getTestId();

            // inne dane
            validDto.setUserEmail("other@example.com");
            reset(testResultRepository, paymentNotificationService);
            when(testResultRepository.existsByTestIdAndUserEmail(anyString(), anyString()))
                    .thenReturn(false);
            ArgumentCaptor<TestResult> captor2 = ArgumentCaptor.forClass(TestResult.class);
            when(testResultRepository.save(captor2.capture())).thenAnswer(inv -> inv.getArgument(0));

            resultService.processResults(validDto);
            String secondTestId = captor2.getValue().getTestId();

            assertThat(firstTestId).isNotEqualTo(secondTestId);
        }
    }
}
