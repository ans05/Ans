# SONAR — music industry network intelligence

Interactive prototype for exploring how artists, producers, songs, labels and
venues connect. Next.js · TypeScript · Tailwind · D3 (force layout / zoom / drag).

> **All data is fictional.** Every artist, label, venue and number is invented
> and the UI shows a `DEMO DATA` badge. No API keys are needed.

## Run

```bash
cd sonar
npm install
npm run dev        # http://localhost:3000
# or: npm run build && npm start
npm run typecheck
```

## What you can do

| Feature | How |
| --- | --- |
| Explore the graph | Drag nodes, scroll/pinch to zoom, drag background to pan, **Fit view** to re-frame |
| Hover | Connected nodes highlight, everything else dims, tooltip shows key facts |
| Click a node | Loads its first degree of connections (no reload) and opens the detail panel |
| **Expand network** | Loads another degree (1° → 2° → 3°) around the selected node |
| Detail panel | Image, listeners, genre, location, top collaborators, top songs, recent releases, grouped connections |
| Scene pulse | Click a city to transform the graph into that scene's artists, producers, labels, venues and songs |
| Search | `/` focuses the box; pick a result and the camera flies to the node (loading it first if needed) |
| Filters | Toggle artists / producers / songs / labels / venues |

Keyboard: nodes are focusable (`Tab`, `Enter`/`Space` to select); search supports ↑ ↓ Enter Esc. Animations respect `prefers-reduced-motion`. The layout works from phone widths (filter/scene strips on top, details as a bottom sheet) to desktop (left rail, graph, right panel).

## Architecture

```
src/
  domain/types.ts        Entity / Relationship / Scene models (source-agnostic)
  data/
    provider.ts          MusicDataProvider interface — the only seam to a data source
    mockProvider.ts      Implementation over bundled fictional data (adds latency to mimic an API)
    mock/                45 entities (15 artists, 10 producers, 10 songs, 5 labels, 5 venues), ~120 relationships, 5 scenes
    adapters/            Notes + stubs for Spotify, MusicBrainz, Last.fm (not implemented)
    index.ts             getProvider()
  network/               Pure logic: store merging, view/filter projection, BFS expansion, search ranking
  hooks/useSonar.ts      App state (reducer) + async actions: select, expand, focus, scenes, filters
  graph/                 D3 visualisation (GraphCanvas.tsx) and visual theme (colours, glyphs, link lengths)
  components/            UI: header/search, filter rail + scene pulse, entity panel, tooltip, generated cover art
  app/                   Next.js entry, global styles
```

Separation of concerns: **UI** never talks to data directly — it uses `useSonar`,
which calls the `MusicDataProvider`. **Graph visualisation** receives plain
`{nodes, links}` and callbacks. **Network logic** is pure and framework-free.

### Connecting real APIs later

Implement `MusicDataProvider` (`getSeeds`, `getEntity`, `getNeighborhood`, `search`,
`getScenes`, `getSceneGraph`, `getTotals`) and return it from `getProvider()`.
Keep keys server-side: call Spotify / Last.fm from Next.js route handlers and have
the provider fetch those routes. `src/data/adapters/*.ts` sketch how each API maps
onto the model (e.g. MusicBrainz relationship types → `signed_to`, `produced_for`,
`performed_at`). Set `isDemo = false` on a real provider and the DEMO DATA badge disappears.

## Known limits

- Artwork is procedurally generated placeholder art (no copyrighted images).
- Scene growth percentages and listener counts are invented demo values.
- Rendering is SVG, comfortable up to a few hundred nodes; a Canvas renderer would be the next step for thousands.
