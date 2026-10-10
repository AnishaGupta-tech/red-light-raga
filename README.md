# Red Light Raga

A 90-second red light that sings. Clap, hum or tap with the tabla and a kolam draws itself. The raga only blooms when people are in time together.

Concept demo for **DJXHack: Everyday Magic**, by Anisha Gupta.

**Live demo:** https://anishagupta-tech.github.io/red-light-raga/

## How it works

- The red light is a Teentaal cycle: 16 beats, 11.25 s per cycle, 8 cycles = 90 s.
- Claps and taps are detected on the beat grid; hums are snapped to the nearest swara of Yaman (evening) or Bhairavi (morning, chosen by time of day).
- Each in-time hit draws part of a four-fold kolam. Beat 9 is *khali*, the empty beat: if the group stays quiet together, the music gains a layer.
- Tanpura, tabla, sitar line and pad are all synthesised in the browser with Tone.js. No audio samples.
- Microphone audio is analysed locally in the page and never sent anywhere.

## Modes

| Mode | Input |
|---|---|
| Microphone | claps (spectral-flux onsets) and hums (autocorrelation pitch) |
| Tap | click, touch or Space; horizontal position sets the swara |
| Watch | a simulated crowd, to see the full arc without a mic |

Use headphones for the best microphone result. Without them the browser's echo cancellation is left on so the speakers are not heard as claps.

## Run locally

```bash
npm install
npm run dev
```

## Stack

Vite, vanilla JS, Tone.js, pitchy, Canvas 2D. Fonts: Instrument Serif, Hanken Grotesk, Noto Serif Devanagari (all OFL).

## Status

Working prototype of the interaction. The street installation (projector, directional mic, edge box) is a concept and is not built.
