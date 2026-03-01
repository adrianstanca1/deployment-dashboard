# Deploy Hub — Dashboard Frontend

A full-featured server management UI built with React, Vite, and Tailwind CSS. Pairs with [`deployment-dashboard-server`](https://github.com/adrianstanca1/deployment-dashboard-server).

**Live at:** http://srv1262179.hstgr.cloud:8080

---

## Features

| Page | Description |
|------|-------------|
| **Overview** | At-a-glance summary of PM2 processes, Docker containers, system stats, and GitHub repos |
| **PM2** | Full process manager — start, stop, restart, delete, bulk ops, live logs, env vars |
| **Docker** | Docker Desktop-like UI — containers, images, volumes, networks, live logs, inspect drawer, exec terminal, pull/run/prune |
| **Terminal** | Real PTY terminal with multi-tab support; also used for Docker exec sessions |
| **GitHub** | Repository browser with 7 tabs: overview, commits, branches, issues, PRs, releases, actions |
| **System Monitor** | Live CPU, memory, disk, network charts with historical data via WebSocket |
| **Deploy** | Deploy pipeline with SSE streaming output — clone, install, build, start via PM2 |
| **Logs** | Live PM2 log tail per process |
| **File Manager** | Browse, edit, upload, download files on the server |
| **Command Palette** | `Ctrl+K` quick-action launcher |

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** — build tooling
- **Tailwind CSS** — styling
- **TanStack Query** — data fetching and caching
- **xterm.js** — PTY terminal rendering
- **Recharts** — system monitor charts
- **Lucide React** — icons
- **Axios** — HTTP client

## Getting Started

### Prerequisites

- Node.js 18+
- The backend server running (see [deployment-dashboard-server](https://github.com/adrianstanca1/deployment-dashboard-server))

### Development

```bash
npm install
npm run dev
```

Vite dev server starts on `http://localhost:5173` and proxies `/api` and `/ws` to the backend at `localhost:3999`.

### Production Build

```bash
npm run build
```

Output goes to `dist/`. The backend Express server serves these static files directly.

## Environment & Configuration

All runtime configuration is handled by the backend. The frontend connects to `/api` and WebSocket paths relative to its own origin — no environment variables needed in the frontend itself.

## WebSocket Endpoints

The backend exposes these WebSocket paths (proxied by the frontend dev server):

| Path | Purpose |
|------|---------|
| `/ws` | PM2 process status updates (5s interval) |
| `/ws/terminal` | PTY terminal sessions |
| `/ws/logs` | PM2 log tail per process |
| `/ws/stats` | System stats (CPU, RAM, disk, network) |
| `/ws/docker` | Docker container log tail |

## Project Structure

```
src/
├── api/          # Axios API client with typed methods
├── components/   # Shared UI components
├── contexts/     # Auth context
├── hooks/        # Custom React hooks (WebSocket, PM2, Docker, etc.)
├── pages/        # Page components (one per route)
├── types/        # TypeScript type definitions
└── utils/        # Utility functions
```

## License

MIT
