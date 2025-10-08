// Skrypt do obsługi strony wyników

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
            const hearingResults = localStorage.getItem('hearingTestResults');
            const testResults = JSON.parse(hearingResults) || {};
            
            // Przygotuj payload JSON z pełnymi danymi testu
            const hearingLevelsArray = testResults.hearingLevels || [];
            
            // Konwertuj tablicę na obiekt Map<Integer, Double> zgodny z backendem
            const hearingLevelsMap = {};
            hearingLevelsArray.forEach(item => {
                if (item.frequency && item.gain !== undefined) {
                    hearingLevelsMap[parseInt(item.frequency)] = parseFloat(item.gain);
                }
            });
            
            const payloadData = {
                testId: generateTestId(),
                userEmail: email,
                hearingLevels: hearingLevelsMap,
                maxAudibleFrequency: parseInt(testResults.maxAudibleFrequency) || 13000,
                paymentMethod: method,
                status: "NEW"
            };
            
            console.log('Cały payload przed wysłaniem:', JSON.stringify(payloadData, null, 2));
            
            // Usuń pole executed na razie, żeby sprawdzić czy to powoduje problem
            // executed: testResults.timestamp ? new Date(testResults.timestamp).toISOString().slice(0, 19) : new Date().toISOString().slice(0, 19),
            
            // Dodaj kod voucher jeśli wybrano tę metodę
            if (method === 'voucher') {
                payloadData.voucherCode = document.getElementById('voucher').value.trim();
            }
            
            console.log('Wysyłane dane:', payloadData);
            
            const response = await fetch('/api/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Błąd serwera:', errorText);
                throw new Error(`Błąd HTTP: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            
            // Po pomyślnym zapisaniu wyników
            if (result.id) {
                // Możesz przekierować do strony potwierdzenia lub pokazać komunikat
                statusMessage.textContent = 'Wyniki zostały zapisane pomyślnie! Sprawdź swoją skrzynkę e-mail.';
                statusMessage.style.display = 'block';
                statusMessage.className = 'status-message success';
                
                // Opcjonalnie: wyczyść localStorage po pomyślnym zapisaniu
                // localStorage.removeItem('hearingTestResults');
            } else {
                throw new Error('Brak ID w odpowiedzi serwera.');
            }
        } catch (error) {
            console.error('Błąd podczas przetwarzania płatności:', error);
            statusMessage.textContent = 'Wystąpił błąd podczas przetwarzania płatności. Spróbuj ponownie.';
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