// Swara tables, tuning and phrase walking.
// Ratios are just-intonation values; Sa is a fixed reference so every device sounds the same.

export const SA = 146.83; // D3

export const RAGAS = {
  yaman: {
    key: 'yaman',
    name: 'Yaman',
    script: 'यमन',
    when: 'Evening',
    hours: '6–9 pm',
    note: 'tivra Ma',
    swaras: ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'],
    ratios: [1, 9 / 8, 5 / 4, 45 / 32, 3 / 2, 5 / 3, 15 / 8],
    // phrases as scale degrees (0 = Sa, 7 = upper Sa, -1 = lower Ni)
    phrases: [
      [-1, 1, 2, 1, 0],
      [2, 3, 4, 3, 2, 1, 0],
      [2, 3, 4, 5, 6, 7],
      [7, 6, 5, 4, 3, 2, 1, 0],
    ],
    seed: 11,
  },
  bhairavi: {
    key: 'bhairavi',
    name: 'Bhairavi',
    script: 'भैरवी',
    when: 'Morning',
    hours: 'early hours',
    note: 'komal Re Ga Dha Ni',
    swaras: ['Sa', 're', 'ga', 'Ma', 'Pa', 'dha', 'ni'],
    ratios: [1, 16 / 15, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 9 / 5],
    phrases: [
      [0, 1, 2, 3, 2, 1, 0],
      [3, 4, 5, 4, 3, 2],
      [-1, 0, 1, 2, 1, 0],
      [7, 6, 5, 4, 3, 2, 1, 0],
    ],
    seed: 5,
  },
};

export function ragaForNow(date = new Date()) {
  const h = date.getHours();
  return h >= 4 && h < 12 ? RAGAS.bhairavi : RAGAS.yaman;
}

export function degreeFreq(raga, degree) {
  const oct = Math.floor(degree / 7);
  const idx = ((degree % 7) + 7) % 7;
  return SA * raga.ratios[idx] * Math.pow(2, oct);
}

export function degreeName(raga, degree) {
  const idx = ((degree % 7) + 7) % 7;
  return raga.swaras[idx];
}

// Snap any frequency (a hum) to the nearest swara of the raga, folded into 130–520 Hz.
export function quantize(raga, freq) {
  let f = freq;
  while (f < SA * 0.9) f *= 2;
  while (f >= SA * 2.1) f /= 2;
  let best = { degree: 0, dist: Infinity };
  for (let d = 0; d <= 7; d++) {
    const df = degreeFreq(raga, d);
    const dist = Math.abs(Math.log2(f / df));
    if (dist < best.dist) best = { degree: d, dist };
  }
  return { degree: best.degree, freq: degreeFreq(raga, best.degree), name: degreeName(raga, best.degree) };
}

// Walks pakad-style phrases so a plain clap still lands on a musical note.
export class PhraseWalker {
  constructor(raga) {
    this.raga = raga;
    this.p = 0;
    this.i = 0;
  }
  next() {
    const ph = this.raga.phrases[this.p];
    const degree = ph[this.i];
    this.i++;
    if (this.i >= ph.length) {
      this.i = 0;
      this.p = (this.p + 1) % this.raga.phrases.length;
    }
    return { degree, freq: degreeFreq(this.raga, degree), name: degreeName(this.raga, degree) };
  }
}

// Teentaal: 16 beats, 4 vibhag. Khali (the empty beat) is beat 9.
export const TEENTAAL = {
  beats: 16,
  cycleSeconds: 11.25, // 8 cycles = the 90 second red light
  markers: { 0: 'X', 4: '2', 8: '0', 12: '3' },
  theka: [
    'Dha', 'Dhin', 'Dhin', 'Dha',
    'Dha', 'Dhin', 'Dhin', 'Dha',
    'Na', 'Tin', 'Tin', 'Na',
    'Ta', 'Dhin', 'Dhin', 'Dha',
  ],
  khali: 8,
};
export const BEAT = TEENTAAL.cycleSeconds / TEENTAAL.beats;
export const BPM = 60 / BEAT;
