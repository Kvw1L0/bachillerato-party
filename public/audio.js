// Web Audio API Sound Synthesizer (sin archivos mp3 externos)
class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, startTime = 0, gainVal = 0.2) {
    if (this.muted) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + startTime);
      osc.stop(this.ctx.currentTime + startTime + duration);
    } catch (e) {
      // Audio fallback
    }
  }

  // Sonido de clic suave
  click() {
    this.playTone(600, 'sine', 0.05, 0, 0.15);
  }

  // Sonido de cuenta regresiva estándar
  tick() {
    this.playTone(800, 'triangle', 0.08, 0, 0.2);
  }

  // Sonido de tensión dramática para los últimos 10 segundos
  tensionTick(secondsLeft) {
    this.init();
    // Aumenta la frecuencia y urgencia a medida que se acerca a 0
    const urgency = Math.max(1, Math.min(10, 11 - secondsLeft));
    const baseFreq = 650 + (urgency * 65); // De 715Hz a 1300Hz
    // Doble pulso estilo latido acelerado
    this.playTone(baseFreq, 'sawtooth', 0.08, 0, 0.25);
    this.playTone(baseFreq * 0.8, 'sine', 0.06, 0.1, 0.2);
  }

  // Sonido de Buzzer de tiempo agotado
  buzzer() {
    this.init();
    this.playTone(160, 'sawtooth', 0.5, 0, 0.3);
    this.playTone(220, 'sawtooth', 0.5, 0.05, 0.25);
  }

  // Sonido de ruleta girando
  wheelTick() {
    this.playTone(450 + Math.random() * 200, 'square', 0.03, 0, 0.08);
  }

  // Sonido de Alarma / ¡STOP!
  stopAlarm() {
    this.init();
    const now = 0;
    this.playTone(880, 'sawtooth', 0.15, now, 0.25);
    this.playTone(440, 'sawtooth', 0.2, now + 0.18, 0.25);
    this.playTone(880, 'sawtooth', 0.15, now + 0.4, 0.25);
    this.playTone(440, 'sawtooth', 0.3, now + 0.58, 0.25);
  }

  // Fanfarria al proyectar respuesta en voz alta (Spotlight)
  spotlight() {
    this.init();
    this.playTone(392.00, 'triangle', 0.15, 0, 0.2);    // G4
    this.playTone(523.25, 'triangle', 0.15, 0.12, 0.2); // C5
    this.playTone(659.25, 'triangle', 0.15, 0.24, 0.2); // E5
    this.playTone(783.99, 'triangle', 0.4, 0.36, 0.25); // G5
  }

  // Sonido de votación registrada
  vote() {
    this.playTone(987.77, 'sine', 0.12, 0, 0.18); // B5
  }

  // Respuesta aprobada / válida
  valid() {
    this.init();
    this.playTone(523.25, 'sine', 0.12, 0, 0.2);
    this.playTone(659.25, 'sine', 0.25, 0.1, 0.2);
  }

  // Respuesta rechazada
  invalid() {
    this.init();
    this.playTone(300, 'sawtooth', 0.18, 0, 0.25);
    this.playTone(220, 'sawtooth', 0.3, 0.15, 0.25);
  }

  // Fanfarria de victoria / Podio
  victory() {
    this.init();
    const chords = [
      { f: 523.25, t: 0 },
      { f: 523.25, t: 0.12 },
      { f: 523.25, t: 0.24 },
      { f: 659.25, t: 0.36 },
      { f: 783.99, t: 0.6 },
      { f: 1046.50, t: 0.85 }
    ];
    chords.forEach(c => {
      this.playTone(c.f, 'triangle', 0.35, c.t, 0.25);
    });
  }
}

const audio = new GameAudio();
