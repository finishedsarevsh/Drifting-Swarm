# The Drifting Swarm — UI

**Interactive pitch deck + live swarm dashboard** for the DTASS (Drift-Triggered Adaptive Swarm Synchronisation) project.

## Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS v4 + custom design tokens |
| Animation | Framer Motion |
| Icons | Lucide React |
| Backend binding | Native WebSockets (MQTT) + Fetch (Prometheus) |

## Running the UI

```bash
cd ui
npm install
npm run dev
# → http://localhost:3001
```

Ensure the swarm backend is running first:
```bash
docker compose up -d
```

## Section Map

| # | Section | Key Feature |
|---|---|---|
| 1 | The Trilemma | Animated particle field + 3-constraint glass cards |
| 2 | The Model | Interactive SVG decision boundary with live sliders |
| 3 | Concept Drift | Canvas drift simulator with inject-shift button |
| 4 | Decentralized Drift | Asymmetric drift scenario cards |
| 5 | Comparison Matrix | Centralized ML vs FL vs DTASS table |
| 6 | Methodology | Interactive 5-step DTASS loop explorer |
| 7 | Detection Engine | PSI + River ADWIN dual detector cards |
| 8 | Architecture | SVG US node map with live node row counts |
| **9** | **Live Demo** | **Real backend connection — Prometheus + MQTT** |
| 10 | Phase 1 Results | Proven capabilities checklist |
| 11 | Cloud Scale | Local → AWS migration table |
| 12 | Industry Fit | Banking, Telecom, Manufacturing, Cybersecurity |
| 13 | The Ask | Sponsorship breakdown |
| 14 | ROI | Enterprise deliverables |
| 15 | About Us | Team + terminal clone card |

## Live Backend Connections (Section 9)

The dashboard connects to the local Docker Compose stack:

| Source | Endpoint | Purpose |
|---|---|---|
| Prometheus | `http://localhost:8081-8086/metrics` | Drift scores, retrain counters, delta bytes, latency |
| MQTT WS | `ws://localhost:9001` | Live delta broadcast events on `swarm/deltas/#` |

Connection state is shown in the HUD. All metrics poll every 5 seconds.
