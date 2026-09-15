"""
main.py
Node event loop — wires data_loader → drift_sentinel → delta_retrain →
delta_codec → ledger_client → mqtt_client together.

One container runs this for each of the 6 nodes.  All configuration is
via environment variables (set in docker-compose.yml).

Environment variables
---------------------
NODE_ID       : e.g. "CA", "TX", "NY" (required)
MQTT_HOST     : hostname of mosquitto (default: "mosquitto")
MQTT_PORT     : int (default: 1883)
LEDGER_URL    : base URL (default: "http://ledger-service:8000")
MLFLOW_URL    : base URL (default: "http://mlflow:5000")
DATA_DIR      : directory with BRFSS CSV (default: "/app/data")
KEYS_DIR      : directory with Ed25519 keys (default: "/app/keys")
METRICS_PORT  : Prometheus /metrics port (default: 8080)
BATCH_SLEEP_S : seconds between batches (default: 2)
"""

import logging
import os
import time
import json
import uuid
from pathlib import Path

# ---- configure logging first ----
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("node.main")

# ---- local modules ----
from data_loader import BRFSSDataLoader, TARGET_COL
from drift_sentinel import DriftSentinel
from delta_retrain import DeltaRetrain
from delta_codec import DeltaCodec, generate_keypair
from ledger_client import LedgerClient
from mqtt_client import MQTTClient

# ---- optional dependencies ----
try:
    # pyrefly: ignore [missing-import]
    import mlflow
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False
    logger.warning("mlflow not installed – experiment logging disabled")

try:
    from prometheus_client import start_http_server, Gauge, Counter
    PROM_AVAILABLE = True
except ImportError:
    PROM_AVAILABLE = False
    logger.warning("prometheus_client not installed – /metrics endpoint disabled")


# ==================================================================
# Configuration
# ==================================================================
NODE_ID       = os.environ.get("NODE_ID", "LOCAL")
MQTT_HOST     = os.environ.get("MQTT_HOST", "mosquitto")
MQTT_PORT     = int(os.environ.get("MQTT_PORT", "1883"))
LEDGER_URL    = os.environ.get("LEDGER_URL", "http://ledger-service:8000")
MLFLOW_URL    = os.environ.get("MLFLOW_URL", "http://mlflow:5000")
DATA_DIR      = os.environ.get("DATA_DIR", "/app/data")
KEYS_DIR      = os.environ.get("KEYS_DIR", "/app/keys")
METRICS_PORT  = int(os.environ.get("METRICS_PORT", "8080"))
BATCH_SLEEP_S = float(os.environ.get("BATCH_SLEEP_S", "2"))

# Unique prefix for this boot — prevents epoch_id collisions with stale
# ledger records when the container restarts with epoch_counter reset to 0.
BOOT_ID = uuid.uuid4().hex[:8]


# ==================================================================
# Prometheus metrics
# ==================================================================
if PROM_AVAILABLE:
    G_DRIFT_SCORE   = Gauge("dtass_drift_score",   "Current PSI drift score",   ["node_id"])
    G_RETRAIN_COUNT = Counter("dtass_retrain_total", "Total retrain events",     ["node_id"])
    G_DELTA_SIZE    = Gauge("dtass_delta_bytes",   "Last ΔW package size bytes", ["node_id"])
    G_APPLY_LAT     = Gauge("dtass_apply_latency_s", "Last ΔW apply latency",   ["node_id"])
    G_MODEL_VER     = Gauge("dtass_model_version", "Current model version",      ["node_id"])


def _prom_set(gauge, value, *label_values):
    if PROM_AVAILABLE:
        try:
            gauge.labels(*label_values).set(value)
        except Exception:
            pass

def _prom_inc(counter, *label_values):
    if PROM_AVAILABLE:
        try:
            counter.labels(*label_values).inc()
        except Exception:
            pass


# ==================================================================
# MLflow helpers
# ==================================================================
def _log_retrain(epoch: str, metrics: dict, model_version: int):
    if not MLFLOW_AVAILABLE:
        return
    try:
        mlflow.set_tracking_uri(MLFLOW_URL)
        mlflow.set_experiment("dtass-phase1")
        with mlflow.start_run(run_name=f"{NODE_ID}-{epoch}"):
            mlflow.log_param("node_id", NODE_ID)
            mlflow.log_param("epoch", epoch)
            mlflow.log_param("model_version", model_version)
            mlflow.log_metrics({k: float(v) for k, v in metrics.items() if isinstance(v, (int, float))})
    except Exception as exc:
        logger.warning("MLflow log failed: %s", exc)


# ==================================================================
# Main event loop
# ==================================================================
def run():
    logger.info("=" * 60)
    logger.info("  DTASS Node starting: %s", NODE_ID)
    logger.info("=" * 60)

    # ---- start Prometheus /metrics endpoint ----
    if PROM_AVAILABLE:
        start_http_server(METRICS_PORT)
        logger.info("Prometheus /metrics on port %d", METRICS_PORT)

    # ---- generate / verify keypair ----
    keys_path = Path(KEYS_DIR)
    generate_keypair(keys_path, NODE_ID)

    # ---- instantiate all components ----
    loader   = BRFSSDataLoader(DATA_DIR, NODE_ID)
    sentinel = DriftSentinel(NODE_ID)
    retrainer= DeltaRetrain(NODE_ID)
    codec    = DeltaCodec(NODE_ID, KEYS_DIR)
    ledger   = LedgerClient(LEDGER_URL, NODE_ID)
    mqtt     = MQTTClient(
        node_id=NODE_ID,
        mqtt_host=MQTT_HOST,
        mqtt_port=MQTT_PORT,
    )

    # ---- connect MQTT ----
    mqtt_ok = mqtt.connect()
    if not mqtt_ok:
        logger.warning("[%s] Running without MQTT (offline mode)", NODE_ID)

    years = loader.years()
    logger.info("[%s] Data years: %s", NODE_ID, years)

    epoch_counter = 0

    # ---- main loop: one iteration = one survey year ----
    for year, batch_df in loader.stream():
        logger.info("[%s] ── Processing year %d (%d rows) ──", NODE_ID, year, len(batch_df))

        # 1. Get per-row model errors (for ADWIN)
        model_errors = retrainer.predict_errors(batch_df)

        # 2. Primary feature for PSI — use first feature column
        feat_cols = [c for c in batch_df.columns if c not in (TARGET_COL, "IYEAR")]
        primary_feat = feat_cols[0] if feat_cols else None

        # 3. Drift check
        drift = sentinel.check_batch(
            batch_df,
            feature_col=primary_feat or feat_cols[0] if feat_cols else "feat_0",
            model_errors=model_errors,
        )

        _prom_set(G_DRIFT_SCORE, sentinel.last_drift_score, NODE_ID)

        # 4. Process any incoming ΔW packages first (apply regardless of own drift)
        pending = mqtt.get_pending_deltas()
        for pkg in pending:
            sender = pkg.get("node_id", "?")
            t0 = time.time()
            ok, updated_model = codec.verify_and_apply(pkg, retrainer.model)
            lat = time.time() - t0

            if ok and updated_model is not None and updated_model is not retrainer.model:
                # Genuine successful apply: new model object returned
                retrainer._model = updated_model
                retrainer._model_version += 1
                ledger.report_version(pkg.get("epoch", "?"), retrainer.model_version)
                _prom_set(G_APPLY_LAT, lat, NODE_ID)
                _prom_set(G_MODEL_VER, retrainer.model_version, NODE_ID)
                logger.info(
                    "[%s] Applied ΔW from %s in %.3fs (model v%d)",
                    NODE_ID, sender, lat, retrainer.model_version,
                )
            elif not ok:
                # Hard rejection (schema mismatch, bad signature, etc.)
                logger.error(
                    "[%s] ΔW from %s REJECTED (epoch=%s) — model NOT updated. "
                    "Check for CSV schema mismatch between nodes.",
                    NODE_ID, sender, pkg.get("epoch", "?"),
                )


        # 5. If drift detected → attempt to claim the epoch lease
        if drift:
            epoch_id = f"{BOOT_ID}-{NODE_ID}-{year}-{epoch_counter:04d}"
            epoch_counter += 1
            logger.warning("[%s] DRIFT at year %d → claiming epoch %s", NODE_ID, year, epoch_id)

            granted, winner = ledger.claim_epoch(epoch_id)

            if granted:
                # ---- WE WON: retrain ----
                logger.info("[%s] Lease GRANTED for %s → retraining", NODE_ID, epoch_id)
                model, metrics = retrainer.fit_or_update(batch_df, warm_start=True)

                # log to MLflow
                _log_retrain(epoch_id, metrics, retrainer.model_version)
                _prom_inc(G_RETRAIN_COUNT, NODE_ID)
                _prom_set(G_MODEL_VER, retrainer.model_version, NODE_ID)

                # encode ΔW
                try:
                    package = codec.encode(model, epoch_id)
                    pkg_bytes = len(json.dumps(package))
                    _prom_set(G_DELTA_SIZE, pkg_bytes, NODE_ID)

                    # publish to swarm
                    mqtt.publish_delta(epoch_id, package)
                    logger.info("[%s] ΔW published (%d bytes)", NODE_ID, pkg_bytes)
                except Exception as exc:
                    logger.error("[%s] ΔW encode/publish failed: %s", NODE_ID, exc)

            else:
                logger.info(
                    "[%s] Lease DENIED (winner=%s) for %s → waiting for ΔW",
                    NODE_ID, winner, epoch_id,
                )
                # The winner's ΔW will arrive via MQTT and be applied on the next iteration

        # 6. Sleep between batches
        time.sleep(BATCH_SLEEP_S)

    logger.info("[%s] All years processed — simulation complete.", NODE_ID)

    # ------------------------------------------------------------------
    # Graceful metrics hold
    # ------------------------------------------------------------------
    # After the loop exits the process would restart (unless-stopped) and
    # wipe all in-memory prometheus_client state, leaving Prometheus with
    # only zeroed counters for the final scrape.  We hold the /metrics
    # endpoint alive for HOLD_S seconds so Prometheus gets several more
    # scrapes of the final non-zero values before we exit.
    # ------------------------------------------------------------------
    HOLD_S = 45  # > 4 × 10-second scrape interval — intentionally generous
    if PROM_AVAILABLE:
        logger.info(
            "[%s] Holding /metrics endpoint alive for %ds "
            "(Prometheus scrape capture window) …",
            NODE_ID, HOLD_S,
        )
        time.sleep(HOLD_S)

    logger.info("[%s] Hold complete — exiting.", NODE_ID)


# ==================================================================
if __name__ == "__main__":
    run()
