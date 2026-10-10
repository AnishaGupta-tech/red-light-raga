import { PitchDetector } from 'pitchy';

// Microphone input: spectral-flux onset detection for claps, autocorrelation for hums.
// Calls onEvent({ t, freq|null, strength }) with t on the audio clock.

export class MicInput {
  constructor(ctx, { headphones = false } = {}) {
    this.ctx = ctx;
    this.headphones = headphones;
    this.level = 0;
    this.running = false;
  }

  async start(onEvent) {
    this.onEvent = onEvent;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // Speakers + mic: keep echo cancellation on. Headphones: take the raw signal.
        echoCancellation: !this.headphones,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.an = this.ctx.createAnalyser();
    this.an.fftSize = 2048;
    this.an.smoothingTimeConstant = 0;
    src.connect(this.an);

    this.spec = new Float32Array(this.an.frequencyBinCount);
    this.prev = new Float32Array(this.an.frequencyBinCount);
    this.wave = new Float32Array(this.an.fftSize);
    this.hist = [];
    this.noise = 0.004;
    this.lastOnset = -1;
    this.lastVoiced = { degreeKey: null, since: 0, fired: false };
    this.detector = PitchDetector.forFloat32Array(this.an.fftSize);
    this.pendingPitchAt = 0;
    this.running = true;
    this.settings = this.stream.getAudioTracks()[0].getSettings();
    this._loop();
  }

  _loop = () => {
    if (!this.running) return;
    this._frame();
    this.raf = requestAnimationFrame(this._loop);
  };

  _frame() {
    const now = this.ctx.currentTime;
    this.an.getFloatFrequencyData(this.spec);
    this.an.getFloatTimeDomainData(this.wave);

    let sum = 0;
    for (let i = 0; i < this.wave.length; i++) sum += this.wave[i] * this.wave[i];
    const rms = Math.sqrt(sum / this.wave.length);
    this.level = this.level * 0.8 + rms * 0.2;
    // slow noise-floor tracker
    this.noise = rms < this.noise ? this.noise * 0.9 + rms * 0.1 : this.noise * 0.9995 + rms * 0.0005;
    const gate = Math.max(this.noise * 3, 0.012);

    // spectral flux on log-compressed magnitudes, ~130 Hz to 8 kHz
    let flux = 0;
    for (let i = 3; i < 380; i++) {
      const db = this.spec[i];
      const mag = Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
      const c = Math.log1p(60 * mag);
      const d = c - this.prev[i];
      if (d > 0) flux += d;
      this.prev[i] = c;
    }
    this.hist.push(flux);
    if (this.hist.length > 40) this.hist.shift();
    const mean = this.hist.reduce((a, b) => a + b, 0) / this.hist.length;
    const sd = Math.sqrt(this.hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / this.hist.length);
    const thr = mean + 2.4 * sd + 0.9;

    const t = now - 0.03; // analysis delay
    if (flux > thr && rms > gate && now - this.lastOnset > 0.14) {
      this.lastOnset = now;
      this.pendingPitchAt = now + 0.045;
      this.pendingT = t;
      this.pendingStrength = Math.min(1, flux / (thr * 2));
    }
    if (this.pendingPitchAt && now >= this.pendingPitchAt) {
      this.pendingPitchAt = 0;
      const [pitch, clarity] = this.detector.findPitch(this.wave, this.ctx.sampleRate);
      const voiced = clarity > 0.93 && pitch > 90 && pitch < 900;
      this.onEvent({ t: this.pendingT, freq: voiced ? pitch : null, strength: this.pendingStrength });
    }

    // hummed notes that start softly (no sharp onset)
    if (rms > gate * 1.4 && now - this.lastOnset > 0.3) {
      const [pitch, clarity] = this.detector.findPitch(this.wave, this.ctx.sampleRate);
      if (clarity > 0.95 && pitch > 90 && pitch < 900) {
        const key = Math.round(12 * Math.log2(pitch / 110));
        const lv = this.lastVoiced;
        if (lv.degreeKey !== key) {
          lv.degreeKey = key;
          lv.since = now;
          lv.fired = false;
        } else if (!lv.fired && now - lv.since > 0.16) {
          lv.fired = true;
          this.lastOnset = now;
          this.onEvent({ t: lv.since, freq: pitch, strength: 0.6 });
        }
      }
    } else if (rms < gate) {
      this.lastVoiced.degreeKey = null;
    }
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach((tr) => tr.stop());
  }
}
