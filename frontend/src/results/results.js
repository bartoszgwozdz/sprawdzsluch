// Skrypt do obsługi strony wyników

// Klasa do obsługi polling statusu testu
class TestProgressTracker {
    constructor() {
        this.pollInterval = null;
        this.maxPolls = 60; // 60 * 1s = 60 sekund max
        this.currentPolls = 0;
        this.testId = null;
    }

    async submitTest(testData) {
        try {
            this.showProcessingUI();
            this.updateProgress(10, 'Przesyłanie testu...');

            // Wyślij test do backend
            const response = await fetch('/api/hearing-test/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                this.testId = result.testId;
                this.updateProgress(20, 'Test przesłany, rozpoczynanie przetwarzania...');
                this.startPolling(result.testId);
            } else {
                throw new Error(result.message || 'Nieznany błąd');
            }

        } catch (error) {
            console.error('Błąd podczas przesyłania testu:', error);
            this.showError('Wystąpił błąd podczas przesyłania testu: ' + error.message);
        }
    }

    startPolling(testId) {
        this.currentPolls = 0;
        
        this.pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/hearing-test/status/${testId}`);
                
                if (response.ok) {
                    const status = await response.json();
                    console.log('Status update:', status);
                    this.handleStatusUpdate(status);

                    // Zatrzymaj polling dla finalnych statusów
                    if (this.isFinalStatus(status.status)) {
                        this.stopPolling();
                    }
                } else if (response.status === 404) {
                    this.showError('Nie znaleziono testu. Spróbuj ponownie.');
                    this.stopPolling();
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }

                // Timeout protection
                this.currentPolls++;
                if (this.currentPolls >= this.maxPolls) {
                    this.stopPolling();
                    this.showError('Przekroczono limit czasu oczekiwania na przetworzenie testu.');
                }

            } catch (error) {
                console.error('Błąd podczas sprawdzania statusu:', error);
                this.stopPolling();
                this.showError('Błąd podczas sprawdzania statusu testu.');
            }
        }, 1000); // Poll co 1 sekundę
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    handleStatusUpdate(status) {
        const progressMap = {
            'SUBMITTED': { progress: 25, message: 'Test przesłany...' },
            'PROCESSING': { progress: 50, message: 'Przetwarzanie wyników testu...' },
            'PROCESSED': { progress: 75, message: 'Wyniki zostały przetworzone' },
            'PAYMENT_REQUIRED': { progress: 90, message: 'Przekierowywanie do płatności...' },
            'COMPLETED': { progress: 100, message: 'Zakończono pomyślnie!' },
            'ERROR': { progress: 0, message: 'Wystąpił błąd podczas przetwarzania' }
        };

        const info = progressMap[status.status] || { progress: 0, message: status.message };
        this.updateProgress(info.progress, status.message || info.message);

        // Akcje finalne
        if (status.status === 'COMPLETED' && status.redirectUrl) {
            setTimeout(() => {
                window.location.href = status.redirectUrl;
            }, 2000);
        } else if (status.status === 'PAYMENT_REQUIRED' && status.paymentUrl) {
            setTimeout(() => {
                window.location.href = status.paymentUrl;
            }, 2000);
        } else if (status.status === 'ERROR') {
            this.showError(status.message);
        }
    }

    isFinalStatus(status) {
        return ['COMPLETED', 'PAYMENT_REQUIRED', 'ERROR'].includes(status);
    }

    updateProgress(percent, message) {
        const progressFill = document.getElementById('progressFill');
        const processingMessage = document.getElementById('processingMessage');
        const progressPercent = document.getElementById('progressPercent');

        if (progressFill) {
            progressFill.style.width = percent + '%';
            if (percent === 100) {
                progressFill.style.background = 'linear-gradient(90deg, #22c55e, #16a34a)'; // Zielony
            } else if (percent === 0) {
                progressFill.style.background = 'linear-gradient(90deg, #dc2626, #b91c1c)'; // Czerwony
            }
        }

        if (processingMessage) {
            processingMessage.textContent = message;
        }

        if (progressPercent) {
            progressPercent.textContent = Math.round(percent) + '%';
        }
    }

    showProcessingUI() {
        const paymentSection = document.getElementById('paymentSection');
        const processingSection = document.getElementById('processingSection');

        if (paymentSection) paymentSection.style.display = 'none';
        if (processingSection) processingSection.style.display = 'block';
    }

    showError(message) {
        const statusMessage = document.getElementById('statusMessage');
        const buyBtn = document.getElementById('buyBtn');

        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.style.display = 'block';
            statusMessage.className = 'status-message error';
        }

        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.textContent = "Kup raport PDF za 24,99 zł";
        }

        // Pokaż ponownie formularz płatności
        const paymentSection = document.getElementById('paymentSection');
        const processingSection = document.getElementById('processingSection');
        if (paymentSection) paymentSection.style.display = 'block';
        if (processingSection) processingSection.style.display = 'none';
    }
}

// Globalna instancja trackera
const progressTracker = new TestProgressTracker();

// Funkcja do generowania hash z daty
function generateTestId() {
    const now = new Date();
    const dateString = now.toISOString();
    
    // Prosta funkcja hash
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
        const char = dateString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Konwertuj do 32-bitowego integer
    }
    
    // Zwróć dodatni hash jako hex
    return "TEST-" + Math.abs(hash).toString(16).toUpperCase();
}

// Funkcja do pobrania parametrów z URL
function getUrlParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const paramPairs = queryString.split('&');
    
    for (let i = 0; i < paramPairs.length; i++) {
        const pair = paramPairs[i].split('=');
        params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    
    return params;
}

// Wstrzykiwanie headera i footera
function injectHeaderAndFooter() {
    fetch('/assets/partials/header.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('main-header').innerHTML = html;
        });

    fetch('/assets/partials/footer.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('main-footer').innerHTML = html;
        });
}

// Funkcja do wyświetlania wykresu słuchu
function displayHearingChart() {
    // Pobierz dane z localStorage
    const testResults = JSON.parse(localStorage.getItem('hearingTestResults')) || {};
    const maxFrequency = testResults.maxAudibleFrequency || 13000;
    const hearingLevels = testResults.hearingLevels || [];
    
    // Ustaw wartość maksymalnej częstotliwości w tekście
    const maxFreqValue = document.getElementById('maxFreqValue');
    if (maxFreqValue) {
        maxFreqValue.textContent = `${(maxFrequency / 1000).toFixed(1)} kHz`;
    }

    // Wyświetl interpretację na podstawie maksymalnej częstotliwości
    displayInterpretation(maxFrequency);
    
    // Tworzenie wykresu
    const ctx = document.getElementById('hearingRange');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000],
            datasets: [{
                label: 'Baseline',
                data: new Array(10).fill(0),
                borderColor: 'transparent',
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'logarithmic',
                    min: 3000,
                    max: Math.max(maxFrequency + 2000, 20000),
                    ticks: {
                        callback: (val) => val >= 1000 ? val / 1000 + " kHz" : val + " Hz"
                    }
                },
                y: {
                    display: false,
                    min: 0,
                    max: 1
                }
            },
            plugins: {
                legend: { display: false },
                annotation: {
                    annotations: {
                        hearingRange: {
                            type: 'box',
                            xMin: 100,
                            xMax: maxFrequency,
                            yMin: 0,
                            yMax: 1,
                            backgroundColor: 'rgba(34,197,94,0.25)',
                            borderWidth: 0
                        },
                        maxLine: {
                            type: 'line',
                            xMin: maxFrequency,
                            xMax: maxFrequency,
                            borderColor: '#22c55e',
                            borderWidth: 2,
                            borderDash: [4, 4],
                            label: {
                                display: true,
                                content: `Twój maksymalny zakres słyszalny: ${(maxFrequency / 1000).toFixed(1)} kHz`,
                                position: 'start',
                                yAdjust: -20,
                                backgroundColor: 'rgba(34,197,94,0.9)',
                                color: '#fff',
                                font: {
                                    size: 12,
                                    weight: '600'
                                },
                                padding: 6,
                                borderRadius: 6
                            }
                        }
                    }
                }
            }
        }
    });
}

// Funkcja do wyświetlania interpretacji wyników
function displayInterpretation(maxFrequency) {
    const interpretationText = document.getElementById('interpretation-text');
    if (!interpretationText) return;
    
    let interpretation = '';
    
    if (maxFrequency >= 17000) {
        interpretation = 'Twoje wyniki są <strong>bardzo dobre</strong>. Twój słuch funkcjonuje na poziomie lepszym niż przeciętny dla dorosłej osoby. Zakres słyszalnych przez Ciebie częstotliwości wykracza poza typowy dla wieku dorosłego.';
    } else if (maxFrequency >= 14000) {
        interpretation = 'Twoje wyniki są <strong>dobre</strong>. Twój słuch funkcjonuje na poziomie typowym dla młodej osoby dorosłej. Nie stwierdzono znaczących odchyleń od normy.';
    } else if (maxFrequency >= 10000) {
        interpretation = 'Twoje wyniki są <strong>w normie</strong> dla osoby dorosłej. Z wiekiem naturalnie tracimy zdolność słyszenia najwyższych częstotliwości, ale Twój słuch funkcjonuje prawidłowo.';
    } else if (maxFrequency >= 6000) {
        interpretation = 'Twoje wyniki sugerują <strong>lekkie ograniczenie</strong> w słyszeniu wysokich częstotliwości. Może to być naturalne dla wieku lub skutek ekspozycji na hałas. Zalecana konsultacja z audiologiem.';
    } else {
        interpretation = 'Twoje wyniki wskazują na <strong>znaczące ograniczenie</strong> w słyszeniu wysokich częstotliwości. Zalecamy konsultację z lekarzem audiologiem w celu przeprowadzenia pełnego badania słuchu.';
    }
    
    interpretationText.innerHTML = interpretation;
}

// Obsługa formularza płatności
function setupPaymentForm() {
    const paymentForm = document.getElementById('paymentForm');
    if (!paymentForm) return;
    
    // Obsługa pokazywania/ukrywania pola voucher
    const methodRadios = document.querySelectorAll('input[name="method"]');
    const voucherField = document.getElementById('voucherField');
    
    methodRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'voucher') {
                voucherField.style.visibility = 'visible';
            } else {
                voucherField.style.visibility = 'hidden';
                // Wyczyść pole voucher gdy nie jest potrzebne
                document.getElementById('voucher').value = '';
                // Ukryj błąd walidacji
                document.getElementById('voucherError').style.visibility = 'hidden';
            }
        });
    });
    
    paymentForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Walidacja email
        const email = document.getElementById('email').value;
        const emailError = document.getElementById('emailError');
        if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            emailError.style.display = 'block';
            return;
        } else {
            emailError.style.display = 'none';
        }
        
        const method = document.querySelector('input[name="method"]:checked').value;
        
        // Walidacja voucher - jeśli wybrano voucher, pole musi być wypełnione
        if (method === 'voucher') {
            const voucherValue = document.getElementById('voucher').value.trim();
            const voucherError = document.getElementById('voucherError');
            
            if (!voucherValue) {
                voucherError.style.visibility = 'visible';
                return;
            } else {
                voucherError.style.visibility = 'hidden';
            }
        }
        
        const buyBtn = document.getElementById('buyBtn');
        const statusMessage = document.getElementById('statusMessage');
        
        try {
            buyBtn.disabled = true;
            buyBtn.textContent = "Przetwarzanie...";
            statusMessage.style.display = 'none';
            
            const hearingResults = sessionStorage.getItem('hearingTestResults') || localStorage.getItem('hearingTestResults');
            const testResults = JSON.parse(hearingResults) || {};
            
            // Przygotuj payload JSON z pełnymi danymi testu
            const payloadData = {
                testId: generateTestId(),
                userEmail: email,
                hearingLevels: testResults.hearingLevels || [],
                maxAudibleFrequency: testResults.maxAudibleFrequency || 13000,
                executed: testResults.timestamp || new Date().toISOString(),
                paymentMethod: method,
                status: "NEW"
            };
            
            // Dodaj kod voucher jeśli wybrano tę metodę
            if (method === 'voucher') {
                payloadData.voucherCode = document.getElementById('voucher').value.trim();
            }
            
            // Użyj nowego systemu polling + Kafka
            await progressTracker.submitTest(payloadData);
            
        } catch (error) {
            console.error('Błąd podczas przetwarzania:', error);
            statusMessage.textContent = 'Wystąpił błąd podczas przetwarzania. Spróbuj ponownie.';
            statusMessage.style.display = 'block';
            statusMessage.className = 'status-message error';
            buyBtn.disabled = false;
            buyBtn.textContent = "Kup raport PDF za 24,99 zł";
        }
    });
}

// Inicjalizacja strony
document.addEventListener('DOMContentLoaded', () => {
    // Wstrzyknij header i footer
    injectHeaderAndFooter();
    
    // Wyświetl wykres
    displayHearingChart();
    
    // Skonfiguruj formularz płatności
    setupPaymentForm();
});