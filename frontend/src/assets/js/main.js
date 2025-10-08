const modalSteps = [
    "/assets/partials/modal-intro.html",            // Wprowadzenie
    "/assets/partials/modal-preparation.html",      // Przygotowanie
    // "/assets/partials/modal-test-1-intro.html",
    "/assets/partials/modal-test-1.html",           // Test 1kHz
    // "/assets/partials/modal-test-2-intro.html",
    "/assets/partials/modal-test-2.html",           // Test maksymalnej częstotliwości
    // "/assets/partials/modal-test-3-intro.html",
    "/assets/partials/modal-test-3.html",           // Test losowych częstotliwości
    "/assets/partials/modal-results.html"           // Wyniki
];
let currentStep = 0;

// Elementy
const modal = document.getElementById('hearing-modal');
const modalContent = document.getElementById('modal-content');
const btnClose = document.getElementById('modal-close');

// Funkcja otwierająca modal
function openModal() {
    // Upewnij się, że style dla scrollowania są dodane
    addModalScrollStyles();
    
    // Reszta kodu pozostaje bez zmian
    currentStep = 0;
    showModalStep(currentStep);
    modal.classList.add('show');
}

// Otwieranie modalu po kliknięciu przycisku na stronie
const mainTestBtn = document.getElementById('start-test-btn');
if (mainTestBtn) {
    mainTestBtn.addEventListener('click', openModal);
}

// Zamknięcie modalu
btnClose.onclick = () => {
    // Jeśli jesteśmy na kroku przygotowania lub dalej, pokaż potwierdzenie wyjścia
    if (currentStep >= 1) {
        const confirmExitModal = document.getElementById('confirm-exit-modal');
        confirmExitModal.classList.add('show');

        // Zatrzymaj test audio, gdy pokazujemy potwierdzenie
        toggleTestPause(true);
    } else {
        // Jeśli jesteśmy na wprowadzeniu, po prostu zamknij modal
        modal.classList.remove('show');
    }
};

// Dodaj style dla scrollowania modalu - umieść tę funkcję na początku pliku
function addModalScrollStyles() {
    // Sprawdź czy style już istnieją
    if (document.getElementById('modal-scroll-styles')) return;
    
    // Utwórz element style
    const style = document.createElement('style');
    style.id = 'modal-scroll-styles';
    style.textContent = `
        #hearing-modal .modal-container {
            max-height: 90vh;
            overflow-y: auto;
        }
        
        #modal-content {
            overflow-y: visible;
            max-height: none;
        }
        
        /* Style do obsługi mobile */
        @media (max-width: 768px) {
            #hearing-modal .modal-container {
                max-height: 85vh;
            }
        }
    `;
    
    // Dodaj style do head
    document.head.appendChild(style);
}

// Wywołaj funkcję przy inicjalizacji
addModalScrollStyles();

// Ładowanie zawartości kroku - NOWA, ZAKTUALIZOWANA WERSJA
function showModalStep(step) {
    const modalDialog = modal.querySelector('.modal-container'); // Zmiana selektora na właściwy

    // Dynamicznie dostosuj szerokość modala w zależności od kroku
    if (step === 5) { // Krok z wynikami
        modalDialog.classList.remove('standard-width');
        modalDialog.classList.add('wide-width'); // Ustaw większą szerokość dla wyników
        
        // Upewnij się, że możliwe jest scrollowanie
        modalDialog.style.overflowY = 'auto';
        modalDialog.style.maxHeight = '90vh';
    } else {
        modalDialog.classList.remove('wide-width');
        modalDialog.classList.add('standard-width'); // Przywróć domyślną szerokość dla innych kroków
        
        // Dla mniejszych kroków możemy zachować standardową wysokość
        modalDialog.style.maxHeight = '';
    }

    fetch(modalSteps[step])
        .then(res => res.text())
        .then(html => {
            const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            modalContent.innerHTML = bodyMatch ? bodyMatch[1] : html;

            // --- Logika specyficzna dla każdego kroku ---

            if (step === 0) { // Modal 1: Wprowadzenie
                const understandBtn = document.getElementById('understand-button');
                if (understandBtn) {
                    understandBtn.onclick = () => {
                        currentStep++;
                        showModalStep(currentStep);
                    };
                }
            } else if (step === 1) { // Modal 2: Przygotowanie
                const checkbox = document.getElementById('headphones-checkbox');
                const startBtn = document.getElementById('start-test-button');
                if (checkbox && startBtn) {
                    startBtn.disabled = true; // Domyślnie wyłączony
                    checkbox.onchange = () => {
                        startBtn.disabled = !checkbox.checked;
                    };
                    startBtn.onclick = () => {
                        // *** NOWY KOD: Odblokuj audio w odpowiedzi na kliknięcie ***
                        if (window.hearingTestInstance) {
                            window.hearingTestInstance.unlockAudio();
                        }
                        // *** KONIEC NOWEGO KODU ***
                        currentStep++;
                        showModalStep(currentStep);
                    };
                }
            } else if (step === 2) { // Test 1kHz
                window.hearingTestInstance.initialize('hear-button', 'test-instruction', 'sound-wave-canvas');
                window.hearingTestInstance.startAdjusting1kHz();
                document.getElementById('hear-button').onclick = () => {
                    window.hearingTestInstance.recordHearing();
                    setTimeout(() => { currentStep++; showModalStep(currentStep); }, 500);
                };
            } else if (step === 3) { // Test max częstotliwości
                window.hearingTestInstance.initialize('hear-button', 'test-instruction', 'sound-wave-canvas');
                window.hearingTestInstance.findMaxFrequency();
                document.getElementById('hear-button').onclick = () => {
                    window.hearingTestInstance.recordHearing();
                    setTimeout(() => { currentStep++; showModalStep(currentStep); }, 500);
                };
            } else if (step === 4) { // Test losowych częstotliwości
                window.hearingTestInstance.initialize('hear-button', 'test-instruction', 'sound-wave-canvas');
                window.hearingTestInstance.startRandomFrequencyTest();

                // Nasłuchuj na niestandardowy event, który zasygnalizuje koniec tego etapu
                window.addEventListener('randomTestCompleted', () => {
                    console.log('Event "randomTestCompleted" received. Advancing to results page.');
                    
                    // Zapisz dane testu do localStorage
                    if (window.hearingTestInstance) {
                        const testResults = {
                            testId: "TEST-" + Date.now(),
                            hearingLevels: window.hearingTestInstance.hearingLevels || [],
                            maxAudibleFrequency: window.hearingTestInstance.maxAudibleFrequency || 20000,
                            timestamp: new Date().toISOString()
                        };
                        
                        localStorage.setItem('hearingTestResults', JSON.stringify(testResults));
                    }
                    
                    // Zamknij modal
                    if (modal) {
                        modal.classList.remove('show');
                    }
                    
                    // Przekieruj do strony z wynikami
                    window.location.href = '/results/';
                }, { once: true }); // { once: true } sprawi, że listener usunie się sam po jednym wywołaniu

                document.getElementById('hear-button').onclick = () => {
                    window.hearingTestInstance.recordHearing();
                };
            } else if (step === 5) { // Wyniki
                fetch('/assets/partials/modal-results-part.html')
                    .then(res => res.text())
                    .then(html => {
                        // Wyciągnij zawartość body z pobranego pliku
                        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
                        const resultsContent = bodyMatch ? bodyMatch[1] : html;
                        
                        // Wyciągnij style z pobranego pliku
                        const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
                        const resultStyles = styleMatch ? styleMatch[1] : '';
                        
                        // Wstaw style do modal-content
                        if (resultStyles) {
                            const styleElement = document.createElement('style');
                            styleElement.textContent = resultStyles;
                            modalContent.appendChild(styleElement);
                        }
                        
                        // Wstaw zawartość do modal-content
                        modalContent.innerHTML += resultsContent;
                        
                        // Dodaj obsługę przycisku kończącego test
                        const finishBtn = document.getElementById('finish-button');
                        if (finishBtn) {
                            finishBtn.onclick = () => modal.classList.remove('show');
                        }
                        
                        // Obsługa formularza płatności
                        const paymentForm = document.getElementById('paymentForm');
                        if (paymentForm) {
                            paymentForm.addEventListener('submit', async (e) => {
                                e.preventDefault();
                                
                                const email = document.getElementById('email').value;
                                const method = document.querySelector('input[name="method"]:checked').value;
                                
                                try {
                                    const buyBtn = document.getElementById('buyBtn');
                                    buyBtn.disabled = true;
                                    buyBtn.textContent = "Przetwarzanie...";
                                    
                                    const response = await fetch('/api/payments/create', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            userEmail: email,
                                            testId: "TEST-" + Math.floor(Math.random() * 1000000), 
                                            paymentMethod: method,
                                            testResults: window.hearingTestInstance.hearingLevels 
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
                                    const statusMessage = document.getElementById('statusMessage');
                                    statusMessage.textContent = 'Wystąpił błąd podczas przetwarzania płatności. Spróbuj ponownie.';
                                    statusMessage.style.display = 'block';
                                    statusMessage.className = 'status error';
                                    
                                    const buyBtn = document.getElementById('buyBtn');
                                    buyBtn.disabled = false;
                                    buyBtn.textContent = "Kup raport PDF za 24,99 zł";
                                }
                            });
                        }
                        
                        // Usunięcie istniejących skryptów wykresu
                        setTimeout(() => {
                            // Scrolluj na górę modalu po załadowaniu zawartości
                            modalDialog.scrollTop = 0;
                            
                            // Aktualizuj wykres z wynikami testu
                            updateHearingRangeChart();
                        }, 100);
                    })
                    .catch(error => {
                        console.error('Error loading results part:', error);
                        modalContent.innerHTML = '<p class="p-4 text-red-500">Wystąpił błąd podczas ładowania wyników. Spróbuj ponownie.</p>';
                    });
            }
        })
        .catch(error => {
            console.error('Error loading step:', error);
            modalContent.innerHTML = '<p class="p-4 text-red-500">Could not load content. Please try again.</p>';
        });
}

// Dodaj nową funkcję do zatrzymania i wznowienia testu
function toggleTestPause(shouldPause) {
    // Sprawdź, czy test jest aktywny (kroki 2, 3, 4)
    if (currentStep >= 2 && currentStep <= 4 && window.hearingTestInstance) {
        if (shouldPause) {
            // Zatrzymaj odtwarzanie dźwięku
            window.hearingTestInstance.pauseAudio();
            console.log('Test audio paused');
        } else {
            // Wznów odtwarzanie dźwięku
            window.hearingTestInstance.resumeAudio();
            console.log('Test audio resumed');
        }
    }
}

// Zamknięcie modalu po kliknięciu poza oknem
modal.addEventListener('mousedown', e => {
    if (e.target === modal) {
        // Jeśli jesteśmy na kroku przygotowania lub dalej, pokaż potwierdzenie wyjścia
        if (currentStep >= 1) {
            const confirmExitModal = document.getElementById('confirm-exit-modal');
            confirmExitModal.classList.add('show');

            // Zatrzymaj test audio, gdy pokazujemy potwierdzenie
            toggleTestPause(true);

            // Dodaj event listenery do przycisków w modalu potwierdzającym
            const confirmExitYes = document.getElementById('confirm-exit-yes');
            const confirmExitNo = document.getElementById('confirm-exit-no');

            if (confirmExitYes) {
                confirmExitYes.onclick = function () {
                    // Jeśli użytkownik potwierdził wyjście, zatrzymaj test na stałe
                    if (window.hearingTestInstance) {
                        window.hearingTestInstance.stopAudio();
                        console.log('Test audio stopped permanently');
                    }

                    confirmExitModal.classList.remove('show');
                    modal.classList.remove('show'); // Zamknij główny modal
                }
            }

            if (confirmExitNo) {
                confirmExitNo.onclick = function () {
                    confirmExitModal.classList.remove('show'); // Tylko zamknij modal potwierdzający

                    // Wznów test audio po anulowaniu wyjścia
                    toggleTestPause(false);
                }
            }
        } else {
            // Jeśli jesteśmy na wprowadzeniu, po prostu zamknij modal
            modal.classList.remove('show');
        }
    }
});

// Dodaj także obsługę kliknięcia poza modalem potwierdzającym, aby go zamknąć
const confirmExitModal = document.getElementById('confirm-exit-modal');
confirmExitModal.addEventListener('mousedown', e => {
    if (e.target === confirmExitModal) {
        confirmExitModal.classList.remove('show');

        // Wznów test audio po anulowaniu wyjścia
        toggleTestPause(false);
    }
});

// Aktualizuj również obsługę klawisza Escape
document.addEventListener('keydown', e => {
    if (modal.classList.contains('show') && e.key === 'Escape') {
        // Jeśli modal potwierdzający jest już widoczny, zamknij go i wznów test
        const confirmExitModal = document.getElementById('confirm-exit-modal');
        if (confirmExitModal.classList.contains('show')) {
            confirmExitModal.classList.remove('show');
            toggleTestPause(false);
        }
        // W przeciwnym razie, zachowaj się jak przy kliknięciu przycisku zamknięcia
        else if (currentStep >= 1) {
            confirmExitModal.classList.add('show');
            toggleTestPause(true);
        } else {
            modal.classList.remove('show');
        }
    }
});

// Kod główny na stronie
fetch('/assets/js/hearing-test.js')
    .then(response => response.text())
    .then(code => {
        // Wykonanie kodu dopiero po pobraniu
        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
    });

// Wstrzykiwanie headera z pliku header.html
fetch('/assets/partials/header.html')
    .then(res => res.text())
    .then(html => {
        const mainHeader = document.getElementById('main-header');
        if (mainHeader) {
            mainHeader.innerHTML = html;
        }

        // --- CAŁA LOGIKA ZALEŻNA OD HEADERA MUSI BYĆ TUTAJ ---

        // 1. Obsługa przycisku "Rozpocznij test" w headerze
        const headerTestBtn = document.getElementById('start-test-btn-header');
        if (headerTestBtn) {
            headerTestBtn.addEventListener('click', openModal);
        }

        // 2. Logika menu mobilnego
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const mobileMenu = document.querySelector('.mobile-menu');
        
        if (mobileMenuBtn && mobileMenu) {
            const mobileMenuIcon = mobileMenuBtn.querySelector('.material-icons');

            mobileMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('is-open');
                // Zmiana ikony z menu na 'close' i z powrotem
                if (mobileMenu.classList.contains('is-open')) {
                    mobileMenuIcon.textContent = 'close';
                } else {
                    mobileMenuIcon.textContent = 'menu';
                }
            });

            // Dodatkowa obsługa przycisku w menu mobilnym
            const mobileTestBtn = document.getElementById('start-test-btn-mobile');
            if (mobileTestBtn) {
                mobileTestBtn.addEventListener('click', () => {
                    mobileMenu.classList.remove('is-open'); // Zamknij menu
                    if(mobileMenuIcon) mobileMenuIcon.textContent = 'menu';
                    openModal(); // Otwórz modal testu
                });
            }
        }
    });

// Wstrzykiwanie footera z pliku footer.html
fetch('/assets/partials/footer.html')
    .then(res => res.text())
    .then(html => {
        const mainFooter = document.getElementById('main-footer');
        if(mainFooter) {
            mainFooter.innerHTML = html;
        }
    });

// Dodaj funkcję do dynamicznego ładowania biblioteki Chart.js
function loadChartJS() {
    return new Promise((resolve, reject) => {
        // Sprawdź, czy Chart.js jest już załadowany
        if (typeof Chart !== 'undefined') {
            resolve();
            return;
        }

        // Ładowanie biblioteki Chart.js
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => {
            // Ładowanie wtyczki Chart.js Annotation
            const annotationScript = document.createElement('script');
            annotationScript.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation';
            annotationScript.onload = resolve;
            annotationScript.onerror = reject;
            document.head.appendChild(annotationScript);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Zmodyfikowana funkcja updateHearingRangeChart
function updateHearingRangeChart() {
    // Najpierw załaduj Chart.js
    loadChartJS()
        .then(() => {
            // Poczekaj na załadowanie wykresu
            setTimeout(() => {
                const hearingRangeCanvas = document.getElementById('hearingRange');
                if (!hearingRangeCanvas) {
                    console.error('Nie znaleziono elementu canvas dla wykresu');
                    return;
                }

                // Sprawdź, czy mamy wyniki testu i instancję HearingTest
                if (!window.hearingTestInstance || !window.hearingTestInstance.hearingLevels) {
                    console.error('Brak wyników testu słuchu');
                    return;
                }

                try {
                    // Pobierz wykres, jeśli został już zainicjalizowany
                    let chart;
                    if (Chart.instances) {
                        for (let i = 0; i < Chart.instances.length; i++) {
                            if (Chart.instances[i].canvas.id === 'hearingRange') {
                                chart = Chart.instances[i];
                                break;
                            }
                        }
                    } else if (Chart.getChart) {
                        // Nowsza wersja Chart.js używa Chart.getChart
                        chart = Chart.getChart(hearingRangeCanvas);
                    }

                    // Jeśli nie ma istniejącego wykresu, utwórz nowy
                    if (!chart) {
                        console.log('Tworzenie nowego wykresu zakresu słuchu');
                        chart = new Chart(hearingRangeCanvas, {
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
                                        min: 100,
                                        max: 20000,
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
                                                xMax: 13000,
                                                yMin: 0,
                                                yMax: 1,
                                                backgroundColor: 'rgba(34,197,94,0.25)',
                                                borderWidth: 0
                                            },
                                            maxLine: {
                                                type: 'line',
                                                xMin: 13000,
                                                xMax: 13000,
                                                borderColor: '#22c55e',
                                                borderWidth: 2,
                                                borderDash: [4, 4],
                                                label: {
                                                    display: true,
                                                    content: 'Twój maksymalny zakres słyszalny',
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

                    // Pobierz maksymalną częstotliwość słyszalną
                    const maxFreq = window.hearingTestInstance.maxAudibleFrequency || 20000;
                    
                    // Aktualizuj adnotację zakresu słyszalnego
                    if (chart.options.plugins && chart.options.plugins.annotation && 
                        chart.options.plugins.annotation.annotations) {
                        
                        // Aktualizuj zakres słyszalny (hearingRange)
                        chart.options.plugins.annotation.annotations.hearingRange.xMax = maxFreq;
                        
                        // Aktualizuj linię maksymalnej częstotliwości (maxLine)
                        chart.options.plugins.annotation.annotations.maxLine.xMin = maxFreq;
                        chart.options.plugins.annotation.annotations.maxLine.xMax = maxFreq;

                        // Aktualizuj tekst etykiety z dokładnością do 0.1 kHz
                        const maxKHz = (maxFreq / 1000).toFixed(1);
                        chart.options.plugins.annotation.annotations.maxLine.label.content = 
                            `Twój maksymalny zakres słyszalny: ${maxKHz} kHz`;
                    }

                    // Aktualizuj skalę X, aby pokazać odpowiedni zakres częstotliwości
                    chart.options.scales.x.min = 100;  // Dolna granica 100 Hz
                    chart.options.scales.x.max = Math.max(maxFreq + 2000, 20000);  // Górna granica
                    
                    // Zaktualizuj wykres
                    chart.update();
                    
                    console.log('Wykres zakresu słuchu zaktualizowany, maks. częstotliwość:', maxFreq);
                } catch (err) {
                    console.error('Błąd podczas aktualizacji wykresu:', err);
                }
            }, 300); // Krótkie opóźnienie, aby upewnić się, że wykres został już utworzony

            // Również wyświetl pełne wyniki, jeśli jest taki kontener
            const resultsContainer = document.getElementById('results-container');
            if (resultsContainer && window.hearingTestInstance && 
                typeof window.hearingTestInstance.displayResults === 'function') {
                window.hearingTestInstance.displayResults('results-container');
            }
        })
        .catch(error => {
            console.error('Błąd ładowania Chart.js:', error);
        });
}




