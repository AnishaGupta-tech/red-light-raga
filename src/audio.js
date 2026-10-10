import * as Tone from 'tone';
import { SA, TEENTAAL, BPM, BEAT } from './raga.js';

// Every sound is synthesised in the browser. No samples, so nothing to license.

class PluckPool {
  constructor(n, dest, opts) {
    this.voices = Array.from({ length: n }, () => {
      const v = new Tone.PluckSynth(opts);
      v.connect(dest);
      return v;
    });
    this.i = 0;
  }
  play(freq, time) {
    const v = this.voices[this.i++ % this.voices.length];
    v.triggerAttack(freq, time);
  }
}

export class Audio {
  constructor() {
    this.ready = false;
    this.muted = false;
    this.layer = { tabla: 0, sitar: 0, ensemble: 0 };
    this.onBeat = null;
  }

  async init(raga) {
    await Tone.start();
    const ctx = Tone.getContext();
    this.ctx = ctx.rawContext;
    this.raga = raga;

    this.master = new Tone.Gain(0.9);
    const comp = new Tone.Compressor(-18, 3);
    const limiter = new Tone.Limiter(-2);
    this.reverb = new Tone.Reverb({ decay: 3.6, wet: 0.28 });
    await this.reverb.generate();
    this.master.chain(comp, limiter, Tone.getDestination());
    this.bus = new Tone.Gain(1).connect(this.reverb);
    this.reverb.connect(this.master);
    this.dry = new Tone.Gain(0.85).connect(this.master);

    // Tanpura: Pa, Sa, Sa, low Sa, always on
    this.tanpuraGain = new Tone.Gain(0.55);
    this.tanpuraGain.connect(this.bus);
    this.tanpuraGain.connect(this.dry);
    this.tanpura = new PluckPool(3, this.tanpuraGain, { attackNoise: 0.6, dampening: 2600, resonance: 0.985 });
    const tp = [0.75, 1, 1, 0.5];
    let ti = 0;
    this.tanpuraLoop = new Tone.Loop((t) => {
      this.tanpura.play(SA * tp[ti++ % 4], t);
    }, 1.15);

    // Tabla
    this.tablaGain = new Tone.Gain(0);
    this.tablaGain.connect(this.dry);
    this.tablaGain.connect(this.bus);
    this.bayan = new Tone.MembraneSynth({
      pitchDecay: 0.12, octaves: 2.2,
      envelope: { attack: 0.001, decay: 0.55, sustain: 0, release: 0.2 },
    }).connect(this.tablaGain);
    this.dayan = new Tone.MembraneSynth({
      pitchDecay: 0.008, octaves: 1.4,
      envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.1 },
    }).connect(this.tablaGain);
    this.tick = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    });
    const tickFilter = new Tone.Filter(3400, 'bandpass').connect(this.tablaGain);
    this.tick.connect(tickFilter);
    this.bayan.volume.value = -4;
    this.dayan.volume.value = -9;
    this.tick.volume.value = -22;

    // User notes: bright sitar-ish pluck
    this.noteGain = new Tone.Gain(0.8);
    this.noteGain.connect(this.bus);
    this.noteGain.connect(this.dry);
    this.notes = new PluckPool(6, this.noteGain, { attackNoise: 2.2, dampening: 4800, resonance: 0.975 });

    // Sitar line that joins once the group is in time
    this.sitarGain = new Tone.Gain(0);
    this.sitarGain.connect(this.bus);
    this.sitarGain.connect(this.dry);
    this.sitar = new PluckPool(4, this.sitarGain, { attackNoise: 1.4, dampening: 3800, resonance: 0.98 });

    // Ensemble pad: Sa Pa + the raga's third
    this.padGain = new Tone.Gain(0);
    this.padGain.connect(this.bus);
    this.padGain.connect(this.dry);
    const padFilter = new Tone.Filter(1400, 'lowpass').connect(this.padGain);
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', count: 3, spread: 14 },
      envelope: { attack: 2.2, decay: 0.4, sustain: 0.9, release: 3 },
    }).connect(padFilter);
    this.pad.volume.value = -16;

    this.reverb.wet.value = 0.28;

    Tone.getTransport().bpm.value = BPM;
    Tone.getTransport().timeSignature = 4;

    // Theka
    this.beatIndex = 0;
    this.sitarWalk = 0;
    this.seq = new Tone.Loop((t) => this._beat(t), '4n');
    this.ready = true;
  }

  _beat(t) {
    const b = this.beatIndex % TEENTAAL.beats;
    const bol = TEENTAAL.theka[b];
    const lowF = SA * 0.5;
    const highF = SA * 2;
    const bay = bol === 'Dha' || bol === 'Dhin' || bol === 'Ge';
    const day = bol !== 'Ge';
    if (bay) this.bayan.triggerAttackRelease(lowF, 0.4, t, bol === 'Dhin' ? 0.6 : 0.85);
    if (day) {
      const f = bol === 'Tin' ? highF * 1.5 : bol === 'Ta' ? highF * 1.5 : highF;
      this.dayan.triggerAttackRelease(f, 0.2, t, bol === 'Tin' || bol === 'Ta' ? 0.7 : 0.55);
    }
    this.tick.triggerAttackRelease(0.03, t, 0.5);

    // sitar fills on every second beat once unlocked
    if (b % 2 === 0 && this.layer.sitar > 0.05) {
      const ph = this.raga.phrases[Math.floor(this.sitarWalk / 8) % this.raga.phrases.length];
      const d = ph[this.sitarWalk % ph.length];
      this.sitarWalk++;
      const oct = Math.floor(d / 7);
      const idx = ((d % 7) + 7) % 7;
      this.sitar.play(SA * this.raga.ratios[idx] * Math.pow(2, oct) * 2, t + 0.02);
    }
    this.beatIndex++;
    if (this.onBeat) this.onBeat(b, t);
  }

  start() {
    const tr = Tone.getTransport();
    this.t0 = this.ctx.currentTime + 0.15;
    tr.start(`+0.15`);
    this.tanpuraLoop.start(0);
    this.seq.start(0);
    this.padChordOn = false;
  }

  // seconds since the signal turned red, on the audio clock
  now() {
    return this.ctx.currentTime - this.t0;
  }

  outputLatency() {
    return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
  }

  pluck(freq, vel = 0.9) {
    if (!this.ready) return;
    this.notes.play(freq, Tone.now() + 0.005);
  }

  setLayers(sync) {
    const smooth = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
    const tabla = smooth(sync, 0.12, 0.3);
    const sitar = smooth(sync, 0.42, 0.58);
    const ens = smooth(sync, 0.7, 0.85);
    this.layer = { tabla, sitar, ensemble: ens };
    if (!this.ready) return;
    this.tablaGain.gain.rampTo(0.06 + tabla * 0.94, 1.2);
    this.sitarGain.gain.rampTo(sitar * 0.7, 1.2);
    this.padGain.gain.rampTo(ens * 0.9, 2.2);
    if (ens > 0.4 && !this.padChordOn) {
      this.padChordOn = true;
      const r = this.raga.ratios;
      this.pad.triggerAttack([SA, SA * r[4], SA * r[2] * 2], Tone.now());
    } else if (ens < 0.15 && this.padChordOn) {
      this.padChordOn = false;
      this.pad.releaseAll();
    }
  }

  // The resolving chord when the light turns green
  resolve() {
    if (!this.ready) return;
    const r = this.raga.ratios;
    this.padGain.gain.rampTo(1, 0.6);
    this.pad.releaseAll();
    this.pad.triggerAttackRelease([SA, SA * r[4], SA * 2, SA * r[2] * 2], 6, Tone.now() + 0.05);
    this.tablaGain.gain.rampTo(0, 3);
    this.sitarGain.gain.rampTo(0, 2);
    this.seq.stop();
    this.sitar.play(SA * 2, Tone.now() + 0.1);
    this.sitar.play(SA * 4, Tone.now() + 0.6);
  }

  stop() {
    if (!this.ready) return;
    const tr = Tone.getTransport();
    this.tanpuraLoop.stop();
    this.seq.stop();
    tr.stop();
    this.pad.releaseAll();
    this.tanpuraGain.gain.rampTo(0, 2);
  }

  setMuted(m) {
    this.muted = m;
    if (this.ready) this.master.gain.rampTo(m ? 0 : 0.9, 0.2);
  }
}

export const BEAT_SECONDS = BEAT;
