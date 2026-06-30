const modalSteps = [
    "/assets/partials/modal-intro.html",            // 0 Wprowadzenie
    "/assets/partials/modal-preparation.html",      // 1 Przygotowanie (słuchawki)
    "/assets/partials/modal-calibration.html",      // 2 Kalibracja głośności
    "/assets/partials/modal-test-1.html",           // 3 Test 1kHz (referencja)
    "/assets/partials/modal-test-2.html",           // 4 Test maksymalnej częstotliwości
    "/assets/partials/modal-test-3.html"            // 5 Test losowych częstotliwości (-> /results/)
];
// Indeksy kroków testowych (z aktywnym dźwiękiem) — używane przez pauzę/wznowienie
const TEST_STEPS = { CALIBRATION: 2, TEST_1KHZ: 3, MAX_FREQ: 4, RANDOM: 5 };
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

// Wiąże przyciski w modalu potwierdzenia wyjścia. Wywoływane przy KAŻDYM otwarciu
// potwierdzenia (X, klik poza modalem, Escape), aby pauza/wznowienie było
// deterministyczne niezależnie od ścieżki wyjścia.
function wireConfirmExitButtons() {
    const confirmExitModal = document.getElementById('confirm-exit-modal');
    const confirmExitYes = document.getElementById('confirm-exit-yes');
    const confirmExitNo = document.getElementById('confirm-exit-no');

    if (confirmExitYes) {
        confirmExitYes.onclick = () => {
            // Potwierdzono wyjście: zatrzymaj test na stałe
            if (window.hearingTestInstance) {
                window.hearingTestInstance.stopAudio();
                console.log('Test audio stopped permanently');
            }
            confirmExitModal.classList.remove('show');
            modal.classList.remove('show');
        };
    }
    if (confirmExitNo) {
        confirmExitNo.onclick = () => {
            confirmExitModal.classList.remove('show');
            // Wznów test po anulowaniu wyjścia
            toggleTestPause(false);
        };
    }
}

// Otwiera potwierdzenie wyjścia (z pauzą testu) lub zamyka modal na wprowadzeniu.
function requestExit() {
    if (currentStep >= 1) {
        const confirmExitModal = document.getElementById('confirm-exit-modal');
        confirmExitModal.classList.add('show');
        // Zatrzymaj test audio, gdy pokazujemy potwierdzenie
        toggleTestPause(true);
        wireConfirmExitButtons();
    } else {
        // Jeśli jesteśmy na wprowadzeniu, po prostu zamknij modal
        modal.classList.remove('show');
    }
}

// Zamknięcie modalu (przycisk X)
btnClose.onclick = requestExit;

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
// Wiąże widoczny przycisk pauzy/wznowienia w krokach testowych (zamienia ikonę)
function wirePauseButton() {
    const pauseBtn = document.getElementById('pause-button');
    if (!pauseBtn) return;
    pauseBtn.onclick = () => {
        const h = window.hearingTestInstance;
        if (!h) return;
        const icon = pauseBtn.querySelector('.material-icons');
        if (!h._isPaused) {
            h.pauseAudio();
            if (icon) icon.textContent = 'play_arrow';
            pauseBtn.setAttribute('aria-label', 'Wznów test');
        } else {
            h.resumeAudio();
            if (icon) icon.textContent = 'pause';
            pauseBtn.setAttribute('aria-label', 'Wstrzymaj test');
        }
    };
}

function showModalStep(step) {
    const modalDialog = modal.querySelector('.modal-container'); // Zmiana selektora na właściwy

    // Wszystkie kroki flow testu mają standardową szerokość
    modalDialog.classList.remove('wide-width');
    modalDialog.classList.add('standard-width');
    modalDialog.style.maxHeight = '';

    fetch(modalSteps[step])
        .then(res => res.text())
        .then(html => {
            const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            modalContent.innerHTML = bodyMatch ? bodyMatch[1] : html;

            const h = window.hearingTestInstance;

            // --- Logika specyficzna dla każdego kroku ---

            if (step === 0) { // Wprowadzenie
                const understandBtn = document.getElementById('understand-button');
                if (understandBtn) {
                    understandBtn.onclick = () => { currentStep++; showModalStep(currentStep); };
                }
            } else if (step === 1) { // Przygotowanie (słuchawki)
                const checkbox = document.getElementById('headphones-checkbox');
                const startBtn = document.getElementById('start-test-button');
                if (checkbox && startBtn) {
                    startBtn.disabled = true; // Domyślnie wyłączony
                    checkbox.onchange = () => { startBtn.disabled = !checkbox.checked; };
                    startBtn.onclick = () => {
                        // Odblokuj audio w odpowiedzi na gest użytkownika
                        if (h) h.unlockAudio();
                        currentStep++;
                        showModalStep(currentStep);
                    };
                }
            } else if (step === 2) { // Kalibracja głośności
                // initialize tworzy (raz) oscylator i węzły audio
                h.initialize('hear-button', 'test-instruction');

                const playBtn = document.getElementById('calib-play-button');
                const contBtn = document.getElementById('calib-continue-button');
                const hint = document.querySelector('.calib-hint');
                let playing = false;

                if (playBtn) {
                    playBtn.onclick = () => {
                        const icon = playBtn.querySelector('.material-icons');
                        const label = playBtn.querySelector('.calib-play__label');
                        playing = !playing;
                        if (playing) {
                            h.playCalibrationTone();
                            playBtn.classList.add('is-playing');
                            playBtn.setAttribute('aria-pressed', 'true');
                            if (icon) icon.textContent = 'stop';
                            if (label) label.textContent = 'Zatrzymaj dźwięk';
                            if (contBtn) contBtn.disabled = false; // odsłuchano -> można dalej
                            if (hint) hint.style.display = 'none';
                        } else {
                            h.stopCalibrationTone();
                            playBtn.classList.remove('is-playing');
                            playBtn.setAttribute('aria-pressed', 'false');
                            if (icon) icon.textContent = 'play_arrow';
                            if (label) label.textContent = 'Włącz dźwięk testowy';
                        }
                    };
                }
                if (contBtn) {
                    contBtn.onclick = () => {
                        h.stopCalibrationTone();
                        currentStep++;
                        showModalStep(currentStep);
                    };
                }
            } else if (step === 3) { // Test 1kHz (referencja)
                h.initialize('hear-button', 'test-instruction');
                h.startAdjusting1kHz();
                wirePauseButton();
                document.getElementById('hear-button').onclick = () => {
                    h.recordHearing();
                    setTimeout(() => { currentStep++; showModalStep(currentStep); }, 500);
                };
            } else if (step === 4) { // Test max częstotliwości
                h.initialize('hear-button', 'test-instruction');
                h.findMaxFrequency();
                wirePauseButton();
                document.getElementById('hear-button').onclick = () => {
                    h.recordHearing();
                    setTimeout(() => { currentStep++; showModalStep(currentStep); }, 500);
                };
            } else if (step === 5) { // Test losowych częstotliwości
                h.initialize('hear-button', 'test-instruction');
                wirePauseButton();

                // WAŻNE: dodaj listener PRZED startem testu, aby uniknąć wyścigu zakończenia
                // (event randomTestCompleted może wystąpić natychmiast, np. przy pustej liście).
                window.addEventListener('randomTestCompleted', () => {
                    console.log('Event "randomTestCompleted" received. Advancing to results page.');

                    // Zapisz dane testu do sessionStorage
                    if (window.hearingTestInstance) {
                        const testResults = {
                            hearingLevels: window.hearingTestInstance.hearingLevels || [],
                            maxAudibleFrequency: window.hearingTestInstance.maxAudibleFrequency || 20000,
                            timestamp: new Date().toISOString()
                        };
                        sessionStorage.setItem('hearingTestResults', JSON.stringify(testResults));
                    }

                    if (modal) modal.classList.remove('show');

                    // Przekieruj do strony z wynikami
                    window.location.href = '/results/';
                }, { once: true });

                // Start testu DOPIERO po zarejestrowaniu listenera zakończenia
                h.startRandomFrequencyTest();

                document.getElementById('hear-button').onclick = () => { h.recordHearing(); };
            }
        })
        .catch(error => {
            console.error('Error loading step:', error);
            modalContent.innerHTML = '<p class="p-4 text-red-500">Could not load content. Please try again.</p>';
        });
}

// Zatrzymanie/wznowienie testu (używane przez modal potwierdzenia wyjścia)
function toggleTestPause(shouldPause) {
    const h = window.hearingTestInstance;
    if (!h) return;

    if (currentStep === TEST_STEPS.CALIBRATION) {
        // W kroku kalibracji wyciszamy ton próbny (bez stanu pauzy testu)
        if (shouldPause) h.stopCalibrationTone();
        return;
    }
    if (currentStep >= TEST_STEPS.TEST_1KHZ && currentStep <= TEST_STEPS.RANDOM) {
        if (shouldPause) { h.pauseAudio(); console.log('Test audio paused'); }
        else { h.resumeAudio(); console.log('Test audio resumed'); }
    }
}

// Zamknięcie modalu po kliknięciu poza oknem
modal.addEventListener('mousedown', e => {
    if (e.target === modal) {
        requestExit();
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
        else {
            requestExit();
        }
    }
});

// Kod główny na stronie — wstrzyknięcie hearing-test.js (idempotentne).
// Jeśli instancja już istnieje (np. po przywróceniu z bfcache), nie wstrzykuj ponownie.
if (!window.hearingTestInstance) {
    fetch('/assets/js/hearing-test.js')
        .then(response => response.text())
        .then(code => {
            // Wykonanie kodu dopiero po pobraniu
            const script = document.createElement('script');
            script.textContent = code;
            document.head.appendChild(script);
        });
}

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

// Wstrzykiwanie metod płatności (Paynow) do każdego kontenera [data-payment-methods]
const paymentContainers = document.querySelectorAll('[data-payment-methods]');
if (paymentContainers.length) {
    fetch('/assets/partials/payment-methods.html')
        .then(res => res.text())
        .then(html => {
            paymentContainers.forEach(el => { el.innerHTML = html; });
        });
}

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
                                maintainAspectRatio: false,
                                layout: { padding: { top: 26, left: 8, right: 8 } },
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
                                                    content: 'Maks. zakres',
                                                    position: 'start',
                                                    yAdjust: -14,
                                                    backgroundColor: 'rgba(21,128,61,0.92)',
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
                            `Maks. ${maxKHz} kHz`;
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




