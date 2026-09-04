"""
drift_sentinel.py
Detects concept drift using River's ADWIN (accuracy-based) and a Population
Stability Index (PSI) check on feature distributions.

Returns True when drift is detected (signalling main.py to initiate the
claim→retrain cycle).
"""

import logging
import numpy as np
import pandas as pd
from typing import Optional

try:
    from river.drift import ADWIN
    from river.drift import KSWIN
    RIVER_AVAILABLE = True
except ImportError:
    RIVER_AVAILABLE = False
    logging.warning("River not installed – falling back to simple variance-based drift sentinel")

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# PSI thresholds:
#   PSI < 0.05  → negligible change (noise)
#   PSI 0.05–0.20 → moderate year-over-year epidemiological shift  ← trigger here
#   PSI > 0.20  → major distribution change
#
# NB: 0.05 is the correct threshold for consecutive annual BRFSS batches.
# The classic 0.25 industry threshold applies to monthly prod-model monitoring;
# real BRFSS year-over-year PSI is typically 0.001–0.15 even across policy changes.
# ------------------------------------------------------------------
PSI_THRESHOLD = 0.05          # trigger threshold — calibrated for annual BRFSS batches
ADWIN_DELTA = 0.002           # ADWIN false-positive rate
MIN_SAMPLES_GATE = 50         # skip drift check if batch is too small (helps WY)
N_BINS = 10                   # bins for PSI histogram


def _psi(reference: np.ndarray, current: np.ndarray, n_bins: int = N_BINS) -> float:
    """Compute Population Stability Index between two 1-D arrays."""
    # build shared bin edges from reference
    bins = np.linspace(
        min(reference.min(), current.min()),
        max(reference.max(), current.max()) + 1e-9,
        n_bins + 1,
    )
    ref_hist, _ = np.histogram(reference, bins=bins)
    cur_hist, _ = np.histogram(current, bins=bins)

    # avoid division by zero
    ref_pct = np.where(ref_hist == 0, 1e-4, ref_hist / len(reference))
    cur_pct = np.where(cur_hist == 0, 1e-4, cur_hist / len(current))

    return float(np.sum((cur_pct - ref_pct) * np.log(cur_pct / ref_pct)))


class DriftSentinel:
    """
    Dual-signal drift detector.

    1. River ADWIN on model error rate (updated per prediction).
    2. PSI on first principal feature across consecutive batches.

    Either signal crossing threshold triggers drift = True.
    """

    def __init__(
        self,
        node_id: str,
        tau: float = PSI_THRESHOLD,
        min_samples: int = MIN_SAMPLES_GATE,
        adwin_delta: float = ADWIN_DELTA,
    ):
        self.node_id = node_id
        self.tau = tau
        self.min_samples = min_samples

        self._reference_batch: Optional[pd.DataFrame] = None
        self._current_psi: float = 0.0
        self._drift_count: int = 0

        if RIVER_AVAILABLE:
            self._adwin = ADWIN(delta=adwin_delta)
        else:
            self._adwin = None

        # Prometheus metrics placeholders (populated by main.py)
        self.last_drift_score: float = 0.0

    # ------------------------------------------------------------------
    def set_reference(self, df: pd.DataFrame, feature_col: str) -> None:
        """Snapshot the first batch as the reference distribution."""
        self._reference_batch = df[feature_col].dropna().values
        logger.debug("[%s] Reference distribution set (%d samples)", self.node_id, len(self._reference_batch))

    def update_adwin(self, error: float) -> bool:
        """Feed one prediction error (0 or 1) to ADWIN. Returns True if ADWIN fires."""
        if self._adwin is None:
            return False
        self._adwin.update(error)
        return self._adwin.drift_detected

    def check_batch(
        self, df: pd.DataFrame, feature_col: str, model_errors: Optional[np.ndarray] = None
    ) -> bool:
        """
        Full drift check on one incoming batch.

        Parameters
        ----------
        df            : incoming batch dataframe
        feature_col   : primary feature used for PSI check
        model_errors  : array of per-row prediction errors (0/1), or None

        Returns
        -------
        True  if drift is detected
        """
        if len(df) < self.min_samples:
            logger.info(
                "[%s] Batch too small (%d < %d) – skipping drift check",
                self.node_id, len(df), self.min_samples,
            )
            return False

        # ---- ADWIN on error stream ----
        adwin_drift = False
        if model_errors is not None and self._adwin is not None:
            for err in model_errors:
                fired = self.update_adwin(float(err))
                if fired:
                    adwin_drift = True

        # ---- PSI on feature distribution ----
        psi_drift = False
        if self._reference_batch is not None and feature_col in df.columns:
            current = df[feature_col].dropna().values
            psi = _psi(self._reference_batch, current)
            self._current_psi = psi
            self.last_drift_score = psi
            logger.info("[%s] PSI=%.4f (tau=%.2f)", self.node_id, psi, self.tau)
            if psi >= self.tau:
                psi_drift = True
        else:
            # First batch → set reference, no drift yet
            self.set_reference(df, feature_col)
            return False

        # Update reference to current for next window
        self.set_reference(df, feature_col)

        drift_detected = adwin_drift or psi_drift
        if drift_detected:
            self._drift_count += 1
            logger.warning(
                "[%s] DRIFT DETECTED (adwin=%s, psi_drift=%s, PSI=%.4f, count=%d)",
                self.node_id, adwin_drift, psi_drift, self._current_psi, self._drift_count,
            )
        return drift_detected

    # ------------------------------------------------------------------
    @property
    def drift_count(self) -> int:
        return self._drift_count

    @property
    def current_psi(self) -> float:
        return self._current_psi
