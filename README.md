# Ans

Three projects live in this repository:

- **`nimbus/`** — [Nimbus](nimbus/README.md), a calm travel-and-productivity
  companion: one timeline for travel and work, usable focus windows, a
  time-zone shield, offline prep and a leave-now card (Next.js, TypeScript,
  Tailwind, AWS CDK). See its README for how to run it locally without AWS.

- **`afterhours/`** — [AFTERHOURS](afterhours/README.md), an interactive design
  playground for animated album artwork and music visuals (React, TypeScript,
  Vite, Canvas 2D, Web Audio). See its README for startup instructions and an
  explanation of the rendering, audio analysis and persistence.
- **Root files** (`manifest.json`, `popup.*`, `background.js`) — *Spotlight
  Productivity*, a Chrome extension with a Pomodoro timer, task list and website
  blocker. Load it unpacked from this folder via `chrome://extensions`.

Quick start for AFTERHOURS:

```bash
cd afterhours
npm install
npm run dev
```

Quick start for Nimbus:

```bash
cd nimbus
npm install
npm run dev
```
