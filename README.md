# Schach 2

Local hot-seat web app for **Schach 2** (v3.1 playtest rules).

## Run

```bash
cd chess2
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Stack

- React + TypeScript + Vite
- Pure rules engine in `src/engine/` (swap UI / add multiplayer / 3D later)
- Illegal moves are rejected and written to the on-screen log with a reason

## Rules source

See `../Chess 2.txt` (v3.1 amendments locked with the app).
