// Skrypt do obsługi strony wyników

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
    
    paymentForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            const emailError = document.getElementById('emailError');
            emailError.style.display = 'block';
            return;
        }
        
        const method = document.querySelector('input[name="method"]:checked').value;
        const buyBtn = document.getElementById('buyBtn');
        const statusMessage = document.getElementById('statusMessage');
        
        try {
            buyBtn.disabled = true;
            buyBtn.textContent = "Przetwarzanie...";
            statusMessage.style.display = 'none';
            
            // Pobierz dane testu
            const testResults = JSON.parse(localStorage.getItem('hearingTestResults')) || {};
            
            const response = await fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userEmail: email,
                    testId: testResults.testId || "TEST-" + Date.now(),
                    paymentMethod: method,
                    testResults: testResults.hearingLevels || [],
                    maxAudibleFrequency: testResults.maxAudibleFrequency || 13000
                })
            });
            
            if (!response.ok) {
                throw new Error(`Błąd HTTP: ${response.status}`);
            }
            
            const payment = await response.json();
            if (payment.redirectUrl) {
                window.location.href = payment.redirectUrl;
            } else {
                throw new Error('Brak URL przekierowania w odpowiedzi.');
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