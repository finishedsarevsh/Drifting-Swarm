# The Drifting Swarm — Phase 1

> **Local docker-compose swarm simulation** · 6-node · single host · no cloud dependency

---

## What this is

Phase 1 proves the **DTASS (Drift-Triggered Adaptive Swarm Synchronisation)** mechanism end-to-end on a single machine using real CDC BRFSS survey data (1999–2024):

- Concept drift is detected via dual-signal sensing (PSI + ADWIN) as epidemiological distributions shift across annual survey cohorts
- **Exactly one node** retrains per drift epoch — enforced by a compare-and-swap lease on the ledger service
- The signed ΔW update propagates to all other nodes via MQTT (pub/sub)
- Conflicts resolve deterministically — the concurrent-drift pair (NY / NJ) is the canonical test case
- All telemetry flows into Prometheus → Grafana in real time

All on your laptop. No AWS account. No cost.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  docker-compose network  (drifting-swarm_swarm-net)             │
│                                                                  │
│  node-CA :8081 ─┐                                               │
│  node-TX :8082 ─┤  /metrics (Prometheus)                        │
│  node-OH :8083 ─┼──► mosquitto:1883  (swarm/deltas/#)           │
│  node-WY :8084 ─┤         │                                      │
│  node-NY :8085 ─┤         ▼                                      │
│  node-NJ :8086 ─┘   ledger-service:8000  (FastAPI + SQLite)     │
│                                                                  │
│          mlflow:5000   prometheus:9090   grafana:3005            │
└─────────────────────────────────────────────────────────────────┘
```

| Container | Image | Host Port |
|---|---|---|
| dtass-mosquitto | eclipse-mosquitto:2.0 | 1883, 9001 |
| dtass-ledger | custom (python:3.11-slim + FastAPI) | 8000 |
| dtass-mlflow | ghcr.io/mlflow/mlflow:v2.11.0 | 5000 |
| dtass-prometheus | prom/prometheus:v2.51.0 | 9090 |
| dtass-grafana | grafana/grafana:10.3.0 | **3005** |
| dtass-node-CA … NJ | custom (python:3.11-slim + LightGBM + River) | 8081–8086 |

---

## Full Start Workflow

> Run these steps **in order** the very first time. On subsequent runs, only Step 4 is needed.

---

### Step 1 — Generate Ed25519 keypairs  *(one-time)*

Each node signs its ΔW package with its private key. Run this once; the keys are
written to `keys/` and mounted read-only into every node container.

```powershell
pip install cryptography
python scripts/generate_keys.py
```

Expected output:
```
[generate_keys] Generated keys/CA_private.pem + keys/CA_public.pem
...
[generate_keys] All 6 keypairs written to ./keys/
```

---

### Step 2 — Populate `data/` with BRFSS survey data

You have two options — **A (real data, recommended)** or **B (synthetic, fast)**.

#### Option A — Real CDC BRFSS data via R  *(recommended)*

Downloads and processes the actual Behavioral Risk Factor Surveillance System
datasets (1999–2024) from CDC servers into per-state CSVs.

**Prerequisites:** R ≥ 4.1 installed and on PATH.

```powershell
# 1. Install required R packages (one-time, writes to user library)
Rscript scripts/_install_pkgs.R

# 2. Download, filter, and write data/CA/, data/TX/, ... data/NJ/
Rscript scripts/download_real_brfss.R
```

> **First run:** Downloads ~200–400 MB of XPT files from CDC servers (5–15 min
> depending on connection). All files are cached in `~/.brfssdata_cache/` —
> subsequent runs are instant.

Expected output:
```
✔ [CA] 45,231 rows | 25 years | 14 features | 9.2% diabetes
✔ [TX] 38,104 rows | 25 years | 14 features | 11.1% diabetes
✔ [OH] 31,208 rows | 25 years | 13 features | 10.4% diabetes
✔ [WY]  5,471 rows | 25 years | 12 features |  8.9% diabetes
✔ [NY] 34,050 rows | 26 years | 15 features |  9.6% diabetes
✔ [NJ] 24,958 rows | 25 years | 15 features |  9.8% diabetes
✔ All 6 states populated. Run  docker compose up  to start the swarm.
```

#### Option B — Synthetic data  *(no R required, fast)*

Generates Gaussian fake data with injected drift spikes. Useful for quick
smoke-tests but lacks real epidemiological signal.

```powershell
pip install numpy pandas
python scripts/gen_synthetic_data.py
```

---

### Step 3 — Build images  *(first time or after code changes)*

```powershell
docker compose build
```

To force a clean rebuild (e.g. after changing `requirements.txt`):

```powershell
docker compose build --no-cache
```

---

### Step 4 — Start the full stack

```powershell
docker compose up -d
```

All 11 containers start in dependency order:
`mosquitto` → `ledger-service` (health-checked) → `mlflow` → `prometheus` → `grafana` → `node-*`

Check that everything is healthy:

```powershell
docker compose ps
```

All containers should show `Up` or `Up (healthy)` within 30 seconds.

---

### Step 5 — Watch the swarm

#### Live log stream (all nodes)

```powershell
docker compose logs -f node-ca node-tx node-oh node-wy node-ny node-nj
```

Key log lines to look for:

| Log line | Meaning |
|---|---|
| `PSI=0.0842 (tau=0.05)` | Drift score for this year's batch |
| `DRIFT DETECTED … psi_drift=True` | Drift crossed threshold — retrain race begins |
| `Lease GRANTED for <epoch>` | **This node won** — it will retrain and publish ΔW |
| `Lease DENIED (winner=TX)` | Another node won — this node will apply ΔW |
| `ΔW published (N bytes)` | Signed delta package sent to MQTT swarm |
| `Applied ΔW from TX in 0.003s` | Receiving node verified and applied the update |
| `Holding /metrics endpoint alive for 45s` | Post-run hold for Prometheus scrape capture |

#### Dashboards

| Service | URL | Credentials |
|---|---|---|
| **Grafana** (DTASS monitor) | http://localhost:3005 | `admin` / `dtass2024` |
| **MLflow** (experiment log) | http://localhost:5000 | — |
| **Ledger API docs** | http://localhost:8000/docs | — |
| **Prometheus** | http://localhost:9090 | — |
| Node `/metrics` (e.g. TX) | http://localhost:8082/metrics | — |

In Grafana, open **DTASS Phase 1 — Swarm Monitor**. Set the time range to
**Last 30 minutes**. All five panels should populate within one full simulation
cycle (~60–90 seconds per run including the 45s hold).

---

### Stopping the stack

```powershell
# Stop containers, keep volumes (preserves ledger DB and MLflow data)
docker compose down

# Full teardown — wipes all volumes (use before a clean re-run)
docker compose down --volumes
```

> **When to use `--volumes`:** Always use it if you want a clean slate — e.g.
> after changing the PSI threshold or epoch ID format. The ledger SQLite DB
> persists across restarts and must be wiped to avoid stale epoch records.

---

## Simulation Behaviour

### Drift detection

Each node runs a **dual-signal detector** per annual BRFSS batch:

| Signal | Mechanism | Threshold |
|---|---|---|
| PSI (Population Stability Index) | Year-over-year feature distribution shift | **0.05** (calibrated for annual cohort batches) |
| ADWIN | Sliding-window accuracy degradation | delta = 0.002 |

Either signal crossing its threshold triggers the retrain race.

> The PSI threshold is set to **0.05** — not the industry-standard 0.25.
> The 0.25 value applies to monitoring production models over months.
> Real BRFSS year-over-year PSI is 0.001–0.15, so 0.05 correctly captures
> genuine epidemiological shifts (e.g. COVID-era policy changes in 2019→2020).

### Epoch ID format

Each drift event generates a unique epoch ID:

```
{BOOT_UUID[:8]}-{NODE_ID}-{YEAR}-{COUNTER:04d}
e.g.  4969f189-WY-2003-0000
```

The per-boot UUID prefix prevents epoch ID collisions when containers restart
with the counter reset to zero.

### Metrics hold

After processing all years, each node holds its `/metrics` HTTP endpoint alive
for **45 seconds** before exiting. This guarantees Prometheus (10s scrape interval)
captures at least 4 scrapes of the final non-zero counter values before
`docker restart` resets in-memory state.

---

## Node Selection Rationale

| Node | Role | What it stress-tests |
|---|---|---|
| CA | Large state (~45k rows) | Upper bound of data size; ΔW codec at scale |
| TX | Large state (~38k rows) | Proves CA isn't a special case; strongest drift signal |
| OH | Mid-size (~31k rows) | Baseline / "typical" node |
| WY | Small state (~5k rows) | Low-data edge case; high PSI variance tests the false-positive gate |
| NY | Concurrent-drift A | Simultaneous drift claim with NJ |
| NJ | Concurrent-drift B | Loser of compare-and-swap → applies ΔW instead of retraining |

---

## Data Flow — One Full Drift Cycle

```
1. data_loader.py   → streams next BRFSS year batch into drift_sentinel.py
2. drift_sentinel   → PSI / ADWIN crosses τ=0.05 → drift=True
3. main.py          → POST /claim {epoch_id, node_id} to ledger-service
4. ledger-service   → SQLite UNIQUE INSERT: first writer wins (HTTP 200),
                       all concurrent losers get HTTP 409 with winner's ID
5. Winner           → delta_retrain.py: LightGBM warm-start fine-tune
                       delta_codec.py: sparsify + quantise + Ed25519 sign
                       mqtt_client.py: publish to swarm/deltas/<epoch>
6. All other nodes  → receive MQTT message, verify Ed25519 signature,
                       apply ΔW (no retraining)
7. All nodes        → /metrics updated: dtass_retrain_total, dtass_model_version,
                       dtass_delta_bytes, dtass_apply_latency_s
8. Prometheus       → scrapes /metrics every 10s
9. Grafana          → dashboard panels update every 10s refresh
```

---

## Prometheus Metrics Reference

All metrics are labelled with `node_id` (values: `CA`, `TX`, `OH`, `WY`, `NY`, `NJ`).

| Metric | Type | Description |
|---|---|---|
| `dtass_drift_score` | Gauge | Current PSI score for the last batch |
| `dtass_retrain_total` | Counter | Cumulative retrain events won by this node |
| `dtass_delta_bytes` | Gauge | Size of last ΔW package published (bytes) |
| `dtass_apply_latency_s` | Gauge | Time to verify + apply last received ΔW (seconds) |
| `dtass_model_version` | Gauge | Current model version number |

---

## Bridge to Phase 2 (Cloud)

Every local component maps directly to a managed AWS service — **no node code changes required**:

| Phase 1 (local) | Phase 2 (AWS) |
|---|---|
| Mosquitto MQTT broker | AWS IoT Core (same MQTT contract) |
| ledger SQLite + FastAPI | DynamoDB conditional writes |
| `keys/` volume | AWS KMS asymmetric keys (Ed25519) |
| Prometheus + Grafana | CloudWatch + Amazon Managed Grafana |
| `data/<STATE>/` volume | S3 per-state prefix |
| Node Docker container | AWS Lambda / ECS per account |
| MLflow local | Amazon SageMaker Experiments |

---

## File Structure

```
drifting-swarm/
├── docker-compose.yml
├── node/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py              # node event loop — wires all modules together
│   ├── data_loader.py       # streams BRFSS CSV chronologically by IYEAR
│   ├── drift_sentinel.py    # dual-signal: PSI (τ=0.05) + River ADWIN
│   ├── delta_retrain.py     # LightGBM warm-start fine-tuning
│   ├── delta_codec.py       # sparsify + quantise + Ed25519 sign/verify
│   ├── ledger_client.py     # POST /claim, PATCH /version HTTP wrapper
│   └── mqtt_client.py       # pub/sub wrapper for swarm/deltas/#
├── ledger-service/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app.py               # FastAPI: /claim, /version, /epochs, /health
├── monitoring/
│   ├── prometheus.yml        # scrape config (10s interval, 6 nodes + ledger)
│   ├── mosquitto.conf
│   └── grafana/
│       ├── dashboards/
│       │   └── dtass.json    # provisioned dashboard (schemaVersion 39)
│       └── provisioning/
│           ├── datasources/prometheus.yml   # uid: PBFA97CFB590B2093 (pinned)
│           └── dashboards/dtass.yml
├── scripts/
│   ├── generate_keys.py      # Ed25519 keypair bootstrap (run once)
│   ├── gen_synthetic_data.py # synthetic BRFSS data (Option B)
│   ├── _install_pkgs.R       # R package installer (run once before Option A)
│   └── download_real_brfss.R # real BRFSS pipeline: CDC → data/<STATE>/
├── data/                     # BRFSS CSVs — gitignored
│   └── {CA,TX,OH,WY,NY,NJ}/
│       └── brfss_<STATE>.csv
└── keys/                     # Ed25519 keypairs — gitignored
    ├── <NODE>_private.pem
    └── <NODE>_public.pem
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Grafana panels show "No data" | Prometheus datasource UID mismatch | Confirm `monitoring/grafana/provisioning/datasources/prometheus.yml` has `uid: PBFA97CFB590B2093` |
| `Lease DENIED (winner=unknown)` on every drift | Stale epoch IDs in ledger DB from previous run | Run `docker compose down --volumes` then `docker compose up -d` |
| All PSI scores below threshold, no retrains | Wrong PSI threshold for real data | Confirm `PSI_THRESHOLD = 0.05` in `node/drift_sentinel.py` |
| Stat panels empty (Retrain Events etc.) | Node exited before Prometheus scraped | The 45s hold in `main.py` fixes this — rebuild with `docker compose build` |
| `river.drift` not found (IDE warning) | `river` not installed in local Windows Python | IDE warning only — runs fine inside Docker. Silence with `pip install river` |
| Grafana not reachable on port 3000 | Port conflict on Windows | Grafana is mapped to **port 3005** — use http://localhost:3005 |
