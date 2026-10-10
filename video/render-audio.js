// Renders the demo's soundtrack offline from an event log, so the concept video has exactly
// the audio the live demo would make. Used only by the video pipeline.
import * as Tone from 'tone';
import { Audio } from '../src/audio.js';
import { RAGAS, SA } from '../src/raga.js';

function toWavBase64(buffer, gain = 1) {
  const ch = [buffer.getChannelData(0), buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0)];
  const n = buffer.length;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
  out.setUint32(24, buffer.sampleRate, true); out.setUint32(28, buffer.sampleRate * 4, true);
  out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
    const v = Math.max(-1, Math.min(1, ch[c][i] * gain));
    out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
  }
  const bytes = new Uint8Array(out.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

window.renderAudio = async ({ log, duration, raga = 'yaman', tail = 6 }) => {
  const buf = await Tone.Offline(async ({ transport }) => {
    const r = RAGAS[raga];
    const a = new Audio();
    await a.init(r);
    transport.start(0);
    a.tanpuraLoop.start(0);
    a.seq.start(0);
    let padOn = false;
    for (const e of log) {
      const t = Math.max(0.001, e.t);
      if (e.k === 'pluck') a.notes.play(e.f, t + 0.005);
      else if (e.k === 'layers') {
        a.tablaGain.gain.setTargetAtTime(0.06 + e.tabla * 0.94, t, 0.4);
        a.sitarGain.gain.setTargetAtTime(e.sitar * 0.7, t, 0.4);
        a.padGain.gain.setTargetAtTime(e.ensemble * 0.9, t, 0.7);
        transport.schedule(() => { a.layer = { tabla: e.tabla, sitar: e.sitar, ensemble: e.ensemble }; }, t);
        if (e.ensemble > 0.4 && !padOn) { padOn = true; a.pad.triggerAttack([SA, SA * r.ratios[4], SA * r.ratios[2] * 2], t); }
        else if (e.ensemble < 0.15 && padOn) { padOn = false; a.pad.releaseAll(t); }
      } else if (e.k === 'resolve') {
        a.padGain.gain.setTargetAtTime(1, t, 0.2);
        a.pad.releaseAll(t);
        a.pad.triggerAttackRelease([SA, SA * r.ratios[4], SA * 2, SA * r.ratios[2] * 2], 6, t + 0.05);
        a.tablaGain.gain.setTargetAtTime(0, t, 1.0);
        a.sitarGain.gain.setTargetAtTime(0, t, 0.7);
        transport.schedule((time) => a.sitar.play(SA * 2, time), t + 0.1);
        transport.schedule((time) => a.sitar.play(SA * 4, time), t + 0.6);
        transport.schedule(() => { a.seq.stop(); }, t);
      }
    }
  }, duration + tail, 2, 44100);
  const ab = buf.get();
  let peak = 0; const d = ab.getChannelData(0);
  for (let i = 0; i < d.length; i += 7) peak = Math.max(peak, Math.abs(d[i]));
  let pk = 0; const d1 = ab.getChannelData(0), d2 = ab.getChannelData(ab.numberOfChannels > 1 ? 1 : 0);
  for (let i = 0; i < d1.length; i++) pk = Math.max(pk, Math.abs(d1[i]), Math.abs(d2[i]));
  const gain = pk > 0.9 ? 0.9 / pk : 1;
  return { wav: toWavBase64(ab, gain), peak: pk, gain, seconds: ab.duration };
};
window.__audioRenderReady = true;

// Sound effects for the non-demo scenes: horns, a reset thud, chimes and soft claps.
window.renderSfx = async ({ events, duration }) => {
  const buf = await Tone.Offline(async () => {
    const out = new Tone.Gain(0.9).toDestination();
    const rev = new Tone.Reverb({ decay: 3, wet: 0.35 }).connect(out);
    await rev.generate();
    const horn = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.02, decay: 0.05, sustain: 0.9, release: 0.08 } });
    const hf = new Tone.Filter(1700, 'lowpass').connect(out);
    horn.connect(hf); horn.volume.value = -16;
    const thud = new Tone.MembraneSynth({ pitchDecay: 0.2, octaves: 3, envelope: { attack: 0.001, decay: 0.7, sustain: 0 } }).connect(out);
    thud.volume.value = -6;
    const chime = new Tone.PluckSynth({ attackNoise: 0.5, dampening: 5200, resonance: 0.985 }).connect(rev);
    chime.volume.value = -4;
    const clapF = new Tone.Filter(1700, 'bandpass').connect(rev);
    const clap = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.07, sustain: 0 } }).connect(clapF);
    clap.volume.value = -9;
    for (const e of events) {
      if (e.k === 'honk') horn.triggerAttackRelease(['G4', 'Bb4'], 0.3, e.t);
      if (e.k === 'thud') thud.triggerAttackRelease(55, 0.6, e.t);
      if (e.k === 'chime') chime.triggerAttack(e.f, e.t);
      if (e.k === 'clap') clap.triggerAttackRelease(0.06, e.t);
    }
  }, duration, 2, 44100);
  const ab = buf.get();
  let pk = 0; const d1 = ab.getChannelData(0);
  for (let i = 0; i < d1.length; i++) pk = Math.max(pk, Math.abs(d1[i]));
  return { wav: toWavBase64(ab, pk > 0.9 ? 0.9 / pk : 1), peak: pk, seconds: ab.duration };
};
