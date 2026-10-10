// Canvas renderer: the kolam, the tala ring and the red-light progress arc.
import { TEENTAAL } from './raga.js';

export const C = {
  ink: '#09090f',
  mint: '#9af0bc',
  paper: '#fff7fd',
  mist: '#a9a5b4',
  green: '#245d49',
  indigo: '#38316b',
  red: '#d9534f',
};

const N = 8; // cells per side
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Stage {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.ripples = [];
    this.pulses = new Array(16).fill(null);
    this.blooms = [];
    this.reveals = []; // {group, at}
    this.setRaga({ seed: 11 });
    this.resize();
  }

  setRaga(raga) {
    const r = rng(raga.seed * 977 + 13);
    // orientation for the top-left quadrant (4x4), mirrored to the rest
    this.quad = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => r() < 0.5));
    // groups of 4 mirrored cells, centre-out
    const list = [];
    for (let a = 0; a < 4; a++) {
      for (let b = 0; b < 4; b++) {
        const d = (3 - a) ** 2 + (3 - b) ** 2 + (r() * 0.4);
        list.push({ a, b, d });
      }
    }
    list.sort((x, y) => x.d - y.d);
    this.groups = list
      .filter((q) => !(q.a === 0 && q.b === 0)) // trim the four extreme corners for a rounder rangoli
      .map((q) => ({
        cells: [
          [q.a, q.b, false, false],
          [N - 1 - q.a, q.b, true, false],
          [q.a, N - 1 - q.b, false, true],
          [N - 1 - q.a, N - 1 - q.b, true, true],
        ],
        base: this.quad[q.a][q.b],
      }));
    this.reset();
  }

  get groupCount() {
    return this.groups.length;
  }

  reset() {
    this.reveals = [];
    this.ripples = [];
    this.blooms = [];
    this.pulses.fill(null);
    this.complete = false;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.cv.clientWidth;
    const h = this.cv.clientHeight;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.dpr = dpr;
    this.w = w;
    this.h = h;
    const top = w < 700 ? 96 : 84;
    const bottom = w < 700 ? 270 : 235;
    const availH = h - top - bottom;
    const S = Math.max(160, Math.min((availH - 52) / 1.4, (w - 84) / 1.4));
    this.S = S;
    this.cell = S / N;
    this.cx = w / 2;
    this.cy = top + availH / 2;
    this.x0 = this.cx - S / 2;
    this.y0 = this.cy - S / 2;
    this.R = S * 0.7;
  }

  reveal(groupIndex, now) {
    if (groupIndex >= this.groups.length) return null;
    this.reveals.push({ group: groupIndex, at: now });
    const c = this.groups[groupIndex].cells[0];
    return { x: this.x0 + (c[0] + 0.5) * this.cell, y: this.y0 + (c[1] + 0.5) * this.cell };
  }

  ripple(x, y, color, now, maxR = this.cell * 2.2) {
    this.ripples.push({ x, y, at: now, color, maxR });
  }

  scatter(now) {
    const a = Math.random() * Math.PI * 2;
    const r = this.R * (0.9 + Math.random() * 0.2);
    this.ripple(this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r, C.mist, now, this.cell * 1.4);
  }

  pulse(beat, good, now) {
    this.pulses[beat] = { at: now, good };
  }

  bloom(now, color = C.mint) {
    this.blooms.push({ at: now, color });
  }

  // arcs of one cell, p = 0..1 drawing progress
  _cell(i, j, mirrorH, mirrorV, base, p, alpha) {
    const g = this.g;
    const c = this.cell;
    const x = this.x0 + i * c;
    const y = this.y0 + j * c;
    let o = base;
    if (mirrorH) o = !o;
    if (mirrorV) o = !o;
    const r = c / 2;
    const sweep = (Math.PI / 2) * p;
    g.beginPath();
    if (o) {
      g.arc(x, y, r, 0, sweep);
      g.moveTo(x + c + r * Math.cos(Math.PI), y + c + r * Math.sin(Math.PI));
      g.arc(x + c, y + c, r, Math.PI, Math.PI + sweep);
    } else {
      g.arc(x + c, y, r, Math.PI / 2, Math.PI / 2 + sweep);
      g.moveTo(x + r * Math.cos(Math.PI * 1.5), y + c + r * Math.sin(Math.PI * 1.5));
      g.arc(x, y + c, r, Math.PI * 1.5, Math.PI * 1.5 + sweep);
    }
    g.globalAlpha = alpha;
    g.stroke();
  }

  // s: { now, t, total, beatPos, sync, ghost, done }
  draw(s) {
    const g = this.g;
    const { dpr } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    const { cx, cy, S, cell } = this;
    const now = s.now;

    // glow behind the kolam grows with sync
    const glow = 0.1 + 0.55 * s.sync + (s.done ? 0.2 : 0);
    const rg = g.createRadialGradient(cx, cy, S * 0.05, cx, cy, S * 0.95);
    rg.addColorStop(0, `rgba(36, 93, 73, ${glow})`);
    rg.addColorStop(0.55, `rgba(56, 49, 107, ${glow * 0.35})`);
    rg.addColorStop(1, 'rgba(9, 9, 15, 0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, this.w, this.h);

    // lattice dots
    const touched = new Set();
    for (const rv of this.reveals) {
      for (const c of this.groups[rv.group].cells) {
        touched.add(`${c[0]},${c[1]}`);
        touched.add(`${c[0] + 1},${c[1]}`);
        touched.add(`${c[0]},${c[1] + 1}`);
        touched.add(`${c[0] + 1},${c[1] + 1}`);
      }
    }
    const R2 = (N / 2) * 1.02;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const dx = i - N / 2;
        const dy = j - N / 2;
        if (Math.hypot(dx, dy) > 5.1) continue;
        const on = touched.has(`${i},${j}`);
        g.globalAlpha = on ? 0.95 : 0.3;
        g.fillStyle = on ? C.paper : C.mist;
        g.beginPath();
        g.arc(this.x0 + i * cell, this.y0 + j * cell, on ? 2.4 : 1.8, 0, Math.PI * 2);
        g.fill();
      }
    }
    void R2;

    // kolam strokes
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(2, cell * 0.11);
    g.strokeStyle = C.mint;
    g.shadowColor = C.mint;
    if (s.ghost) {
      g.shadowBlur = 0;
      this.groups.forEach((gr) => {
        gr.cells.forEach(([i, j, mh, mv]) => this._cell(i, j, mh, mv, gr.base, 1, 0.09));
      });
    }
    g.shadowBlur = 6 + 14 * s.sync;
    for (const rv of this.reveals) {
      const p = ease((now - rv.at) / 0.8);
      const gr = this.groups[rv.group];
      const a = 0.55 + 0.45 * Math.min(1, s.sync + 0.25);
      gr.cells.forEach(([i, j, mh, mv]) => this._cell(i, j, mh, mv, gr.base, p, a));
    }
    g.shadowBlur = 0;
    g.globalAlpha = 1;

    // blooms (empty beat held, or the light turning green)
    this.blooms = this.blooms.filter((b) => now - b.at < 2.2);
    for (const b of this.blooms) {
      const age = (now - b.at) / 2.2;
      g.strokeStyle = b.color;
      g.lineWidth = 2;
      g.globalAlpha = (1 - age) * 0.7;
      g.beginPath();
      g.arc(cx, cy, S * 0.12 + ease(age) * S * 0.75, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;

    // ripples from claps
    this.ripples = this.ripples.filter((r) => now - r.at < 1.3);
    for (const r of this.ripples) {
      const age = (now - r.at) / 1.3;
      g.strokeStyle = r.color;
      g.lineWidth = 1.5;
      g.globalAlpha = (1 - age) * 0.8;
      g.beginPath();
      g.arc(r.x, r.y, 4 + ease(age) * r.maxR, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;

    this._ring(s);
  }

  _ring(s) {
    const g = this.g;
    const { cx, cy, R } = this;
    const cur = Math.floor(((s.beatPos % 16) + 16) % 16);
    const now = s.now;

    // signal progress arc, outside the tala ring
    const rr = R + 20;
    g.lineWidth = 2;
    g.strokeStyle = C.mist;
    g.globalAlpha = 0.18;
    g.beginPath();
    g.arc(cx, cy, rr, 0, Math.PI * 2);
    g.stroke();
    const prog = Math.min(1, Math.max(0, s.t / s.total));
    g.strokeStyle = s.done ? C.mint : C.red;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    g.stroke();
    // cycle tick marks on that arc
    g.strokeStyle = C.paper;
    g.globalAlpha = 0.35;
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (rr - 4), cy + Math.sin(a) * (rr - 4));
      g.lineTo(cx + Math.cos(a) * (rr + 4), cy + Math.sin(a) * (rr + 4));
      g.stroke();
    }
    g.globalAlpha = 1;

    // 16 beats
    const small = this.w < 700;
    for (let b = 0; b < 16; b++) {
      const a = -Math.PI / 2 + (b / 16) * Math.PI * 2;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      const isSam = b === 0;
      const isClap = b === 4 || b === 12;
      const isKhali = b === TEENTAAL.khali;
      const active = !s.ghost && b === cur && !s.done;
      const pu = this.pulses[b];
      const pAge = pu ? (now - pu.at) / 0.9 : 1;
      const rad = (isSam ? 6.5 : isClap ? 5.2 : isKhali ? 5.2 : 3.4) * (small ? 0.9 : 1);

      if (pu && pAge < 1) {
        g.strokeStyle = pu.good ? C.mint : C.mist;
        g.lineWidth = 1.5;
        g.globalAlpha = 1 - pAge;
        g.beginPath();
        g.arc(x, y, rad + 3 + pAge * 14, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
      if (active) {
        g.shadowColor = C.mint;
        g.shadowBlur = 16;
      }
      if (isKhali) {
        g.lineWidth = 1.6;
        g.strokeStyle = active ? C.mint : C.paper;
        g.globalAlpha = active ? 1 : 0.85;
        g.beginPath();
        g.arc(x, y, rad, 0, Math.PI * 2);
        g.stroke();
      } else {
        g.fillStyle = active ? C.mint : isSam || isClap ? C.paper : C.mist;
        g.globalAlpha = active ? 1 : isSam || isClap ? 0.95 : 0.55;
        g.beginPath();
        g.arc(x, y, active ? rad + 1.5 : rad, 0, Math.PI * 2);
        g.fill();
      }
      g.shadowBlur = 0;
      g.globalAlpha = 1;
    }

    // vibhag markers X 2 0 3
    g.font = `600 ${small ? 10 : 11}px 'Hanken Grotesk Variable', sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = C.mist;
    for (const [b, label] of Object.entries(TEENTAAL.markers)) {
      const a = -Math.PI / 2 + (b / 16) * Math.PI * 2;
      const off = (small ? 16 : 18) + (b === '0' ? 4 : 0);
      g.globalAlpha = 0.9;
      g.fillText(label, cx + Math.cos(a) * (R - off), cy + Math.sin(a) * (R - off));
    }
    g.globalAlpha = 1;
  }
}
