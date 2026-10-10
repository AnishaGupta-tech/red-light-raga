# Red Light Raga

**The 90-second wait that sings.**

A concept prototype for the **DJXHack Online Challenge: Everyday Magic**, by Anisha Gupta.

Standing at a red light is one of the most shared moments of an Indian commute. Red Light Raga turns those 90 seconds into one cycle of tala. People clap, tap or hum on the beat, and every in-time hit becomes a swara of the raga and one more stroke of a kolam. Beat 9 is *khali*, the empty beat: if the crowd stays quiet together, the music gains a layer. When the light turns green, the kolam keeps whatever the group made. Nothing is ever punished.

**Live demo:** https://anishagupta-tech.github.io/red-light-raga/

---

## How to run the demo

### Option 1: open the live link (recommended)

1. Open https://anishagupta-tech.github.io/red-light-raga/ in **Chrome, Edge or Safari**, on a laptop or a phone. Nothing needs to be installed.
2. Choose how you want to join in:

   | Mode | What you do | Best for |
   |---|---|---|
   | **Watch** | Nothing. A simulated crowd plays the whole 90 seconds. | Seeing every feature quickly, with no microphone. |
   | **Tap** | Click, touch or press **Space** on the beat. Where you tap left to right sets the swara. | Quiet rooms, phones, and laptops without a mic. |
   | **Microphone** | Clap or hum. | The closest experience to the street installation. |

3. Optional: pick the raga (**Auto, by time of day**, Yaman or Bhairavi) and tick **I am wearing headphones** if you are.
4. Press **Begin the wait** and make sure your sound is on. The browser may ask for microphone permission in Microphone mode. Choose Allow.

### What to do during the 90 seconds

| Moment | What you see and hear | What to do |
|---|---|---|
| **Red light starts** | A tanpura drone, an empty dot grid, and a ring of 16 beats. One dot lights per beat. | Listen for the pulse. |
| **Beats 1, 5 and 13** | The filled dots on the ring (marked X, 2, 3). These are the claps of Teentaal. | Clap or tap here. Any beat works, these are the strongest. |
| **Each in-time hit** | A swara plays, a kolam stroke is drawn, the beat dot pulses mint. | Keep going with the tabla. |
| **Hit off the beat** | A faint grey ripple. Nothing is punished. | Just find the pulse again. |
| **Beat 9 (khali)** | The hollow dot. The caption says "Khali. The empty beat." | Stay quiet together. If the crowd holds it, a ring blooms and the music grows. |
| **As the group falls in time** | Layers join: tanpura, then tabla, then sitar, then the full ensemble. | Keep the pulse. |
| **Light turns green (90 s)** | A resolving chord and the word "Chalo". The kolam stays as the group left it. | Press **Wait again** or **See the kolam**. |

The bottom bar shows the **In time** meter, how much of the **Kolam** is drawn, and how many **empty beats** the crowd held.

### Tips for Microphone mode

- Use **headphones** if you can. Without them the tabla can leak into the mic and be heard as claps. The page keeps the browser's echo cancellation on when the headphones box is unticked.
- Keep the volume moderate and clap clearly. Quiet taps on a desk may not register.
- You can hum any note. It is snapped to the nearest swara of the raga.
- If the mic is blocked or missing, the demo switches to Tap mode automatically.

### Requirements

- A current version of Chrome, Edge or Safari with Web Audio support.
- Sound output. Headphones recommended.
- For Microphone mode: a microphone and permission to use it. The page needs HTTPS, which the live link has.

### Troubleshooting

| Problem | Fix |
|---|---|
| No sound | Turn the volume up and check the "Sound on" button at the bottom. Some browsers need a click before audio starts. Press Begin again. |
| Mic mode does nothing | Check the browser's site permissions for the microphone, then reload. Or use Tap or Watch mode. |
| Claps are not detected | Clap closer to the mic, use headphones, and reduce background noise. |
| Too many hits are detected | Lower the speaker volume or switch on headphones mode. |
| Layout looks cramped | Use a window at least 360 px wide. Landscape on a phone also works. |

---

## Run it locally

```bash
git clone https://github.com/AnishaGupta-tech/red-light-raga.git
cd red-light-raga
npm install
npm run dev
```

Then open the address Vite prints, usually http://localhost:5173/. Microphone access works on `localhost`.

Other commands:

```bash
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

Node 20 or newer is recommended. The site deploys automatically to GitHub Pages from `main` through `.github/workflows/deploy.yml`.

### URL options

| URL | Effect |
|---|---|
| `?mode=mic`, `?mode=tap`, `?mode=crowd` | Preselects the input mode. |
| `?raga=yaman` or `?raga=bhairavi` | Preselects the raga. |
| `?auto=1` | Starts the simulated-crowd mode automatically. |

---

## How it works

- **The red light is a tala.** 90 s = 8 cycles of Teentaal. Each cycle is 16 beats at 11.25 s, about 85 bpm. Beat 9 is *khali*, the empty beat.
- **Analysis runs in the browser.** Claps are found with spectral-flux onset detection. Hums are found with autocorrelation pitch detection (pitchy) and snapped to the nearest swara.
- **Sync score.** Every hit is compared with the beat grid. Within about 75 ms is full credit, up to about 150 ms is partial, and half-beats count for less.
- **Raga engine.** Swaras use just-intonation ratios. Yaman (evening, tivra Ma) and Bhairavi (morning, komal Re Ga Dha Ni) are included. Claps walk through pakad-style phrases so they always land on a musical note.
- **Layers.** The tabla starts to join near 12% in time, the sitar near 42%, and the ensemble near 70%. Held empty beats add to the shared meter.
- **Kolam.** A symmetric dot-and-arc kolam fills from the centre outward as in-time hits accumulate. It is drawn live on a canvas.
- **Sound.** Everything is synthesised with Tone.js (plucked-string tanpura and sitar, membrane-synth tabla, a soft pad). There are no audio samples.
- **Privacy.** Microphone audio is analysed locally and never sent anywhere. The demo has no backend.

## What is real, simulated and untested

| | |
|---|---|
| **Works now** | Beat clock and tabla, microphone clap and hum detection, tap input, swara snapping, layers, the kolam, desktop and phone layouts. |
| **Simulated** | The crowd in Watch mode. The street installation (shelter, projector, mic hardware) is a concept and is not built. |
| **Untested** | The microphone path was checked only with a synthetic clap track in Chrome (7 claps and 1 hum produced 9 events). It has not been tried with a real crowd, street noise or loud speaker bleed. |

---

## Project structure

```
index.html            page shell and overlays
src/main.js           session logic: sync scoring, khali, layers, input wiring
src/raga.js           swara tables, tuning, phrases, Teentaal
src/audio.js          Tone.js synthesis: tanpura, tabla, sitar, pad
src/input.js          microphone onset and pitch detection
src/stage.js          canvas renderer: kolam, tala ring, signal arc
src/style.css         interface styling
video/                scripts used to render the concept video (see below)
.github/workflows/    GitHub Pages deployment
```

### Concept video pipeline

The `video/` folder holds the tools used to produce the concept video. The demo has a virtual-clock mode (`?video=1`) with no audio device, so frames and soundtrack can be rendered deterministically from the same code. Rendering needs Chrome, ffmpeg and the dev server running, and is not needed to use the demo.

## Stack

Vite, vanilla JavaScript, Tone.js, pitchy, Canvas 2D. Fonts: Instrument Serif, Hanken Grotesk, Noto Serif Devanagari (all open licence).

## Credits

Concept and design decisions: Anisha Gupta. AI assistance: Claude (Anthropic) was used for research, code drafting and layout, under the author's direction. Open-source libraries: Tone.js, pitchy, Vite. No sampled audio is used.
