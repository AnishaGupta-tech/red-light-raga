import './video.css';
import { Stage } from '../src/stage.js';
import { BEAT } from '../src/raga.js';

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const win = (T, a, b) => clamp((T - a) / (b - a));
const eo = (x) => 1 - Math.pow(1 - clamp(x), 3);
const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const lerp = (a, b, t) => a + (b - a) * t;
// visibility: fade in over [a,b], hold, fade out over [c,d]
const vis = (T, a, b, c, d) => Math.min(win(T, a, b), 1 - win(T, c, d));

export const TOTAL = 80;
export const SEGS = [
  { T0: 19.0, T1: 31.5, d0: 0 },
  { T0: 32.1, T1: 44.1, d0: 36 },
  { T0: 44.7, T1: 58.2, d0: 78 },
];

// ---------- helpers ----------
function words(el, text) {
  el.innerHTML = '';
  return text.split(' ').map((w) => {
    const s = document.createElement('span');
    s.textContent = w;
    el.appendChild(s);
    el.appendChild(document.createTextNode(' '));
    return s;
  });
}
function reveal(spans, T, t0, step = 0.11, dur = 0.55, out) {
  spans.forEach((s, i) => {
    const a = t0 + i * step;
    let p = eo(win(T, a, a + dur));
    if (out) p = Math.min(p, 1 - eio(win(T, out[0], out[1])));
    s.style.opacity = p;
    s.style.transform = `translateY(${(1 - p) * 34}px)`;
    s.style.filter = `blur(${(1 - p) * 10}px)`;
  });
}
function show(el, o, y = 0, s = 1, blur = 0) {
  el.style.opacity = o;
  el.style.transform = `translateY(${y}px) scale(${s})`;
  el.style.filter = blur ? `blur(${blur}px)` : '';
}
function sceneVis(el, T, a, b, c, d) { el.style.opacity = vis(T, a, b, c, d); }

// ---------- scene text ----------
const h1 = words($('h1'), 'Every red light in India');
const h2 = words($('h2'), 'is 90 seconds of standing together.');
const h3 = words($('h3'), 'What if it sang?');
const flip1 = words($('flip1'), 'Don’t punish the wait.');
const flip2 = words($('flip2'), 'Let the wait play.');
const w1 = words($('w1'), 'Nobody is punished.');
const w2 = words($('w2'), 'Everybody is in the music.');

// ---------- title kolam ----------
const titleStage = new Stage($('titleCanvas'));
titleStage.setRaga({ seed: 11 });
let titleRevealed = 0;
let lastTitleBeat = -1;

// ---------- demo callouts ----------
const iframe = $('demo');
let dw = null;
let geo = null;
const calloutDefs = [
  { a: 19.8, b: 23.5, side: 'L', n: '01', t: 'The red light', body: 'The 90-second signal is one cycle of tala. The arc fills as the light runs out.', target: () => [geo.cx, geo.cy - geo.R - 20] },
  { a: 23.7, b: 27.4, side: 'R', n: '02', t: 'The pulse', body: 'Sixteen beats around the ring, one dot per beat. Beats 1, 5 and 13 are the claps.', target: () => beatXY(4), rings: [0, 4, 12] },
  { a: 27.6, b: 31.3, side: 'L', n: '03', t: 'Join in', body: 'Clap, tap or hum on the beat. Each hit becomes a swara and one more stroke of the kolam.', target: () => [geo.cx - 40, geo.cy] },
  { a: 32.4, b: 36.5, side: 'L', n: '04', t: 'Khali', body: 'Beat 9 is the empty beat. If everyone stays quiet together, something happens.', target: () => beatXY(8), rings: [8] },
  { a: 36.8, b: 40.8, side: 'L', y: 500, n: '05', t: 'The music grows', body: 'Silence held, the shared meter rises and a layer joins: tabla, then sitar, then the full ensemble.', target: () => rectPt('#layers', 0.04, 0.2) },
  { a: 41.0, b: 43.9, side: 'R', y: 500, n: '06', t: 'Held together', body: 'The app counts every empty beat the crowd kept.', target: () => rectPt('#mKhali', 0.7, 0.3) },
  { a: 45.0, b: 49.6, side: 'L', y: 500, n: '07', t: 'In time, together', body: 'The shared meter shows how much of the crowd landed on the beat.', target: () => rectPt('#mSync', 0.4, 0.2) },
  { a: 49.8, b: 54.8, side: 'L', n: '08', t: 'The kolam blooms', body: 'It fills from the centre outward, always symmetric. Whatever the group draws is what stays.', target: () => [geo.cx - 120, geo.cy - 60] },
  { a: 55.0, b: 58.0, side: 'R', y: 250, n: '09', t: 'Green', body: 'The light turns green. A resolving chord, “Chalo”, and the kolam stays.', target: () => rectPt('#signal', 0.1, 0.5) },
];
const cardsEl = $('cards');
const linesEl = $('lines');
const NS = 'http://www.w3.org/2000/svg';
calloutDefs.forEach((c, i) => {
  const d = document.createElement('div');
  d.className = 'card';
  d.innerHTML = `<div class="n">${c.n}</div><div class="t">${c.t}</div><p>${c.body}</p>`;
  d.style.left = (c.side === 'L' ? 96 : 1374) + 'px';
  c.y = c.y || 250;
  d.style.top = c.y + 'px';
  cardsEl.appendChild(d);
  c.card = d;
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#9af0bc'); path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round'); path.setAttribute('pathLength', '1'); path.style.opacity = 0;
  const dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('r', '9'); dot.setAttribute('fill', '#9af0bc'); dot.style.opacity = 0;
  const halo = document.createElementNS(NS, 'circle');
  halo.setAttribute('fill', 'none'); halo.setAttribute('stroke', '#9af0bc'); halo.setAttribute('stroke-width', '2'); halo.style.opacity = 0;
  linesEl.append(path, dot, halo);
  c.path = path; c.dot = dot; c.halo = halo;
  c.ringEls = (c.rings || []).map(() => {
    const r = document.createElementNS(NS, 'circle');
    r.setAttribute('fill', 'none'); r.setAttribute('stroke', '#9af0bc'); r.setAttribute('stroke-width', '3'); r.style.opacity = 0;
    linesEl.appendChild(r);
    return r;
  });
});

function beatXY(b) {
  const a = -Math.PI / 2 + (b / 16) * Math.PI * 2;
  return [geo.cx + Math.cos(a) * geo.R, geo.cy + Math.sin(a) * geo.R];
}
function rectPt(sel, fx, fy) {
  const el = dw.document.querySelector(sel);
  const r = el.getBoundingClientRect();
  return [r.left + r.width * fx, r.top + r.height * fy];
}

function updateCallouts(T) {
  for (const c of calloutDefs) {
    const o = vis(T, c.a, c.a + 0.45, c.b - 0.4, c.b);
    const active = o > 0.001;
    c.card.style.opacity = o;
    c.card.style.transform = `translateY(${(1 - eo(win(T, c.a, c.a + 0.5))) * 26}px)`;
    if (!active || !geo) { c.path.style.opacity = 0; c.dot.style.opacity = 0; c.halo.style.opacity = 0; c.ringEls.forEach((r) => (r.style.opacity = 0)); continue; }
    const [tx, ty] = c.target();
    const sx = c.side === 'L' ? 96 + 450 : 1374;
    const sy = c.y + 70;
    const mx = (sx + tx) / 2, my = (sy + ty) / 2 + (ty > sy ? 30 : -40);
    c.path.setAttribute('d', `M${sx} ${sy} Q${mx} ${my} ${tx} ${ty}`);
    const p = eo(win(T, c.a + 0.2, c.a + 0.95));
    c.path.style.strokeDasharray = '1 1';
    c.path.style.strokeDashoffset = 1 - p;
    c.path.style.opacity = o * 0.95;
    c.dot.setAttribute('cx', tx); c.dot.setAttribute('cy', ty);
    c.dot.style.opacity = o * p;
    const pulse = ((T - c.a) * 1.2) % 1;
    c.halo.setAttribute('cx', tx); c.halo.setAttribute('cy', ty); c.halo.setAttribute('r', 12 + pulse * 30);
    c.halo.style.opacity = o * p * (1 - pulse);
    (c.rings || []).forEach((b, i) => {
      const [rx, ry] = beatXY(b);
      const el = c.ringEls[i];
      const k = eo(win(T, c.a + 0.5 + i * 0.35, c.a + 1.1 + i * 0.35));
      el.setAttribute('cx', rx); el.setAttribute('cy', ry); el.setAttribute('r', 26 + (1 - k) * 18);
      el.style.opacity = o * k * 0.9;
    });
  }
}

// ---------- clap widget ----------
const hitsEl = $('hits');
const hitPool = Array.from({ length: 8 }, () => {
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('fill', 'none'); c.setAttribute('stroke', '#9af0bc'); c.setAttribute('stroke-width', '3'); c.style.opacity = 0;
  hitsEl.appendChild(c); return c;
});
const core = document.createElementNS(NS, 'circle');
core.setAttribute('r', '16'); core.setAttribute('fill', '#9af0bc'); hitsEl.appendChild(core);
let hitCursor = 0;
function updateHits(dNow) {
  const log = dw.__vlog;
  const recent = [];
  for (let i = log.length - 1; i >= 0 && recent.length < 8; i--) {
    const e = log[i];
    if (e.k !== 'hit' && e.k !== 'off') continue;
    if (dNow - e.t > 0.7) break;
    if (e.t <= dNow) recent.push(e);
  }
  hitPool.forEach((c, i) => {
    const e = recent[i];
    if (!e) { c.style.opacity = 0; return; }
    const age = (dNow - e.t) / 0.7;
    c.setAttribute('r', 20 + age * 82);
    c.style.stroke = e.k === 'hit' ? '#9af0bc' : '#a9a5b4';
    c.style.opacity = (1 - age) * 0.9;
  });
  const last = recent[0];
  core.setAttribute('r', 16 + (last ? (1 - clamp((dNow - last.t) / 0.25)) * 8 : 0));
  hitCursor = dNow;
}

// ---------- street scene ----------
const S = (id) => $(id);
const strokeEls = ['k0', 'k1', 'k2', 'k3', 'k4'].map(S);
strokeEls.forEach((e) => { e.style.strokeDasharray = '1 1'; e.style.strokeDashoffset = 1; });
S('shelter').style.strokeDasharray = '1 1';

// ---------- badge ----------
function badge(T) {
  const b = $('badge');
  const inDemo = T > 19.6 && T < 58.2;
  const inStreet = T > 66.9 && T < 74.0;
  b.classList.toggle('concept', inStreet);
  $('badgeText').textContent = inStreet ? 'Concept · not built or filmed' : 'Live prototype · crowd simulated';
  b.style.opacity = Math.max(
    vis(T, 19.6, 20.1, 57.8, 58.2),
    vis(T, 66.9, 67.4, 73.6, 74.0)
  ) * (inDemo || inStreet ? 1 : 0);
}

// ---------- main render ----------
let started = false;
const segStarted = [false, false, false];
function fmt(sec) { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

window.__setup = async () => {
  dw = iframe.contentWindow;
  await dw.document.fonts.ready;
  await dw.__videoStart();
  dw.__advanceTo(0, true);
  geo = dw.__rlr.stage;
  started = true;
  return { cx: geo.cx, cy: geo.cy, R: geo.R };
};

window.__render = (T) => {
  // backdrop dots drift slowly
  $('dots').style.transform = `translate(${-T * 6}px, ${T * 4}px)`;
  $('dots').style.opacity = 0.5 * (1 - win(T, 58.2, 59) * 0.4);

  // ---- S1 hook ----
  sceneVis($('s1'), T, 0, 0.5, 5.5, 6.1);
  reveal(h1, T, 0.5, 0.1, 0.55, [5.4, 6.0]);
  reveal(h2, T, 1.5, 0.1, 0.55, [5.4, 6.0]);
  reveal(h3, T, 3.7, 0.14, 0.7, [5.4, 6.0]);
  $('lamp1').style.opacity = eo(win(T, 0.3, 1.2));
  $('clock1').style.opacity = eo(win(T, 0.9, 1.6));
  $('lamp1').firstElementChild.style.transform = `scale(${1 + Math.sin(T * 3.1) * 0.035})`;
  $('clock1').textContent = fmt(90 - clamp((T - 1.0) / 4.5) * 88);

  // ---- S2 ----
  const s2 = $('s2');
  sceneVis(s2, T, 5.9, 6.5, 13.0, 13.4);
  const pa = $('pa');
  pa.style.opacity = vis(T, 6.0, 6.6, 10.0, 10.5);
  pa.style.transform = `translateY(${(1 - eo(win(T, 6.0, 6.7))) * 30}px)`;
  const db = Math.round(85 * eo(win(T, 6.5, 7.6)));
  $('db').textContent = db;
  $('db').style.color = db >= 85 ? '#d9534f' : '';
  const cb = $('clockbox');
  cb.style.opacity = vis(T, 6.3, 6.9, 10.0, 10.5);
  cb.style.transform = `translateY(${(1 - eo(win(T, 6.3, 7.0))) * 30}px)`;
  // clock counts down, then resets to 1:30 when it hears the honks
  const reset = T > 8.7;
  $('clk2').textContent = reset ? fmt(90 - clamp((T - 8.7) * 0.2) * 3) : fmt(41 - (T - 6.3) * 2.2);
  const flash = reset ? 1 - win(T, 8.7, 9.15) : 0;
  cb.style.borderColor = flash > 0 ? `rgba(217,83,79,${0.3 + flash * 0.7})` : '';
  const pb = $('pb');
  pb.style.opacity = vis(T, 10.4, 10.6, 13.0, 13.4);
  reveal(flip1, T, 10.5, 0.12, 0.55, [12.9, 13.3]);
  reveal(flip2, T, 11.5, 0.12, 0.55, [12.9, 13.3]);
  const l2 = $('lamp2');
  l2.classList.toggle('green', T > 11.4);

  // ---- S3 title ----
  const s3 = $('s3');
  const iris3 = eio(win(T, 12.9, 13.9));
  s3.style.opacity = T < 12.9 ? 0 : 1 - win(T, 19.0, 19.2);
  s3.style.clipPath = `circle(${iris3 * 1500}px at 1340px 500px)`;
  if (T > 12.9 && T < 19.3) {
    const t0 = 14.0;
    while (titleRevealed < titleStage.groupCount && T >= t0 + titleRevealed * 0.26) { titleStage.reveal(titleRevealed, T); titleRevealed++; }
    const beatPos = Math.max(0, (T - t0) / BEAT);
    const b = Math.floor(beatPos) % 16;
    if (b !== lastTitleBeat && T > t0) { lastTitleBeat = b; titleStage.pulse(b, true, T); }
    titleStage.draw({ now: T, t: (T - 12.9) * 8, total: 90, beatPos, sync: clamp((T - t0) / 5), ghost: T < t0, done: false });
    const tt = [ $('t0'), $('t1'), $('t2'), $('t3'), $('t4'), $('t5') ];
    tt.forEach((el, i) => { const a = 13.5 + i * 0.28; const p = eo(win(T, a, a + 0.7)); show(el, p * (1 - win(T, 18.9, 19.2)), (1 - p) * 30, 1, (1 - p) * 8); });
  } else if (T <= 12.9) {
    ['t0','t1','t2','t3','t4','t5'].forEach((id) => show($(id), 0));
  }

  // ---- S4 demo ----
  const wrap = $('demoWrap');
  let seg = SEGS.findIndex((s) => T >= s.T0 && T < s.T1);
  const inDemoWindow = T >= 19.0 && T < 59.0;
  if (inDemoWindow && started) {
    const gap = seg < 0;
    if (!gap) {
      const s = SEGS[seg];
      const d = s.d0 + (T - s.T0);
      if (!segStarted[seg]) { segStarted[seg] = true; if (s.d0 > 0) dw.__advanceTo(s.d0 - 1 / 30, false); }
      dw.__advanceTo(d, true);
      updateHits(d);
      geo = dw.__rlr.stage;
    }
    let o = 1; let clip = 2200;
    if (T < 19.9) { clip = eio(win(T, 19.0, 19.9)) * 1700; }
    if (T > 58.2) { clip = (1 - eio(win(T, 58.2, 59.0))) * 1700; o = 1; }
    wrap.style.opacity = o;
    wrap.style.clipPath = `circle(${clip}px at ${960}px ${465}px)`;
    // time-jump panel
    const j = $('jump');
    const g = [[31.5, 32.1, 1], [44.1, 44.7, 2]];
    let jo = 0; let which = 0;
    for (const [a, b, k] of g) { const p = vis(T, a - 0.05, a + 0.2, b - 0.2, b + 0.05); if (p > jo) { jo = p; which = k; } }
    j.style.opacity = jo;
    if (which) {
      const s = SEGS[which];
      $('jc1').textContent = `Cycle ${Math.floor(s.d0 / 11.25) + 1} of 8`;
      $('jc2').textContent = `${fmt(s.d0)} into the red light`;
    }
    updateCallouts(T);
    // clap widget visible while a demo segment is on screen
    const cw = $('clapw');
    cw.style.opacity = seg >= 0 ? vis(T, 19.9, 20.4, 57.4, 58.0) : 0;
    // hold-the-silence word on the khali beat of segment B (demo 39.2 → 39.8)
    const hw = $('holdword');
    if (seg === 1) {
      const d = SEGS[1].d0 + (T - SEGS[1].T0);
      const p = vis(d, 38.7, 39.0, 39.8, 40.1);
      hw.style.opacity = p * 0.95; hw.style.transform = `scale(${1 + (1 - p) * 0.05})`;
      hw.style.top = (geo.cy - geo.R * 0.72) + 'px';
    } else hw.style.opacity = 0;
  } else {
    wrap.style.opacity = 0;
    $('jump').style.opacity = 0; $('clapw').style.opacity = 0; $('holdword').style.opacity = 0;
    updateCallouts(-1);
  }

  // ---- S5 ----
  sceneVis($('s5'), T, 58.6, 59.1, 66.0, 66.6);
  show($('w0'), eo(win(T, 59.0, 59.6)), (1 - eo(win(T, 59.0, 59.6))) * 20);
  reveal(w1, T, 59.3, 0.12, 0.6, [65.8, 66.4]);
  reveal(w2, T, 60.3, 0.1, 0.6, [65.8, 66.4]);
  ['pc1', 'pc2', 'pc3'].forEach((id, i) => { const a = 61.7 + i * 0.6; const p = eo(win(T, a, a + 0.7)); show($(id), p * (1 - win(T, 65.9, 66.5)), (1 - p) * 40); });

  // ---- S6 ----
  sceneVis($('s6'), T, 66.4, 66.9, 73.7, 74.2);
  show($('x0'), eo(win(T, 66.7, 67.2)), 0);
  show($('x1'), eo(win(T, 66.9, 67.6)), (1 - eo(win(T, 66.9, 67.6))) * 24);
  const t6 = T - 66.9;
  const dash = (id, a, b) => { $(id).style.strokeDashoffset = 1 - eo(win(t6, a, b)); };
  const fadeSvg = (id, a, b) => { $(id).style.opacity = eo(win(t6, a, b)); };
  ['road', 'roadline', 'dash'].forEach((id) => fadeSvg(id, 0, 0.5));
  dash('shelter', 0.2, 1.1); fadeSvg('roof', 0.7, 1.3);
  fadeSvg('panel', 1.2, 1.8);
  fadeSvg('projector', 1.5, 2.0); fadeSvg('beam', 1.9, 2.5);
  ['k0', 'k1', 'k2', 'k3', 'k4'].forEach((id, i) => { const k = eo(win(t6, 2.2 + i * 0.28, 2.8 + i * 0.28)); $(id).style.strokeDashoffset = 1 - k; $(id).style.opacity = k > 0.02 ? 1 : 0; });
  fadeSvg('k5', 2.2, 2.6);
  fadeSvg('micpole', 1.6, 2.1); fadeSvg('mic', 1.8, 2.2);
  const micPulse = 0.5 + 0.5 * Math.sin(t6 * 6);
  $('mic1').style.opacity = eo(win(t6, 2.0, 2.4)) * (0.5 + micPulse * 0.5);
  $('mic2').style.opacity = eo(win(t6, 2.0, 2.4)) * (0.3 + (1 - micPulse) * 0.5);
  ['p1', 'p2', 'p3'].forEach((id, i) => { const a = 1.9 + i * 0.25; const p = eo(win(t6, a, a + 0.5)); $(id).style.opacity = p; $(id).style.transform = `translateY(${(1 - p) * 6}px)`; });
  const clapOn = t6 > 3.0 ? 0.5 + 0.5 * Math.sin(t6 * 9) : 0;
  $('claps').style.opacity = clapOn;
  ['pole', 'sig', 'lampR', 'lampG', 'timer'].forEach((id) => fadeSvg(id, 0.9, 1.5));
  const left = Math.max(0, 90 - clamp((t6 - 1.5) / 5.2) * 90);
  $('timer').textContent = fmt(left);
  const greenNow = t6 > 6.7;
  $('lampR').setAttribute('fill', greenNow ? '#2a2634' : '#d9534f');
  $('lampG').setAttribute('fill', greenNow ? '#9af0bc' : '#2a2634');
  ['lb1', 'lb2', 'lb3', 'lb4', 'lb5'].forEach((id, i) => fadeSvg(id, 2.4 + i * 0.2, 2.9 + i * 0.2));
  ['kr1', 'kr2', 'kr3'].forEach((id, i) => { const a = 2.0 + i * 1.2; const p = eo(win(t6, a, a + 0.6)); show($(id), p, (1 - p) * 24); });

  // ---- S7 ----
  sceneVis($('s7'), T, 73.9, 74.4, 79.3, 80);
  const e = ['e0', 'e1', 'e2', 'e3', 'e4'];
  e.forEach((id, i) => { const a = 74.3 + i * 0.25; const p = eo(win(T, a, a + 0.7)); show($(id), p, (1 - p) * 30, 1, (1 - p) * 8); });
  const p5 = eo(win(T, 74.9, 75.7)); show($('e5'), p5, (1 - p5) * 36);
  show($('e6'), eo(win(T, 76.2, 77.0)) * 0.9, 0);

  badge(T);
  // final fade to black
  $('fade').style.opacity = win(T, 79.4, 80.0);
};
