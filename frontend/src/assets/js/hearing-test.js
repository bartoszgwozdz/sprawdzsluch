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
  }

  // *** NOWA METODA DO ODBLOKOWANIA AUDIO NA URZĄDZENIACH MOBILNYCH ***
  unlockAudio() {
    if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('AudioContext created on user gesture.');
    }
    if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
            console.log('AudioContext resumed successfully!');
        }).catch(e => console.error('Error resuming AudioContext:', e));
    }
  }

  initialize(hearButtonId, instructionId) {
    this.hearButton = document.getElementById(hearButtonId);
    this.testInstruction = document.getElementById(instructionId);

    // Jeśli AudioContext nie istnieje, utwórz go.
    // Na mobile zostanie on w pełni aktywowany przez unlockAudio().
    if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('AudioContext initialized. State:', this.audioContext.state);
    }
    
    // Jeśli węzły już istnieją, nie twórz ich ponownie
    if (this.oscillator) return;

    // Przypisz węzły bezpośrednio do właściwości klasy
    this.oscillator = this.audioContext.createOscillator();
    this.gainNode = this.audioContext.createGain();

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime); // Zacznij od zera głośności
    this.oscillator.start();

    // Usunięto blok try-catch z resume(), ponieważ jest to teraz obsługiwane przez unlockAudio()
  }

  // Metody dla poszczególnych etapów testu
  startAdjusting1kHz() {
    this.testInstruction.textContent = "Najpierw musimy ustawić poziom referencyjny 0 dB. Ton o częstotliwości 1kHz zacznie bardzo cicho i będzie stopniowo zwiększał głośność. Kliknij 'Słyszę!' gdy tylko usłyszysz dźwięk.";
    this.currentFrequency = 1000;
    this.currentGain = 0.00001;
    this.playTone(this.currentFrequency, this.currentGain);
    this.testRunning = true;
    this.hearButton.disabled = false;
    console.log("startAdjusting1kHz - currentFrequency:", this.currentFrequency, "currentGain:", this.currentGain); // ADDED LOG
    this.startIncreasingGain();
  }

  findMaxFrequency() {
    this.testInstruction.textContent = "Świetnie! Teraz znajdziemy Twoją najwyższą słyszalną częstotliwość. Ton rozpocznie się od 20kHz (bardzo wysoki) i będzie stopniowo obniżany. Kliknij 'Słyszę!' w MOMENCIE gdy usłyszysz dźwięk.";
    this.currentFrequency = 20000;
    const decrement = 500;
    const initialGain = this.referenceLevel * 1.414; // ~+3dB
    this.playTone(this.currentFrequency, initialGain);
    this.hearButton.disabled = false;
    this.testRunning = true;

    clearInterval(this.frequencyDescentInterval);

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

      this.playTone(this.currentFrequency, initialGain);
    }, 1000);
  }

  startRandomFrequencyTest() {
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
    console.log("prepareFrequenciesArray - frequencyOrder:", this.frequencyOrder); // ADDED LOG
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

      console.log("playNextFrequency - frequency:", this.currentFrequency, "currentGain:", this.currentGain, "currentFrequencyIndex:", this.currentFrequencyIndex);

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

      console.log("Test complete. Final results:", this.hearingLevels);
      this.testRunning = false;
      
      // Wywołaj event informujący o zakończeniu testu losowych częstotliwości
      window.dispatchEvent(new CustomEvent('randomTestCompleted'));
    }
  }

  startIncreasingGain() {
    clearInterval(this.increaseGainInterval);
    console.log("startIncreasingGain - currentFrequency:", this.currentFrequency); // ADDED LOG

    this.increaseGainInterval = setInterval(() => {
      if (this.testRunning && this.currentGain < 0.1) {
        // POPRAWKA: Użyj this.gainNode zamiast this.audioContext.gainNode
        const gainNode = this.gainNode; 
        this.currentGain *= 1.62; // Small increment
        gainNode.gain.setValueAtTime(this.currentGain, this.audioContext.currentTime);
        // console.log("increaseGainInterval - currentGain:", this.currentGain); // Opcjonalny log
      } else {
        clearInterval(this.increaseGainInterval); // Stop if button is clicked or test is stopped
        console.log("clearInterval - currentFrequency:", this.currentFrequency, "testRunning:", this.testRunning, "currentGain >= 0.1:", this.currentGain >= 0.1); // ADDED LOG
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
    console.log("Executing stopCurrentTest...");
    this.testRunning = false; // Zatrzymaj pętle testowe

    // Zatrzymaj interwały
    if (this.increaseGainInterval) clearInterval(this.increaseGainInterval);
    if (this.frequencyDescentInterval) clearInterval(this.frequencyDescentInterval);
    
    // Wycisz dźwięk
    this.stopTone();
    console.log("Test sound stopped and intervals cleared.");
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
      console.log(this.hearingLevels);
      console.log("recordHearing - referenceLevel set to:", this.referenceLevel, "currentFrequency:", this.currentFrequency); // ADDED LOG
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
        console.log("Random frequency test completed.");
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

  // Dodaj te metody do obiektu hearingTestInstance w pliku hearing-test.js

  // Zatrzymanie odtwarzania dźwięku, zachowując stan testu
  pauseAudio() {
      if (this.audioContext && this.oscillator) {
          // Zapamiętaj aktualne parametry dźwięku
          this._savedFrequency = this.currentFrequency;
          this._savedGain = this.currentGain;
          this._isPaused = true;
          
          // Zatrzymaj odtwarzanie
          this.oscillator.stop();
          this.oscillator = null;
      }
  }

  // Wznowienie odtwarzania dźwięku z zachowanymi parametrami
  resumeAudio() {
      if (this.audioContext && this._isPaused) {
          // Odtwórz dźwięk z zapamiętanymi parametrami
          this._isPaused = false;
          this.oscillator = this.audioContext.createOscillator();
          this.oscillator.type = 'sine';
          this.oscillator.frequency.value = this._savedFrequency || 1000;
          
          this.gainNode = this.audioContext.createGain();
          this.gainNode.gain.value = this._savedGain || 0;
          
          this.oscillator.connect(this.gainNode);
          this.gainNode.connect(this.audioContext.destination);
          
          this.oscillator.start();
          
          // Wznów odpowiedni test w zależności od kroku
          if (this.testPhase === 'adjusting1kHz') {
              this.continueAdjusting1kHz();
          } else if (this.testPhase === 'maxFrequency') {
              this.continueMaxFrequencyTest();
          } else if (this.testPhase === 'randomFrequency') {
              this.continueRandomFrequencyTest();
          }
      }
  }

  // Całkowite zatrzymanie testu audio
  stopAudio() {
      if (this.audioContext) {
          if (this.oscillator) {
              this.oscillator.stop();
              this.oscillator = null;
          }
          this._isPaused = false;
          this._savedFrequency = null;
          this._savedGain = null;
      }
  }

  // Metody do kontynuowania poszczególnych testów
  continueAdjusting1kHz() {
      // Kod do kontynuowania testu 1kHz od miejsca zatrzymania
      if (this._savedFrequency && this._savedGain) {
          // Kontynuuj od zapamiętanych parametrów
      }
  }

  continueMaxFrequencyTest() {
      // Kod do kontynuowania testu maksymalnej częstotliwości
  }

  continueRandomFrequencyTest() {
      // Kod do kontynuowania testu losowych częstotliwości
  }
}


// Ukrywamy globalny zasięg w IIFE (Immediately Invoked Function Expression)
(() => {
  window.hearingTestInstance = new HearingTest();
})();