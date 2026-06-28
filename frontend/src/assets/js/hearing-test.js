// Przykład obfuskacji kodu
function _0x2a4e() { const _0x5e9b3a = ['1121605ThGBzo', '136LnVXce', 'test', '12875370iHCikl']; _0x2a4e = function () { return _0x5e9b3a; }; return _0x2a4e(); }

// Główna klasa zarządzająca testem słuchu
class HearingTest {
  constructor() {
    this.audioContext;
    this.frequencies = [125, 250, 400, 630, 2000, 3200, 5000, 6300, 8000, 10000, 12000, 16000, 20000];
    this.hearingLevels = [];
    this.frequencyOrder = [];
    this.currentFrequencyIndex = 0;
    this.testRunning = false;
    this.increaseGainInterval;
    this.frequencyDescentInterval;
    this.maxAudibleFrequency = 20000;
    this.referenceLevel = 0.001;
    this.currentGain = 0.00001;
    this.currentFrequency = 1000;
    this.testStage = 0;
    this.age = 30; // Domyślny wiek, aktualizowany przez użytkownika
    this.hearButton = null;
    this.testInstruction = null;
    this.oscillator = null;
    this.gainNode = null; // Dodaj właściwość dla gainNode
    this._isPaused = false; // Dodane: Flaga wstrzymania
    this._savedFrequency = null; // Dodane: Zapamiętana częstotliwość
    this._savedGain = null; // Dodane: Zapamiętana głośność

    // Pojedynczy cykl życia: stan fazy testu + parametry zejścia częstotliwości
    this.testPhase = 'idle'; // 'idle' | 'adjusting1kHz' | 'maxFrequency' | 'randomFrequency' | 'complete'
    this._pausedByVisibility = false; // czy pauza pochodzi ze zmiany widoczności karty
    this._descentDecrement = 500;
    this._descentGain = this.referenceLevel * 1.414;

    // Referencje do związanych handlerów (do rejestracji i usunięcia w destroy)
    this._onVisibilityChange = this._handleVisibilityChange.bind(this);
    this._onPageHide = this._handlePageHide.bind(this);
    this._onPageShow = this._handlePageShow.bind(this);
    this._lifecycleBound = false;
  }

  // Minimalne logowanie diagnostyczne (włącz przez window.HEARING_DEBUG = true)
  _log(...args) {
    if (typeof window !== 'undefined' && window.HEARING_DEBUG) {
      console.log('[hearing-test]', ...args);
    }
  }

  // Upewnij się, że AudioContext nie jest „suspended" (Safari/mobile po nawigacji)
  ensureRunning() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume()
        .then(() => this._log('AudioContext resumed (ensureRunning), state:', this.audioContext.state))
        .catch(e => this._log('ensureRunning resume error:', e));
    }
  }

  // Rejestracja handlerów cyklu życia strony (idempotentna)
  _bindLifecycle() {
    if (this._lifecycleBound) return;
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('pagehide', this._onPageHide);
    window.addEventListener('pageshow', this._onPageShow);
    this._lifecycleBound = true;
  }

  _handleVisibilityChange() {
    if (document.hidden) {
      // Wstrzymaj odtwarzanie, gdy karta przechodzi w tło (tylko aktywny test)
      if (this.testRunning && !this._isPaused) {
        this._log('visibilitychange -> hidden: pauseAudio');
        this._pausedByVisibility = true;
        this.pauseAudio();
      }
    } else {
      // Powrót do karty: wznów TYLKO jeśli to my wstrzymaliśmy przez ukrycie karty
      // (nie nadpisuj pauzy wywołanej modalem potwierdzenia wyjścia).
      if (this._pausedByVisibility && this._isPaused &&
          this.testPhase !== 'idle' && this.testPhase !== 'complete') {
        this._log('visibilitychange -> visible: resumeAudio');
        this._pausedByVisibility = false;
        this.ensureRunning();
        this.resumeAudio();
      }
    }
  }

  _handlePageHide() {
    // Nawigacja/zamknięcie: wycisz i wyczyść interwały, by nic nie grało w tle
    this._log('pagehide: stopCurrentTest');
    this.stopCurrentTest();
  }

  _handlePageShow(event) {
    // Przywrócenie z bfcache: zresetuj do bezpiecznego stanu zatrzymanego
    if (event && event.persisted) {
      this._log('pageshow (bfcache): reset to stopped state');
      this.testRunning = false;
      this._isPaused = false;
      clearInterval(this.increaseGainInterval);
      clearInterval(this.frequencyDescentInterval);
    }
  }

  // *** NOWA METODA DO ODBLOKOWANIA AUDIO NA URZĄDZENIACH MOBILNYCH ***
  unlockAudio() {
    if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this._log('AudioContext created on user gesture.');
    }
    this.ensureRunning();
  }

  initialize(hearButtonId, instructionId) {
    this.hearButton = document.getElementById(hearButtonId);
    this.testInstruction = document.getElementById(instructionId);

    // Zarejestruj handlery cyklu życia strony (idempotentnie)
    this._bindLifecycle();

    // Jeśli AudioContext nie istnieje, utwórz go.
    // Na mobile zostanie on w pełni aktywowany przez unlockAudio().
    if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this._log('AudioContext initialized. State:', this.audioContext.state);
    }
    this.ensureRunning();

    // Jeden, długożyjący oscylator: jeśli już istnieje, nie twórz go ponownie.
    if (this.oscillator) return;

    // Przypisz węzły bezpośrednio do właściwości klasy
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = 'sine';
    this.gainNode = this.audioContext.createGain();

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime); // Zacznij od zera głośności
    this.oscillator.start();
  }

  // Metody dla poszczególnych etapów testu
  startAdjusting1kHz() {
    this.testPhase = 'adjusting1kHz';
    this.ensureRunning();
    this.testInstruction.textContent = "Najpierw musimy ustawić poziom referencyjny 0 dB. Ton o częstotliwości 1kHz zacznie bardzo cicho i będzie stopniowo zwiększał głośność. Kliknij 'Słyszę!' gdy tylko usłyszysz dźwięk.";
    this.currentFrequency = 1000;
    this.currentGain = 0.00001;
    this.playTone(this.currentFrequency, this.currentGain);
    this.testRunning = true;
    this.hearButton.disabled = false;
    this._log("startAdjusting1kHz - currentFrequency:", this.currentFrequency, "currentGain:", this.currentGain);
    this.startIncreasingGain();
  }

  findMaxFrequency() {
    this.testPhase = 'maxFrequency';
    this.ensureRunning();
    this.testInstruction.textContent = "Świetnie! Teraz znajdziemy Twoją najwyższą słyszalną częstotliwość. Ton rozpocznie się od 20kHz (bardzo wysoki) i będzie stopniowo obniżany. Kliknij 'Słyszę!' w MOMENCIE gdy usłyszysz dźwięk.";
    this.currentFrequency = 20000;
    this._descentDecrement = 500;
    this._descentGain = this.referenceLevel * 1.414; // ~+3dB
    this.currentGain = this._descentGain;
    this.playTone(this.currentFrequency, this._descentGain);
    this.hearButton.disabled = false;
    this.testRunning = true;
    this.startFrequencyDescent(this._descentDecrement, this._descentGain);
  }

  // Zejście częstotliwości — wyodrębnione, aby resumeAudio mogło je wznowić
  startFrequencyDescent(decrement, gain) {
    clearInterval(this.frequencyDescentInterval);
    this._log("startFrequencyDescent - from:", this.currentFrequency, "decrement:", decrement);

    this.frequencyDescentInterval = setInterval(() => {
      if (!this.testRunning) {
        clearInterval(this.frequencyDescentInterval);
        return;
      }

      this.currentFrequency -= decrement;
      if (this.currentFrequency <= 0) {
        clearInterval(this.frequencyDescentInterval);
        this.testRunning = false;
        this.maxAudibleFrequency = 0;
        this.testInstruction.textContent = "Nie udało się określić maksymalnej częstotliwości.";
        this.testStage = 2;
        // Tutaj zakończyłby się ten etap
        return;
      }

      this.currentGain = gain;
      this.playTone(this.currentFrequency, gain);
    }, 1000);
  }

  startRandomFrequencyTest() {
    this.testPhase = 'randomFrequency';
    this.ensureRunning();
    this.prepareFrequenciesArray();
    this.playNextFrequency();
  }

  prepareFrequenciesArray() {
    // Filter frequencies based on maxAudibleFrequency
    const filteredFrequencies = this.frequencies.filter(freq => freq <= this.maxAudibleFrequency);
    // Prepare the frequencyOrder array with the frequencies to be tested
    // Zakładając, że shuffleArray to globalna funkcja pomocnicza
    this.frequencyOrder = this.shuffleArray(filteredFrequencies);
    this.currentFrequencyIndex = 0;
    this._log("prepareFrequenciesArray - frequencyOrder:", this.frequencyOrder);
  }


  playNextFrequency() {
    // Pobierz element licznika za każdym razem, gdy funkcja jest wywoływana
    const counterElement = document.getElementById('frequency-counter');

    if (this.currentFrequencyIndex < this.frequencyOrder.length) {
      this.currentFrequency = this.frequencyOrder[this.currentFrequencyIndex];

      // ZAKTUALIZUJ LICZNIK
      if (counterElement) {
        counterElement.textContent = `Ton ${this.currentFrequencyIndex + 1} / ${this.frequencyOrder.length}`;
      }

      // Ustaw bardzo niską początkową głośność
      this.currentGain = 0.00001;

      this._log("playNextFrequency - frequency:", this.currentFrequency, "currentGain:", this.currentGain, "currentFrequencyIndex:", this.currentFrequencyIndex);

      // Odtwórz ton z początkową (cichą) głośnością
      this.playTone(this.currentFrequency, this.currentGain);

      // Włącz przycisk
      if (this.hearButton) this.hearButton.disabled = false;

      // Włącz mechanizm zwiększania głośności
      this.testRunning = true;
      this.startIncreasingGain();

    } else {
      // Test complete
      this.stopTone();
      
      // Ukryj licznik po zakończeniu testu
      if (counterElement) {
        counterElement.textContent = "Test zakończony!";
      }

      this._log("Test complete. Final results:", this.hearingLevels);
      this.testRunning = false;
      this.testPhase = 'complete';

      // Wywołaj event informujący o zakończeniu testu losowych częstotliwości
      window.dispatchEvent(new CustomEvent('randomTestCompleted'));
    }
  }

  startIncreasingGain() {
    clearInterval(this.increaseGainInterval);
    this._log("startIncreasingGain - currentFrequency:", this.currentFrequency);

    this.increaseGainInterval = setInterval(() => {
      if (this.testRunning && this.currentGain < 0.1) {
        // POPRAWKA: Użyj this.gainNode zamiast this.audioContext.gainNode
        const gainNode = this.gainNode;
        if (!gainNode) { clearInterval(this.increaseGainInterval); return; }
        this.currentGain *= 1.62; // Small increment
        gainNode.gain.setValueAtTime(this.currentGain, this.audioContext.currentTime);
      } else {
        clearInterval(this.increaseGainInterval); // Stop if button is clicked or test is stopped
        this._log("increaseGain stopped - currentFrequency:", this.currentFrequency, "testRunning:", this.testRunning, "currentGain>=0.1:", this.currentGain >= 0.1);
      }
    }, 666); // Zmniejszono interwał dla płynniejszego podgłaśniania
  }

  // Funkcje pomocnicze
  playTone(frequency, gainValue) {
    if (!this.oscillator || !this.gainNode) return;
    this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    this.gainNode.gain.setTargetAtTime(gainValue, this.audioContext.currentTime, 0.01); // Płynne przejście
  }

  stopTone() {
    if (!this.gainNode) return;
    this.gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01); // Płynne wyciszenie
  }

  stopCurrentTest() {
    this._log("Executing stopCurrentTest...");
    this.testRunning = false; // Zatrzymaj pętle testowe

    // Zatrzymaj interwały
    clearInterval(this.increaseGainInterval);
    clearInterval(this.frequencyDescentInterval);

    // Wycisz dźwięk
    this.stopTone();
    this._log("Test sound stopped and intervals cleared.");
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
  }

  /**
   * Sprawdza, czy test losowych częstotliwości został zakończony.
   * @returns {boolean} Zwraca true, jeśli wszystkie zaplanowane częstotliwości zostały przetestowane.
   */
  isTestComplete() {
    return this.testStage === 2 && this.currentFrequencyIndex >= this.frequencyOrder.length;
  }


  // Obsługa kliknięcia przycisku "Słyszę"
  recordHearing() {
    if (this.hearButton) this.hearButton.disabled = true;
    this.testRunning = false;

    clearInterval(this.frequencyDescentInterval);
    clearInterval(this.increaseGainInterval);
    this.stopTone();

    if (this.testStage === 0) {
      this.referenceLevel = this.currentGain;
      this.hearingLevels.push({ frequency: this.currentFrequency, gain: this.currentGain });
      this._log("recordHearing - referenceLevel set to:", this.referenceLevel, "currentFrequency:", this.currentFrequency, this.hearingLevels);
      this.testStage = 1;
    } else if (this.testStage === 1) {
      this.maxAudibleFrequency = this.currentFrequency;
      this.testStage = 2;
    } else if (this.testStage === 2) {
      this.hearingLevels.push({ frequency: this.currentFrequency, gain: this.currentGain });

      this.currentFrequencyIndex++;
      // Sprawdź, czy to nie koniec testu, zanim odtworzysz następny ton
      if (!this.isTestComplete()) {
        this.playNextFrequency();
      } else {
        this._log("Random frequency test completed.");
        this.testPhase = 'complete';
        window.dispatchEvent(new CustomEvent('randomTestCompleted'));
      }
    }
  }

  /**
   * Zwraca wartość korekcji dla danej częstotliwości na podstawie krzywej izofonicznej.
   * Wartości bazują na przybliżeniu krzywej ISO 226:2003 dla poziomu głośności 40 fonów.
   * @param {number} frequency - Częstotliwość w Hz.
   * @returns {number} Wartość korekcji w dB.
   */
  getIsofonicCorrection(frequency) {
    // Przybliżone wartości korekcji dla krzywej 40 fonów (ISO 226:2003)
    const corrections = [
      { freq: 20, correction: 71.5 },
      { freq: 25, correction: 65.0 },
      { freq: 31.5, correction: 59.0 },
      { freq: 40, correction: 53.0 },
      { freq: 50, correction: 47.5 },
      { freq: 63, correction: 42.5 },
      { freq: 80, correction: 37.5 },
      { freq: 100, correction: 33.0 },
      // { freq: 125, correction: 28.5 },
      { freq: 125, correction: 8.5 },
      { freq: 160, correction: 24.0 },
      { freq: 200, correction: 20.0 },
      // { freq: 250, correction: 16.0 },
      { freq: 250, correction: 5.0 },
      { freq: 315, correction: 12.5 },
      // { freq: 400, correction: 9.5 },
      { freq: 400, correction: 4.5 },
      { freq: 500, correction: 7.0 },
      { freq: 630, correction: 5.0 },
      { freq: 800, correction: 3.0 },
      { freq: 1000, correction: 0.0 }, // punkt odniesienia
      { freq: 1250, correction: -2.0 },
      { freq: 1600, correction: -4.0 },
      { freq: 2000, correction: -5.5 },
      { freq: 2500, correction: -6.0 },
      { freq: 3150, correction: -5.0 },
      { freq: 4000, correction: -3.0 },
      { freq: 5000, correction: 0.0 },
      { freq: 6300, correction: 1.5 },
      { freq: 8000, correction: 2.5 },
      { freq: 10000, correction: 3.0 },
      { freq: 12500, correction: 3.0 },
      { freq: 16000, correction: 2.0 },
      { freq: 20000, correction: 0.0 }
    ];
    
    // Znajdź najbliższą częstotliwość w tabeli korekcji
    let closestCorrection = 0;
    let minDiff = Infinity;
    
    for (const entry of corrections) {
      const diff = Math.abs(entry.freq - frequency);
      if (diff < minDiff) {
        minDiff = diff;
        closestCorrection = entry.correction;
      }
    }
    
    return closestCorrection;
  }

  // Wstrzymanie testu: wyciszenie + zatrzymanie pętli, BEZ niszczenia oscylatora.
  // Oscylator żyje przez cały cykl (jeden, długożyjący) — zatrzymany OscillatorNode
  // nie da się wznowić, więc tylko wyciszamy i czyścimy interwały.
  pauseAudio() {
      if (this._isPaused) return;
      // Zapamiętaj aktualne parametry dźwięku do wznowienia
      this._savedFrequency = this.currentFrequency;
      this._savedGain = this.currentGain;
      this._isPaused = true;
      this.testRunning = false; // wstrzymaj pętle (interwały i tak czyścimy)

      clearInterval(this.increaseGainInterval);
      clearInterval(this.frequencyDescentInterval);
      this.stopTone();
      this._log('pauseAudio - phase:', this.testPhase, 'freq:', this._savedFrequency, 'gain:', this._savedGain);
  }

  // Wznowienie testu: przywróć ton z zapisanych parametrów i wejdź ponownie
  // w pętlę bieżącej fazy (faza-świadome wznowienie).
  resumeAudio() {
      if (!this._isPaused) return;
      this._isPaused = false;
      this._pausedByVisibility = false;
      this.ensureRunning();

      // Przywróć parametry tonu
      this.currentFrequency = this._savedFrequency || this.currentFrequency || 1000;
      this.currentGain = this._savedGain || this.currentGain || 0.00001;
      this.testRunning = true;
      this.playTone(this.currentFrequency, this.currentGain);

      this._log('resumeAudio - phase:', this.testPhase, 'freq:', this.currentFrequency, 'gain:', this.currentGain);

      // Wejdź ponownie w pętlę odpowiedniej fazy
      if (this.testPhase === 'adjusting1kHz' || this.testPhase === 'randomFrequency') {
          this.startIncreasingGain();
      } else if (this.testPhase === 'maxFrequency') {
          this.startFrequencyDescent(this._descentDecrement, this._descentGain);
      }
  }

  // Całkowite zatrzymanie testu audio (np. po potwierdzeniu wyjścia)
  stopAudio() {
      this.testRunning = false;
      this._isPaused = false;
      clearInterval(this.increaseGainInterval);
      clearInterval(this.frequencyDescentInterval);
      this.stopTone();
      this._savedFrequency = null;
      this._savedGain = null;
      this.testPhase = 'idle';
      this._log('stopAudio - test stopped, intervals cleared');
  }

  // Jawny cykl życia: pełne sprzątanie instancji (interwały, węzły, handlery)
  destroy() {
      clearInterval(this.increaseGainInterval);
      clearInterval(this.frequencyDescentInterval);
      this.testRunning = false;
      this._isPaused = false;
      this.testPhase = 'idle';

      if (this.oscillator) {
          try { this.oscillator.stop(); } catch (e) { /* już zatrzymany */ }
          try { this.oscillator.disconnect(); } catch (e) { /* noop */ }
          this.oscillator = null;
      }
      if (this.gainNode) {
          try { this.gainNode.disconnect(); } catch (e) { /* noop */ }
          this.gainNode = null;
      }

      // Usuń handlery cyklu życia strony
      if (this._lifecycleBound) {
          document.removeEventListener('visibilitychange', this._onVisibilityChange);
          window.removeEventListener('pagehide', this._onPageHide);
          window.removeEventListener('pageshow', this._onPageShow);
          this._lifecycleBound = false;
      }
      // Nie zamykamy audioContext — jeden kontekst reużywamy (zamykanie kosztowne na Safari)
      this._log('destroy - instance cleaned up');
  }
}


// Ukrywamy globalny zasięg w IIFE (Immediately Invoked Function Expression)
(() => {
  // Pojedynczy cykl życia: zniszcz starą instancję przed utworzeniem nowej
  // (defensywnie wobec ponownego wstrzyknięcia skryptu).
  if (window.hearingTestInstance && typeof window.hearingTestInstance.destroy === 'function') {
    window.hearingTestInstance.destroy();
  }
  window.hearingTestInstance = new HearingTest();
})();