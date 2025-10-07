const modalSteps = [
    "/assets/partials/modal-intro.html",            // Wprowadzenie
    "/assets/partials/modal-preparation.html",      // Przygotowanie
    // "/assets/partials/modal-test-1-intro.html",
    "/assets/partials/modal-test-1.html",           // Test 1kHz
    // "/assets/partials/modal-test-2-intro.html",
    "/assets/partials/modal-test-2.html",           // Test maksymalnej częstotliwości
    // "/assets/partials/modal-test-3-intro.html",
    "/assets/partials/modal-test-3.html"            // Test losowych częstotliwości - po tym następuje przekierowanie do /results/
];
let currentStep = 0;

// Elementy
const modal = document.getElementById('hearing-modal');
const modalContent = document.getElementById('modal-content');
const btnClose = document.getElementById('modal-close');

// Funkcja otwierająca modal
function openModal() {

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

function showModalStep(step) {
    const modalDialog = modal.querySelector('.modal-container'); // Zmiana selektora na właściwy

    // Ustaw standardową szerokość dla wszystkich kroków
    modalDialog.classList.remove('wide-width');
    modalDialog.classList.add('standard-width');
    modalDialog.style.maxHeight = '';

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
            } else if (step === 2) { // Test 1: Test 1kHz
                window.hearingTestInstance.initialize('hear-button', 'test-instruction', 'sound-wave-canvas');
                window.hearingTestInstance.start1kHzTest();

                document.getElementById('hear-button').onclick = () => {
                    window.hearingTestInstance.recordHearing();
                };

                // Event listener dla zakończenia testu 1kHz
                window.addEventListener('test1kHzCompleted', () => {
                    setTimeout(() => { currentStep++; showModalStep(currentStep); }, 500);
                }, { once: true });
            } else if (step === 3) { // Test 2: Test maksymalnej częstotliwości
                window.hearingTestInstance.initialize('hear-button', 'test-instruction', 'sound-wave-canvas');
                window.hearingTestInstance.startMaxFrequencyTest();

                document.getElementById('hear-button').onclick = () => {
                    window.hearingTestInstance.recordHearing();
                };

                // Event listener dla zakończenia testu maksymalnej częstotliwości
                window.addEventListener('maxFrequencyTestCompleted', () => {
                    setTimeout(() => { currentStep++; showModalStep(currentStep); }, 500);
                }, { once: true });
            } else if (step === 4) { // Test 3: Test losowych częstotliwości
                window.hearingTestInstance.initialize('hear-button', 'test-instruction', 'sound-wave-canvas');
                window.hearingTestInstance.startRandomFrequencyTest();

                // Nasłuchuj na niestandardowy event, który zasygnalizuje koniec tego etapu
                window.addEventListener('randomTestCompleted', () => {
                    console.log('Event "randomTestCompleted" received. Advancing to results page.');

                    // Zapisz dane testu do localStorage
                    if (window.hearingTestInstance) {
                        const testResults = {
                            hearingLevels: window.hearingTestInstance.hearingLevels || [],
                            maxAudibleFrequency: window.hearingTestInstance.maxAudibleFrequency || 20000,
                            timestamp: new Date().getDate().toString()
                        };

                        sessionStorage.setItem('hearingTestResults', JSON.stringify(testResults));
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
            } else {
                // Nieznany krok
                console.error('Nieznany krok modala:', step);
                return;
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

// Wstrzykiwanie headera i footera
function injectHeaderAndFooter() {
    fetch('/assets/partials/header.html')
        .then(res => res.text())
        .then(html => {
            const headerElement = document.getElementById('main-header');
            if (headerElement) {
                headerElement.innerHTML = html;
            }
        })
        .catch(err => console.error('Error loading header:', err));

    fetch('/assets/partials/footer.html')
        .then(res => res.text())
        .then(html => {
            const footerElement = document.getElementById('main-footer');
            if (footerElement) {
                footerElement.innerHTML = html;
            }
        })
        .catch(err => console.error('Error loading footer:', err));
}

// Wywołaj na załadowaniu strony
document.addEventListener('DOMContentLoaded', function() {
    injectHeaderAndFooter();
});