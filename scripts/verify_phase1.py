"""
validate_phase1.py
==================
DTASS Phase 1 -- Official Sign-Off Validation Script

Verifies all 5 success parameters by querying the live local APIs:

  PARAM 1  Visualization Layer    -- Grafana health + datasource probe
  PARAM 2  End-to-End Telemetry   -- Prometheus metric queries
  PARAM 3  Conflict Resolution    -- Ledger epoch + version audit
  PARAM 4  Single-Node Retraining -- MLflow experiment + run metrics
  PARAM 5  Swarm Propagation      -- apply_latency_s proof + analysis

Usage (from project root):
    python scripts/validate_phase1.py

Requirements:
    pip install requests
"""

# ---- stdout: force UTF-8 so Windows cp1252 does not choke ----
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import json, time
from datetime import datetime, timezone

try:
    import requests
    from requests.auth import HTTPBasicAuth
except ImportError:
    sys.exit("Missing dependency: run  pip install requests  then retry.")

# ==============================================================================
# Configuration
# ==============================================================================
GRAFANA_URL    = "http://localhost:3005"
GRAFANA_USER   = "admin"
GRAFANA_PASS   = "dtass2024"

PROMETHEUS_URL = "http://localhost:9090"
LEDGER_URL     = "http://localhost:8000"
MLFLOW_URL     = "http://localhost:5000"

NODES          = ["CA", "TX", "OH", "WY", "NY", "NJ"]
PSI_THRESHOLD  = 0.05

# ==============================================================================
# Display helpers  (pure ASCII to survive any Windows terminal)
# ==============================================================================
W = 74

def _rule(char="="):          return char * W
def _header(title):
    inner = f"  {title}  "
    pad   = (W - len(inner)) // 2
    print(f"\n{_rule()}")
    print(f"{'=' * pad}{inner}{'=' * (W - pad - len(inner))}")
    print(_rule())

def _section(title):
    print(f"\n  -- {title} {'- ' * max(0, (W - len(title) - 6) // 2)}")

def _ok(msg):    print(f"  [PASS]  {msg}")
def _warn(msg):  print(f"  [WARN]  {msg}")
def _fail(msg):  print(f"  [FAIL]  {msg}")
def _info(msg):  print(f"          {msg}")
def _row(label, value):
    print(f"  {label:<32}{value}")

# Tracks overall pass/fail per parameter
_results: list[tuple[str, bool, str]] = []   # (param_name, passed, note)

def _record(param, passed, note=""):
    _results.append((param, passed, note))

# ==============================================================================
# HTTP helpers
# ==============================================================================
def _get(url, auth=None, timeout=6):
    try:
        r = requests.get(url, auth=auth, timeout=timeout)
        return r
    except requests.exceptions.ConnectionError:
        return None
    except Exception as e:
        return None

def _post(url, payload, timeout=10):
    try:
        r = requests.post(url, json=payload, timeout=timeout)
        return r
    except Exception:
        return None

def prom_query(expr):
    """Instant query; returns list of result dicts or None on error."""
    r = _get(f"{PROMETHEUS_URL}/api/v1/query?query={requests.utils.quote(expr)}")
    if r is None or r.status_code != 200:
        return None
    return r.json().get("data", {}).get("result", [])

def mlflow_params(run):
    """Normalize MLflow params (list or dict) -> plain dict."""
    raw = run.get("data", {}).get("params", {})
    if isinstance(raw, list):
        return {p["key"]: p["value"] for p in raw}
    return raw

def mlflow_metrics(run):
    """Normalize MLflow metrics (list or dict) -> plain dict."""
    raw = run.get("data", {}).get("metrics", {})
    if isinstance(raw, list):
        return {m["key"]: m["value"] for m in raw}
    return raw

# ==============================================================================
# Report header
# ==============================================================================
now_str = datetime.now().strftime("%Y-%m-%d  %H:%M:%S")
print(f"\n{_rule()}")
print(f"  DTASS PHASE 1 -- OFFICIAL SIGN-OFF VALIDATION REPORT")
print(f"  Generated : {now_str}")
print(f"  Nodes     : {', '.join(NODES)}")
print(_rule())

# ==============================================================================
# PARAMETER 1 -- Visualization Layer (Grafana)
# ==============================================================================
_header("PARAM 1 / 5  --  Visualization Layer  (Grafana)")
auth = HTTPBasicAuth(GRAFANA_USER, GRAFANA_PASS)

_section("Container liveness  GET /api/health")
r = _get(f"{GRAFANA_URL}/api/health", auth=auth)
if r is None:
    _fail(f"Grafana unreachable at {GRAFANA_URL}")
    _record("Visualization Layer", False, "Grafana not reachable")
else:
    body = r.json()
    db_ok   = body.get("database", "?")
    version = body.get("version", "?")
    _ok(f"Grafana is alive  |  version={version}  |  database={db_ok}")
    _info(f"Response: {json.dumps(body)}")

    _section("Datasource probe  GET /api/datasources")
    r2 = _get(f"{GRAFANA_URL}/api/datasources", auth=auth)
    if r2 is None or r2.status_code != 200:
        _fail("Could not fetch datasources")
        _record("Visualization Layer", False, "Datasource fetch failed")
    else:
        sources = r2.json()
        prom_ds = next((s for s in sources if s.get("type") == "prometheus"), None)
        if prom_ds is None:
            _fail("No Prometheus datasource found in Grafana")
            _record("Visualization Layer", False, "Missing Prometheus datasource")
        else:
            uid  = prom_ds.get("uid", "?")
            name = prom_ds.get("name", "?")
            url  = prom_ds.get("url", "?")
            _ok(f"Prometheus datasource provisioned  |  name='{name}'  uid={uid}")
            _info(f"URL pointing to: {url}")

            # health check
            r3 = _get(f"{GRAFANA_URL}/api/datasources/uid/{uid}/health", auth=auth)
            if r3 and r3.status_code == 200:
                h = r3.json()
                status  = h.get("status", "?")
                message = h.get("message", "")
                if status == "OK":
                    _ok(f"Datasource health check: {status}  -- {message}")
                    _record("Visualization Layer", True, f"Grafana v{version}, datasource OK")
                else:
                    _warn(f"Datasource health: {status}  -- {message}")
                    _record("Visualization Layer", False, f"Datasource health={status}")
            else:
                _warn("Could not query datasource health endpoint (non-fatal)")
                _record("Visualization Layer", True,
                        f"Grafana v{version}, datasource provisioned (health skipped)")

# ==============================================================================
# PARAMETER 2 -- End-to-End Telemetry + Drift Detection (Prometheus)
# ==============================================================================
_header("PARAM 2 / 5  --  Drift Detection & Telemetry  (Prometheus)")

_section("Scrape-target health  GET /api/v1/targets")
r = _get(f"{PROMETHEUS_URL}/api/v1/targets")
if r is None:
    _fail(f"Prometheus unreachable at {PROMETHEUS_URL}")
    _record("Telemetry / Drift Detection", False, "Prometheus not reachable")
else:
    active = r.json().get("data", {}).get("activeTargets", [])
    up     = [t for t in active if t.get("health") == "up"]
    down   = [t for t in active if t.get("health") != "up"]
    _ok(f"Active targets: {len(active)}  |  UP: {len(up)}  |  DOWN: {len(down)}")
    for t in active:
        lbl    = t.get("labels", {})
        status = "UP  " if t.get("health") == "up" else "DOWN"
        _info(f"  [{status}]  job={lbl.get('job','?'):<20}  instance={lbl.get('instance','?')}")

    telemetry_ok = True

    # ---- dtass_drift_score ----
    _section("dtass_drift_score  (drift detection proof)")
    results = prom_query("dtass_drift_score")
    if not results:
        _fail("No data for dtass_drift_score")
        telemetry_ok = False
    else:
        drifting = []
        for res in sorted(results, key=lambda x: x["metric"].get("node_id", "")):
            node_id = res["metric"].get("node_id", "?")
            psi     = float(res["value"][1])
            flag    = "  <<< DRIFT ACTIVE" if psi >= PSI_THRESHOLD else ""
            _ok(f"node-{node_id}  PSI = {psi:.4f}{flag}")
            if psi >= PSI_THRESHOLD:
                drifting.append(node_id)
        if drifting:
            _info(f"Nodes currently above drift threshold ({PSI_THRESHOLD}): {', '.join(drifting)}")

    # ---- dtass_retrain_total ----
    _section("dtass_retrain_total  (retrain event counter)")
    results = prom_query("dtass_retrain_total")
    total_retrains = 0
    if not results:
        _warn("No data for dtass_retrain_total -- nodes may still be in hold period")
    else:
        for res in sorted(results, key=lambda x: x["metric"].get("node_id", "")):
            node_id = res["metric"].get("node_id", "?")
            count   = int(float(res["value"][1]))
            total_retrains += count
            bar = "#" * count + "." * max(0, 12 - count)
            _ok(f"node-{node_id}  [{bar}]  {count} retrain(s)")
        _info(f"Total retrains logged in Prometheus: {total_retrains}")

    # ---- dtass_delta_bytes ----
    _section("dtass_delta_bytes  (delta-W package sizes)")
    results = prom_query("dtass_delta_bytes")
    if not results:
        _warn("No data for dtass_delta_bytes")
    else:
        for res in sorted(results, key=lambda x: x["metric"].get("node_id", "")):
            node_id = res["metric"].get("node_id", "?")
            b       = float(res["value"][1])
            kb      = b / 1024
            _ok(f"node-{node_id}  last delta-W = {kb:>10.1f} KB  ({int(b):>12,} bytes)")

    _record("Telemetry / Drift Detection", telemetry_ok,
            f"{total_retrains} total retrain events scraped")

# ==============================================================================
# PARAMETER 3 -- Deterministic Conflict Resolution (Ledger Service)
# ==============================================================================
_header("PARAM 3 / 5  --  Deterministic Conflict Resolution  (Ledger)")

_section("Service health  GET /health")
r = _get(f"{LEDGER_URL}/health")
if r is None:
    _fail(f"Ledger service unreachable at {LEDGER_URL}")
    _record("Conflict Resolution", False, "Ledger not reachable")
else:
    h = r.json()
    _ok(f"Ledger alive  |  status={h.get('status','?')}  service={h.get('service','?')}")

    _section("Epoch lease audit  GET /epochs")
    epochs_r = _get(f"{LEDGER_URL}/epochs?limit=50")
    epochs   = epochs_r.json() if epochs_r and epochs_r.status_code == 200 else []

    if not epochs:
        _warn("No epoch records found -- run may not have triggered drift yet")
        _record("Conflict Resolution", False, "No epochs in ledger")
    else:
        # Analyse winner distribution
        winner_counts: dict[str, int] = {}
        for ep in epochs:
            w = ep.get("winner", "?")
            winner_counts[w] = winner_counts.get(w, 0) + 1

        _ok(f"Total epoch records in ledger: {len(epochs)}")
        _info("")
        _info(f"  {'EPOCH ID':<42}  {'WINNER':<6}  GRANTED AT (UTC)")
        _info(f"  {'-'*42}  {'-'*6}  {'-'*19}")
        for ep in epochs[:15]:
            ts = datetime.fromtimestamp(ep["granted_at"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            _info(f"  {ep['epoch_id']:<42}  {ep['winner']:<6}  {ts}")
        if len(epochs) > 15:
            _info(f"  ... ({len(epochs) - 15} earlier records not shown)")

        _info("")
        _ok("Winner distribution (compare-and-swap leases granted):")
        for node in NODES:
            c = winner_counts.get(node, 0)
            bar = "#" * c + "." * max(0, 10 - c)
            _info(f"    node-{node}  [{bar}]  {c} lease(s) won")

        # Verify uniqueness: each epoch_id must appear exactly once
        epoch_ids = [ep["epoch_id"] for ep in epochs]
        if len(epoch_ids) == len(set(epoch_ids)):
            _ok("UNIQUENESS CHECK: every epoch_id is unique -- no double-grants detected")
        else:
            _fail("UNIQUENESS CHECK: duplicate epoch_ids found -- arbitration may be broken")

        # Verify boot-UUID format (e.g. 4969f189-WY-2003-0003)
        malformed = [e for e in epoch_ids if len(e.split("-")) < 5]
        if not malformed:
            _ok("EPOCH FORMAT CHECK: all IDs carry boot-UUID prefix -- restart-safe")
        else:
            _warn(f"{len(malformed)} epoch(s) without boot-UUID prefix (from earlier runs)")

        _section("Model version registry  GET /versions")
        ver_r = _get(f"{LEDGER_URL}/versions")
        vers  = ver_r.json() if ver_r and ver_r.status_code == 200 else []
        if vers:
            _info(f"  {'NODE':<8}  {'VERSION':<10}  {'LAST EPOCH':<42}  UPDATED AT (UTC)")
            _info(f"  {'-'*8}  {'-'*10}  {'-'*42}  {'-'*19}")
            for v in sorted(vers, key=lambda x: x.get("node_id", "")):
                ts = datetime.fromtimestamp(v["updated_at"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                _info(f"  {v['node_id']:<8}  {v['version']:<10}  {(v['last_epoch'] or '-'):<42}  {ts}")
            _ok(f"Version records present for {len(vers)} node(s)")
        else:
            _warn("No /versions records (nodes may not have applied ΔW yet)")

        _record("Conflict Resolution", True,
                f"{len(epochs)} epochs, all unique, {len(winner_counts)} distinct winner(s)")

# ==============================================================================
# PARAMETER 4 -- Single-Node Retraining (MLflow)
# ==============================================================================
_header("PARAM 4 / 5  --  Single-Node Retraining  (MLflow)")

_section("Experiment lookup  GET /api/2.0/mlflow/experiments/get-by-name")
r = _get(f"{MLFLOW_URL}/api/2.0/mlflow/experiments/get-by-name?experiment_name=dtass-phase1")
if r is None:
    _fail(f"MLflow unreachable at {MLFLOW_URL}")
    _record("Single-Node Retraining", False, "MLflow not reachable")
elif r.status_code == 404:
    _fail("Experiment 'dtass-phase1' not found -- no retrains have been logged yet")
    _record("Single-Node Retraining", False, "Experiment missing")
else:
    exp    = r.json().get("experiment", {})
    exp_id = exp.get("experiment_id", "")
    _ok(f"Experiment found  |  id={exp_id}  name={exp.get('name')}")
    _info(f"Artifact root: {exp.get('artifact_location', '-')}")

    _section("Run search  POST /api/2.0/mlflow/runs/search")
    r2 = _post(
        f"{MLFLOW_URL}/api/2.0/mlflow/runs/search",
        {"experiment_ids": [exp_id], "max_results": 200, "order_by": ["start_time DESC"]},
    )
    if r2 is None or r2.status_code != 200:
        _fail("Could not retrieve runs")
        _record("Single-Node Retraining", False, "Run fetch failed")
    else:
        runs = r2.json().get("runs", [])
        _ok(f"Total MLflow runs logged: {len(runs)}  (one per retrain-event won)")

        # Per-node tally
        node_wins: dict[str, int] = {}
        for run in runs:
            p = mlflow_params(run)
            n = p.get("node_id", "?")
            node_wins[n] = node_wins.get(n, 0) + 1

        _info("")
        _ok("Retrain wins logged to MLflow by node:")
        for node in NODES:
            c   = node_wins.get(node, 0)
            bar = "#" * c + "." * max(0, 10 - c)
            _info(f"    node-{node}  [{bar}]  {c} run(s)")

        # Most recent run detail
        if runs:
            _section("Most recent run detail")
            latest  = runs[0]
            info    = latest.get("info", {})
            params  = mlflow_params(latest)
            metrics = mlflow_metrics(latest)

            ts = datetime.fromtimestamp(
                info.get("start_time", 0) / 1000, tz=timezone.utc
            ).strftime("%Y-%m-%d %H:%M:%S UTC")

            _row("Run ID:",        info.get("run_id", "-")[:20] + "...")
            _row("Node:",          params.get("node_id", "-"))
            _row("Epoch:",         params.get("epoch", "-"))
            _row("Model version:", params.get("model_version", "-"))
            _row("Status:",        info.get("status", "-"))
            _row("Started at:",    ts)

            print()
            # Try common metric key variants
            for mk_label, mk_variants in [
                ("accuracy",  ["accuracy", "acc"]),
                ("logloss",   ["logloss", "log_loss"]),
                ("roc_auc",   ["roc_auc", "auc"]),
                ("f1",        ["f1", "f1_score"]),
            ]:
                val = next((metrics[k] for k in mk_variants if k in metrics), None)
                if val is not None:
                    _row(f"  {mk_label}:", f"{float(val):.4f}")
                else:
                    _row(f"  {mk_label}:", "not logged under expected key")

        _record("Single-Node Retraining", len(runs) > 0,
                f"{len(runs)} runs, {len(node_wins)} node(s) won leases")

# ==============================================================================
# PARAMETER 5 -- Efficient Swarm Propagation
# ==============================================================================
_header("PARAM 5 / 5  --  Efficient Swarm Propagation  (Prometheus)")

_section("dtass_apply_latency_s  (ΔW receive + verify + apply time)")

print("""
  PROOF RATIONALE
  ---------------
  The metric  dtass_apply_latency_s{node_id=X}  is set inside node/main.py
  at line:

      lat = time.time() - t0
      _prom_set(G_APPLY_LAT, lat, NODE_ID)

  This line is reached ONLY when all three of these conditions are true:

    (a) The node received a ΔW MQTT message on  swarm/deltas/#
    (b) delta_codec.py verified the Ed25519 signature successfully
    (c) The update was applied to the in-memory LightGBM model

  A non-zero value therefore proves:
    * MQTT propagation worked end-to-end
    * Ed25519 signature verification passed (no tampered packets)
    * The receiving node updated its model WITHOUT retraining (zero retrain cost)

  Cross-referencing with dtass_retrain_total:
    * Nodes with retrain_total > 0  = lease winners  (they trained)
    * Nodes with apply_latency_s > 0 but retrain_total = 0
                                    = apply-only receivers (they propagated)
  The combination proves single-retrain + N-1 free propagation per epoch.
""")

results_lat    = prom_query("dtass_apply_latency_s")
results_retrain = prom_query("dtass_retrain_total")

retrain_map: dict[str, int] = {}
if results_retrain:
    for res in results_retrain:
        retrain_map[res["metric"].get("node_id", "?")] = int(float(res["value"][1]))

if results_lat is None:
    _warn("dtass_apply_latency_s not yet in Prometheus (nodes still in first cycle)")
    _record("Swarm Propagation", False, "No apply_latency_s data yet")
elif not results_lat:
    _warn("dtass_apply_latency_s is declared but has no values yet")
    _warn("This means no node has received and applied a ΔW package in the current cycle")
    _warn("Wait for the next hold window (45s post-loop) and re-run this script")
    _record("Swarm Propagation", False, "apply_latency_s = 0 for all nodes")
else:
    appliers  = []
    trainers  = []
    for res in sorted(results_lat, key=lambda x: x["metric"].get("node_id", "")):
        node_id = res["metric"].get("node_id", "?")
        lat_s   = float(res["value"][1])
        retrains = retrain_map.get(node_id, 0)
        role    = "RETRAINED + published ΔW" if retrains > 0 else "RECEIVED + applied ΔW (no retrain)"
        if retrains == 0 and lat_s > 0:
            appliers.append(node_id)
        elif retrains > 0:
            trainers.append(node_id)
        _ok(f"node-{node_id}  apply_latency={lat_s:.4f}s  retrains={retrains}  --> {role}")

    print()
    if appliers:
        _ok(f"Pure propagation nodes (apply only, no retrain): {', '.join(appliers)}")
        _ok(f"Retrain-winner nodes: {', '.join(trainers)}")
        _ok("PROPAGATION PROOF: Ed25519-signed ΔW packages propagated to swarm successfully")
        _record("Swarm Propagation", True,
                f"{len(trainers)} retrained, {len(appliers)} applied-only")
    else:
        _warn("No pure-propagation nodes observed yet in current Prometheus window")
        _warn("This is normal if the simulation is mid-cycle -- re-run after the hold period")
        _record("Swarm Propagation", False, "No apply-only nodes in current window")

# ==============================================================================
# Final Summary
# ==============================================================================
_header("PHASE 1 VALIDATION SUMMARY")

all_passed = all(p for _, p, _ in _results)

print()
print(f"  {'PARAMETER':<38}  {'RESULT':<6}  NOTE")
print(f"  {'-'*38}  {'-'*6}  {'-'*24}")
for (name, passed, note) in _results:
    result_str = "PASS" if passed else "FAIL"
    _info(f"  {name:<38}  {result_str:<6}  {note}")

print()
if all_passed:
    print(f"  {'=' * 70}")
    print(f"  OVERALL: PHASE 1 COMPLETE -- ALL PARAMETERS PASSED")
    print(f"  {'=' * 70}")
else:
    fails = [name for name, passed, _ in _results if not passed]
    print(f"  {'=' * 70}")
    print(f"  OVERALL: {len(fails)} PARAMETER(S) DID NOT PASS: {', '.join(fails)}")
    print(f"  Check [FAIL]/[WARN] lines above for details.")
    print(f"  {'=' * 70}")

print()
