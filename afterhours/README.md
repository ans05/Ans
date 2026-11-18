# AFTERHOURS

An interactive design playground for animated album artwork and music visuals.
Open it and you are in a working studio: a large square artwork that never
stops moving, three editable visual presets, real audio analysis driving the
motion, and one-click PNG export. Everything is procedural, nothing is
uploaded, and there are no paid services or API keys.

## Run it

Requires Node 20 or newer (built and tested on Node 22).

```bash
cd afterhours
npm install
npm run dev
```

Open the printed URL (normally http://localhost:5173). For a production
build and a local preview of it:

```bash
npm run build      # typecheck + bundle into dist/
npm run preview    # serve dist/ on http://localhost:4173
```

Other scripts:

```bash
npm run check      # typecheck + lint + unit tests
npm test           # vitest unit tests only
npm run lint       # eslint
```

## What you can do

- Edit the artist name and album title.
- Switch between **CHROME**, **CURRENT** and **SIGNAL**. Your words are kept;
  the look changes.
- **Randomize** inside the current preset's style. Each result is reproducible
  from the `seed` stored in the design.
- Change the background and accent colours (picker or hex).
- Adjust **speed**, **intensity** and **texture**.
- Drag the title anywhere on the artwork. With the artwork focused, the arrow
  keys nudge it (Shift for bigger steps) and Space plays or pauses.
- Load a local audio file, then play or pause it with explicit controls. The
  stage badge says **AUDIO REACTIVE** while the file is driving the visuals and
  **AMBIENT MODE** when nothing is loaded.
- **Export PNG** renders a clean 2048 × 2048 frame with no editor controls.
- **Save design** downloads a JSON file; **Load design** validates and restores
  one. The latest design is also restored automatically after a refresh.
- **Reduce motion** follows your OS setting by default and can be overridden.

## How it is built

```
src/
  design/     the document: types, presets, reducer, validation, persistence
  render/     pure canvas rendering: scenes, typography, grain, PNG export
  audio/      Web Audio engine, feature extraction, ambient fallback
  canvas/     the live <canvas> component (animation loop, dragging, keys)
  editor/     the control panel
  hooks/      small React hooks (design state, reduced-motion query)
  lib/        math, seeded random numbers, simplex noise, colour utilities
```

The four concerns stay separate on purpose: the **editor** only dispatches
actions; the **renderer** is a pure function of (design, frame); the **audio
engine** owns every Web Audio resource and hands out numbers; the **design
store** is the only thing that talks to storage. The canvas component is the
glue: it runs the loop, asks the engine for features, and calls the renderer.

### Rendering: geometry

The artwork is drawn with the Canvas 2D API into a square whose edge is
`size` pixels. Every coordinate in the design is **normalised** (0 to 1), so
the same design renders identically on a 400 px phone canvas and a 2048 px
export — the renderer just multiplies by `size`.

Each preset builds a *scene* from the design's integer `seed` using a seeded
pseudo-random generator (`lib/random.ts`, mulberry32). The same seed always
gives the same shapes, which is what makes a saved design reproducible.

- **CHROME** draws ribbons (Catmull-Rom splines through seeded points), blobs
  (a circle whose radius is modulated by noise around the circumference) and a
  torus ring (a thick-stroked ellipse). The metallic look is a gradient trick:
  a cyclic palette of dark → bright → mid → white → dark bands sampled along
  the shape. Rotating the palette's phase every frame makes the "reflection"
  sweep across the surface.
- **CURRENT** paints soft blobs and streamlines that follow a noise field onto
  an offscreen layer with screen blending, then copies that layer to the
  canvas one thin row at a time, shifting each row sideways by a sine + noise
  term. That row displacement is the watery refraction.
- **SIGNAL** stacks oscilloscope traces. Each row is a bell-shaped envelope
  (a Gaussian in x) multiplied by a signal, painted back to front with an
  opaque fill beneath each line so nearer traces occlude the ones behind.

Smoothness comes from **3D simplex noise** (`lib/noise.ts`): x and y pick the
point on the shape and z is time, so every outline evolves continuously
instead of being re-rolled per frame. Grain is a repeating noise tile drawn
with soft-light blending; it drifts slowly and freezes under reduced motion.

Typography is laid out by the renderer too, so it ends up in the PNG. The
title block reports its bounds in normalised space; the canvas component uses
those for drag hit-testing and to keep the block inside the artwork.

### Audio analysis: signal processing

```
<audio> element → MediaElementSource → AnalyserNode → speakers
```

The `AnalyserNode` runs a 2048-point FFT on whatever is playing. Every frame,
`audio/features.ts` turns its two buffers into a handful of stable numbers:

- **Band levels.** FFT bins are linearly spaced from 0 Hz to half the sample
  rate, so `bin = hz / (sampleRate / 2) * (fftSize / 2)`. Bass (30–160 Hz),
  mid (160–2 kHz) and treble (2–10 kHz) are the mean magnitudes over those
  bin ranges.
- **Energy** is the RMS of the time-domain waveform.
- **Envelope followers** smooth each value with a fast attack and slow
  release, frame-rate independent (`1 - exp(-rate * dt)`), so visuals react
  to transients without jittering.
- **Beat detection** compares the instantaneous bass energy with the mean and
  variance of the last ~1 second. A value that stands out beyond what the
  variance predicts, after a short refractory period, is an onset; the beat
  envelope then decays exponentially.
- **Log-spaced spectrum.** 48 bands from 40 Hz to 12 kHz, geometrically
  spaced to match how we hear pitch, used for the SIGNAL spectrum strip.
- **Waveform.** The time-domain buffer resampled to 256 points for the
  SIGNAL traces.

The renderer maps these onto motion: bass swells shapes, mids drive the water
displacement, treble brightens rims and caustics, energy speeds up the scene
clock, the beat thickens lines and rims. With nothing loaded, `audio/ambient.ts`
synthesises the same feature set from slow sine LFOs and noise, so the
artwork still breathes; the stage labels this clearly. Switching between the
two is cross-faded so nothing jumps, and there are no full-frame flashes.

The AudioContext is created only inside the Play button's click (browsers
require a user gesture) and is closed, with the object URL revoked and
listeners removed, when the component unmounts.

### Persistence and state: data modelling

A design is one plain JSON document (`design/types.ts`):

```json
{
  "schema": "afterhours.design", "version": 1,
  "id": "…", "revision": 12, "updatedAt": "…",
  "preset": "signal",
  "text": { "artist": "…", "title": "…" },
  "colors": { "background": "#0b0b0a", "accent": "#c8ff3b" },
  "motion": { "speed": 0.5, "intensity": 0.6, "texture": 0.55 },
  "layout": { "titlePosition": { "x": 0.08, "y": 0.14 } },
  "seed": 20240607
}
```

Every edit is a `DesignAction` handled by a pure reducer
(`design/reducer.ts`). Actions are plain data too, which makes them easy to
log, replay or send over a network. `design/schema.ts` validates anything
that comes from outside (a file or localStorage): it rejects wrong schemas,
unknown presets and bad colours with specific messages, and clamps numbers
out of range while reporting what it changed.

`design/storage.ts` defines a tiny `DesignStore` interface (`load`, `save`,
`clear`). The app uses a localStorage implementation with a debounced save.

**Towards shared editing.** The document already carries an `id`, a
monotonically increasing `revision` and a timestamp, and all changes flow
through serialisable actions. A collaborative version would implement
`DesignStore` over a server or a CRDT library, broadcast actions rather than
whole documents, and use `revision` for ordering or conflict resolution.
Nothing in the editor or renderer would need to change.

## Product analytics

`src/analytics/` measures how the studio is used, so product decisions can be
backed by data. Events record only *which feature* was used (never artist or
title text, colours or file names) and stay in this browser's localStorage.
Set `VITE_ANALYTICS_ENDPOINT` at build time to also POST each event to a
collector you control.

- `tracker.ts` is the local-first event log (random per-page-load session id).
- `metrics.ts` is a pure, tested module: funnel (edited -> audio loaded ->
  exported), median time to first export, preset mix, and edits per session
  for exporters vs non-exporters.
- The footer's **Download my usage data (CSV)** exports
  `timestamp,session,event,prop` rows for pandas, SQL or a spreadsheet.

See `PRODUCT.md` for the case-study template built on these metrics.

## Accessibility and motion

Every control is a native form element with a label; the artwork is focusable
and operable from the keyboard; status changes are announced through live
regions. The off-white on near-black palette exceeds WCAG AA. The app honours
`prefers-reduced-motion` (slower clock, no beat pulses, still grain) and never
uses rapid full-frame brightness changes.

## Fonts

Archivo Black, Space Mono and Instrument Serif are bundled under
`public/fonts` and licensed under the SIL Open Font License (licence files
sit next to each font). The app works offline.
