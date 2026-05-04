# LEGO MOC Planner

Interactive drawer map and parts index for organizing LEGO lots across the black and red drawer cabinets.

## Local Development

```sh
npm install
npm run dev
```

Production build:

```sh
npm run build
```

## Inventory Tracking

Inventory status is stored in the browser with `localStorage`, keyed by each part/color lot ID. It is local to the current browser profile and is not synced across devices.

Each lot can be marked as:

- `Unchecked`
- `Complete`
- `Partial`, with a found-piece count
- `Missing`

Use **Reset inventory** in the Parts index to clear saved browser inventory state.

## AI Image Scan

Image scanning uses Gemini from browser code and requires:

```sh
VITE_GEMINI_API_KEY=your_key_here
```

Create a local `.env` file from `.env.example`. Vite exposes `VITE_*` variables to client-side code, so do not use this setup for a public deployment with a sensitive production key. For a public app, route Gemini requests through a backend.
