import './style.css';
import { Audio } from './audio.js';
import { MicInput } from './input.js';
import { Stage, C } from './stage.js';
import { RAGAS, ragaForNow, quantize, degreeFreq, degreeName, PhraseWalker, TEENTAAL, BEAT } from './raga.js';

const $ = (id) => document.getElementById(id);
const TOTAL = TEENTAAL.cycleSeconds * 8; // 90 s

const stage = new Stage($('stage'));
const params = new URLSearchParams(location.search);
// ?video=1 drives the demo on a virtual clock with no audio device, for rendering the concept video.
const VIDEO = params.get('video') === '1';
window.__vt = 0;
if (VIDEO) document.documentElement.classList.add('video');
const clockNow = () => (VIDEO ? window.__vt : performance.now() / 1000);
if (VIDEO) window.__vlog = [];
const vlog = (o) => VIDEO && window.__vlog.push(o);

function stubAudio() {
  const smooth = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  return {
    ready: true, layer: { tabla: 0, sitar: 0, ensemble: 0 }, t0: 0, ctx: { currentTime: 0 },
    async init() {}, start() {}, stop() {}, setMuted() {}, outputLatency: () => 0, now: () => window.__vt,
    pluck(f) { vlog({ k: 'pluck', t: window.__vt, f }); },
    setLayers(sync) {
      this.layer = { tabla: smooth(sync, 0.12, 0.3), sitar: smooth(sync, 0.42, 0.58), ensemble: smooth(sync, 0.7, 0.85) };
      vlog({ k: 'layers', t: window.__vt, ...this.layer, sync });
    },
    resolve() { vlog({ k: 'resolve', t: window.__vt }); },
  };
}

const st = {
  running: false,
  done: false,
  mode: 'mic',
  raga: ragaForNow(),
  sync: 0,
  progress: 0,
  revealed: 0,
  notes: 0,
  inTime: 0,
  khaliKept: 0,
  khaliTotal: 0,
  lastBeat: -1,
  lastCycle: -1,
  activity: [], // onset times, for khali evaluation
  khaliHits: 0,
  khaliChecked: -1,
  lastInTime: -99,
  firstInput: false,
  layerPush: 0,
  lastFrame: 0,
};
let audio = null;
let mic = null;
let walker = null;
let crowd = [];
let crowdIdx = 0;

// ---------- intro wiring ----------
function applyRaga(r) {
  st.raga = r;
  $('ragaName').textContent = r.name;
  $('ragaWhen').textContent = `${r.when}${r.hours ? ' · ' + r.hours : ''}`;
  stage.setRaga(r);
}
applyRaga(st.raga);

const q = params.get('mode');
if (q && ['mic', 'tap', 'crowd'].includes(q)) {
  const el = document.querySelector(`input[name=mode][value=${q}]`);
  if (el) el.checked = true;
}
if (params.get('raga') && RAGAS[params.get('raga')]) {
  $('ragaSel').value = params.get('raga');
  applyRaga(RAGAS[params.get('raga')]);
}
$('ragaSel').addEventListener('change', (e) => applyRaga(e.target.value === 'auto' ? ragaForNow() : RAGAS[e.target.value]));

function showErr(msg) {
  const el = $('err');
  el.textContent = msg;
  el.hidden = !msg;
}

// ---------- session ----------
async function begin() {
  showErr('');
  st.mode = document.querySelector('input[name=mode]:checked').value;
  $('begin').disabled = true;
  $('begin').textContent = 'Tuning the tanpura…';
  try {
    audio = VIDEO ? stubAudio() : new Audio();
    await audio.init(st.raga);
  } catch (e) {
    console.error(e);
    showErr('Audio could not start in this browser. Try Chrome, Edge or Safari.');
    $('begin').disabled = false;
    $('begin').textContent = 'Begin the wait';
    return;
  }

  if (st.mode === 'mic' && !VIDEO) {
    mic = new MicInput(audio.ctx, { headphones: $('phones').checked });
    try {
      await mic.start((ev) => onEvent(ev));
    } catch (e) {
      console.warn('mic unavailable', e);
      mic = null;
      st.mode = 'tap';
      showErr('');
      toast('Microphone unavailable, switched to tap mode.');
    }
  }

  reset();
  walker = new PhraseWalker(st.raga);
  if (st.mode === 'crowd') buildCrowd();
  audio.start();
  st.running = true;
  $('intro').hidden = true;
  $('outro').hidden = true;
  for (const id of ['hud-top', 'hud-bottom', 'center']) $(id).hidden = false;
  $('micMeter').hidden = st.mode !== 'mic';
  $('modeTag').textContent =
    st.mode === 'crowd'
      ? 'Simulated crowd. Nobody is actually clapping, this shows the full 90 second arc.'
      : st.mode === 'mic'
        ? 'Clap or hum. Beats 1, 5 and 13 are the claps. Beat 9 is the empty beat.'
        : 'Click, touch or press Space. Where you tap sets the swara.';
  $('begin').disabled = false;
  $('begin').textContent = 'Begin the wait';
}

function reset() {
  Object.assign(st, {
    done: false, sync: 0, progress: 0, revealed: 0, notes: 0, inTime: 0, khaliKept: 0, khaliTotal: 0,
    lastBeat: -1, lastCycle: -1, activity: [], khaliHits: 0, khaliChecked: -1, lastInTime: -99, firstInput: false, layerPush: 0,
  });
  stage.reset();
  $('signal').dataset.state = 'red';
  document.querySelectorAll('.layer').forEach((l) => l.classList.toggle('on', l.dataset.k === 'tanpura'));
  document.querySelectorAll('.layer u').forEach((u) => (u.style.width = u.parentElement.parentElement.dataset.k === 'tanpura' ? '100%' : '0'));
}

// ---------- events from mic / tap / crowd ----------
function onEvent(ev) {
  if (!st.running || st.done) return;
  const ts = ev.t - audio.t0 - audio.outputLatency();
  if (ts < 0) return;
  const phase = ts / BEAT;
  const nearest = Math.round(phase);
  const d = Math.abs(phase - nearest) * BEAT;
  const half = Math.round(phase * 2) / 2;
  const dh = Math.abs(phase - half) * BEAT;
  const score = (x) => (x < 0.075 ? 1 : x < 0.15 ? 0.75 : x < 0.23 ? 0.4 : 0);
  let qlt = Math.max(score(d), score(dh) * 0.5);
  const beatIdx = ((nearest % 16) + 16) % 16;
  const now = clockNow();

  // note
  let note;
  if (ev.freq) note = quantize(st.raga, ev.freq);
  else if (typeof ev.x === 'number') {
    const deg = Math.round(ev.x * 7);
    note = { degree: deg, freq: degreeFreq(st.raga, deg), name: degreeName(st.raga, deg) };
  } else note = walker.next();
  audio.pluck(note.freq);
  st.notes++;
  st.firstInput = true;

  const khali = beatIdx === TEENTAAL.khali && Math.abs(ts - nearest * BEAT) < BEAT * 0.6 && phase > 0.5;
  if (khali) {
    st.khaliHits++;
    qlt = 0;
  }
  vlog({ k: khali ? 'khali-break' : qlt >= 0.4 ? 'hit' : 'off', t: ts, note: note.name, beat: beatIdx });
  st.activity.push(ts);

  if (qlt >= 0.4) {
    st.inTime++;
    st.lastInTime = ts;
    st.sync = Math.min(1, st.sync + 0.05 * qlt * (1 - 0.3 * st.sync));
    st.progress += qlt * (0.13 + 0.17 * st.sync);
    stage.pulse(beatIdx, true, now);
    while (st.progress >= 1 && st.revealed < stage.groupCount) {
      st.progress -= 1;
      const pos = stage.reveal(st.revealed++, now);
      if (pos) stage.ripple(pos.x, pos.y, C.mint, now);
    }
  } else {
    st.sync = Math.max(0, st.sync - 0.02);
    stage.pulse(beatIdx, false, now);
    stage.scatter(now);
  }
  coach();
}

// ---------- input: tap / space ----------
window.addEventListener('pointerdown', (e) => {
  if (!st.running || st.mode !== 'tap' || e.target.closest('button, label, select, a')) return;
  onEvent({ t: audio.ctx.currentTime, freq: null, x: e.clientX / window.innerWidth });
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && st.running && st.mode === 'tap' && !e.repeat) {
    e.preventDefault();
    onEvent({ t: audio.ctx.currentTime, freq: null });
  }
});

// ---------- simulated crowd ----------
function buildCrowd() {
  let s = 20260515;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 0.09;
  crowd = [];
  for (let c = 0; c < 8; c++) {
    const people = Math.min(6, 1 + Math.floor(c * 0.85));
    for (let p = 0; p < people; p++) {
      const sloppy = p === 0 && c < 2 ? 0.5 : rnd() < 0.14 ? 0.5 : 0;
      const beats = [0, 4, 12, 2, 6, 10, 14, 8];
      const prob = [0.92, 0.9, 0.9, 0.3, 0.3, 0.28, 0.3, c > 1 && rnd() < 0.02 ? 1 : 0];
      beats.forEach((b, i) => {
        if (rnd() > prob[i] - (c === 0 ? 0.25 : 0)) return;
        const ts = (c * 16 + b) * BEAT + gauss() + (sloppy ? (rnd() - 0.5) * 0.4 : 0);
        const sing = rnd() < 0.22;
        const deg = Math.floor(rnd() * 8);
        crowd.push({ ts, freq: sing ? degreeFreq(st.raga, deg) * (1 + (rnd() - 0.5) * 0.01) : null });
      });
    }
  }
  crowd.sort((a, b) => a.ts - b.ts);
  crowdIdx = 0;
}

// ---------- the 90 second loop ----------
function coach() {
  const el = $('coach');
  const t = st.lastT ?? 0;
  const beat = Math.floor(t / BEAT) % 16;
  let msg = '';
  let hot = false;
  if (st.done) msg = 'The light is green.';
  else if (!st.firstInput && t < 14) msg = st.mode === 'tap' ? 'Tap along with the tabla. Beats 1, 5 and 13 are the claps.' : st.mode === 'crowd' ? 'A simulated crowd is joining in.' : 'Clap with the tabla, or hum a note.';
  else if (beat === 7 || beat === 8) { msg = beat === 8 ? 'Khali. The empty beat. Hold the silence together.' : 'Next is the empty beat. Hold back.'; hot = true; }
  else if (st.sync > 0.75) msg = 'Everyone is in time. Listen to the ensemble.';
  else if (st.sync > 0.42) msg = 'The sitar has joined. Keep the pulse.';
  else if (st.sync > 0.12) msg = 'The tabla heard you. Stay with the beat.';
  else msg = 'Find the pulse. It is the dot that lights up.';
  el.textContent = msg;
  el.classList.toggle('hot', hot);
}

function frame() {
  requestAnimationFrame(frame);
  render(performance.now() / 1000, true);
}

function render(now, draw) {
  const dt = Math.min(0.1, now - (st.lastFrame || now));
  st.lastFrame = now;

  if (!st.running) {
    if (draw) stage.draw({ now, t: 0, total: TOTAL, beatPos: 0, sync: 0.15, ghost: true, done: false });
    return;
  }
  const t = Math.max(0, audio.now());
  st.lastT = t;

  // simulated crowd
  if (st.mode === 'crowd') {
    while (crowdIdx < crowd.length && crowd[crowdIdx].ts <= t) {
      const c = crowd[crowdIdx++];
      onEvent({ t: audio.t0 + c.ts + audio.outputLatency(), freq: c.freq });
    }
  }

  if (!st.done) {
    // decay
    st.sync = Math.max(0, st.sync - dt * 0.006);

    const beatPos = t / BEAT;
    const beatNow = Math.floor(beatPos) % 16;
    const cycle = Math.floor(t / TEENTAAL.cycleSeconds);
    if (beatNow !== st.lastBeat) {
      st.lastBeat = beatNow;
      const bol = $('bol');
      bol.textContent = TEENTAAL.theka[beatNow];
      bol.classList.toggle('khali', beatNow === TEENTAAL.khali);
      coach();
    }
    if (cycle !== st.lastCycle) {
      st.lastCycle = cycle;
      $('cycle').textContent = `Cycle ${Math.min(8, cycle + 1)} of 8`;
    }

    // evaluate the empty beat once its window has passed (beat 9 ± half a beat)
    const khaliEnd = cycle * 16 * BEAT + (TEENTAAL.khali + 0.6) * BEAT;
    if (t >= khaliEnd && st.khaliChecked !== cycle) {
      st.khaliChecked = cycle;
      const from = cycle * 16 * BEAT + 4 * BEAT;
      const to = cycle * 16 * BEAT + (TEENTAAL.khali - 0.4) * BEAT;
      const before = st.activity.filter((x) => x >= from && x < to).length;
      if (before > 0) {
        st.khaliTotal++;
        if (st.khaliHits === 0) {
          st.khaliKept++;
          vlog({ k: 'khali-kept', t });
          st.sync = Math.min(1, st.sync + 0.08);
          stage.bloom(now);
          $('coach').textContent = 'Held. Listen to it open up.';
          $('coach').classList.add('hot');
        }
      }
      st.khaliHits = 0;
      st.activity = st.activity.filter((x) => x > t - 30);
    }

    // layers
    st.layerPush += dt;
    if (st.layerPush > 0.25) {
      st.layerPush = 0;
      audio.setLayers(st.sync);
      document.querySelectorAll('.layer').forEach((el) => {
        const k = el.dataset.k;
        const v = k === 'tanpura' ? 1 : audio.layer[k];
        el.classList.toggle('on', v > 0.3);
        el.querySelector('u').style.width = `${Math.round(v * 100)}%`;
      });
    }

    // clock
    const left = Math.max(0, Math.ceil(TOTAL - t));
    $('clock').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    $('mSync').textContent = `${Math.round(st.sync * 100)}%`;
    $('mKolam').textContent = `${Math.min(100, Math.round(((st.revealed + Math.min(1, st.progress)) / stage.groupCount) * 100))}%`;
    $('mKhali').textContent = `${st.khaliKept}/${st.khaliTotal}`;
    if (mic) $('micBar').style.width = `${Math.min(100, mic.level * 900)}%`;

    if (t >= TOTAL) finish(now);
  }

  if (draw) stage.draw({
    now,
    t,
    total: TOTAL,
    beatPos: t / BEAT,
    sync: st.sync,
    ghost: false,
    done: st.done,
  });
}

function finish(now) {
  st.done = true;
  $('signal').dataset.state = 'green';
  $('clock').textContent = '0:00';
  stage.bloom(now, C.mint);
  audio.resolve();
  if (mic) mic.stop();
  $('bol').textContent = 'Chalo';
  $('bol').classList.add('khali');
  $('coach').textContent = 'The light is green.';
  if (!VIDEO) setTimeout(() => {
    const kolam = Math.round(((st.revealed + Math.min(1, st.progress)) / stage.groupCount) * 100);
    const sync = st.notes ? Math.round((st.inTime / st.notes) * 100) : 0;
    $('oSync').textContent = `${sync}%`;
    $('oNotes').textContent = st.notes;
    $('oKhali').textContent = `${st.khaliKept}/${st.khaliTotal}`;
    $('oKolam').textContent = `${Math.min(100, kolam)}%`;
    $('oLine').textContent =
      kolam >= 90 ? 'The whole kolam bloomed. Nobody planned it, you just listened to each other.' :
      kolam >= 40 ? 'Part of the kolam is drawn. Next red light, hold the empty beat together.' :
      st.notes === 0 ? 'The tanpura waited, but nobody joined. Next time, try a clap on the first beat.' :
      'The raga is still shy. Try clapping on beats 1, 5 and 13, and keep quiet on beat 9.';
    $('outro').hidden = false;
    $('center').hidden = true;
    $('hud-bottom').hidden = true;
    audio.stop();
  }, 2400);
}

$('begin').addEventListener('click', begin);
$('again').addEventListener('click', () => {
  $('outro').hidden = true;
  $('again2').hidden = true;
  for (const id of ['hud-top', 'hud-bottom', 'center']) $(id).hidden = true;
  st.running = false;
  stage.reset();
  $('intro').hidden = false;
});
$('seeKolam').addEventListener('click', () => {
  $('outro').hidden = true;
  $('center').hidden = false;
  $('hud-bottom').hidden = false;
  $('again2').hidden = false;
});
$('again2').addEventListener('click', () => {
  $('again2').hidden = true;
  $('again').click();
});
$('mute').addEventListener('click', (e) => {
  const m = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', String(m));
  e.currentTarget.textContent = m ? 'Sound off' : 'Sound on';
  if (audio) audio.setMuted(m);
});

function toast(msg) {
  const el = $('modeTag');
  el.textContent = msg;
}

window.addEventListener('resize', () => stage.resize());
stage.resize();
if (!VIDEO) requestAnimationFrame(frame);

// small hook for automated checks and screenshots
window.__advanceTo = (t, draw = true) => {
  const step = 1 / 30;
  while (window.__vt < t - 1e-6) {
    window.__vt = Math.min(t, window.__vt + step);
    render(window.__vt, draw && window.__vt >= t - 1e-6);
  }
  if (draw) render(window.__vt, true);
};
window.__videoStart = async () => {
  document.querySelector('input[name=mode][value=crowd]').checked = true;
  await begin();
};
window.__rlr = { st, stage, begin, onEvent, get audio() { return audio; } };

if (params.get('auto') === '1') {
  document.querySelector('input[name=mode][value=crowd]').checked = true;
  setTimeout(() => $('begin').click(), 300);
}
