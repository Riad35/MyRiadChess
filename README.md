# Myriad Chess

Local hot-seat web app for **Myriad Chess** (v3.1 playtest rules).

## Run

```bash
cd MyRiadChess
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Stack

- React + TypeScript + Vite
- Pure rules engine in `src/engine/` (swap UI / add multiplayer / 3D later)
- Illegal moves are rejected and written to the on-screen log with a reason

## Rules source

See [RULES.md](RULES.md). `Chess 2.txt` is the older v3.1 source that book was consolidated from.
