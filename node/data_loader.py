"""
data_loader.py
Streams the local BRFSS CSV file in chronological order, yielding one
year-batch at a time.  Falls back to a synthetic generator when no real
CSV is present (useful for local dev / CI without the full dataset).

Real-data CSV schema (produced by scripts/download_real_brfss.R)
-----------------------------------------------------------------
Required columns:
  IYEAR   : integer survey year (1999-2024)
  TARGET  : binary (1=diabetes, 0=no diabetes)

Feature columns (all numeric, NA-padded for missing years):
  feat_bp       : high blood pressure flag (_RFHYPE6 / _RFHYPE5)
  feat_chol     : cholesterol check recency (_CHOLCHK3 / _CHOLCHK1)
  feat_bmi      : BMI × 100 (_BMI5)
  feat_inactive : no leisure-time physical activity (_TOTINDA)
  feat_alcohol  : average weekly drinks (_DRNKWK2)
  feat_age      : age category (_AGEG5YR)
  feat_genhlth  : general health (GENHLTH)
  feat_physhlth : days physical health not good (PHYSHLTH)
  feat_menthlth : days mental health not good (MENTHLTH)
  feat_coverage : health care coverage (HLTHPLN1)
  feat_medcost  : could not see doctor due to cost (MEDCOST1/MEDCOST)
  feat_checkup  : time since last checkup (CHECKUP1)
  feat_smoke    : smoked ≥100 cigarettes (SMOKE100)
  feat_sex      : sex of respondent (SEX1/SEXVAR)
  feat_educa    : education level (EDUCA)
  feat_income   : household income (INCOME3/INCOME2)

Synthetic-data CSV schema (produced by scripts/gen_synthetic_data.py)
----------------------------------------------------------------------
  IYEAR, TARGET, feat_00 … feat_19 (20 generic numeric features)

Both schemas are handled transparently — any column that is not IYEAR
or TARGET is treated as a feature.
"""

import os
import logging
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Iterator, Tuple

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Column contract expected by the rest of the pipeline
# ------------------------------------------------------------------
# The BRFSS CSV must contain at least:
#   IYEAR  (or YEAR / year) : integer survey year
#   TARGET                   : binary outcome (0/1)
#   ...feature cols (anything else)...

YEAR_COL = "IYEAR"
TARGET_COL = "TARGET"
SYNTHETIC_FEATURES = 20
SYNTHETIC_YEAR_START = 1999
SYNTHETIC_YEAR_END = 2024


def _synthetic_batch(
    year: int,
    node_id: str,
    n_rows: int = 500,
    drift_after: int = 2015,
) -> pd.DataFrame:
    """
    Generate a fake BRFSS-shaped batch.
    After `drift_after` the feature distribution shifts to simulate concept drift.
    """
    rng = np.random.default_rng(seed=hash(f"{node_id}{year}") % (2**32))
    X = rng.normal(size=(n_rows, SYNTHETIC_FEATURES)).astype(np.float32)

    if year > drift_after:
        # shift mean of first 5 features to simulate drift
        X[:, :5] += 1.5

    # simple logistic-ish target
    logit = X[:, 0] - 0.5 * X[:, 1] + 0.3 * X[:, 2]
    prob = 1 / (1 + np.exp(-logit))
    y = (rng.random(n_rows) < prob).astype(int)

    df = pd.DataFrame(X, columns=[f"feat_{i}" for i in range(SYNTHETIC_FEATURES)])
    df[TARGET_COL] = y
    df[YEAR_COL] = year
    return df


class BRFSSDataLoader:
    """
    Iterates through BRFSS data one survey-year at a time.
    If no CSV is found it falls back to synthetic data so the pipeline
    can be validated without the full 300 MB dataset.
    """

    def __init__(self, data_dir: str, node_id: str):
        self.node_id = node_id
        self.data_dir = Path(data_dir)
        csv_candidates = list(self.data_dir.glob("*.csv"))
        self.csv_path = csv_candidates[0] if csv_candidates else None

        if self.csv_path:
            logger.info("[%s] Loading real CSV: %s", node_id, self.csv_path)
            self._df = pd.read_csv(self.csv_path, low_memory=False)
            # ── normalise year column name ──────────────────────────────
            # Accepts: IYEAR (R script output), YEAR, year (brfssdata raw)
            if YEAR_COL not in self._df.columns:
                for alt in ("YEAR", "year", "iyear"):
                    if alt in self._df.columns:
                        self._df.rename(columns={alt: YEAR_COL}, inplace=True)
                        break
            if YEAR_COL not in self._df.columns:
                raise ValueError(
                    f"[{node_id}] CSV at {self.csv_path} has no IYEAR/YEAR/year column. "
                    "Re-run scripts/download_real_brfss.R to regenerate."
                )
            self._df[YEAR_COL] = self._df[YEAR_COL].astype(int)
            # ── drop rows with missing TARGET ───────────────────────────
            before = len(self._df)
            self._df = self._df.dropna(subset=[TARGET_COL])
            self._df[TARGET_COL] = self._df[TARGET_COL].astype(int)
            dropped = before - len(self._df)
            if dropped:
                logger.info("[%s] Dropped %d rows with missing TARGET", node_id, dropped)
            self._years = sorted(self._df[YEAR_COL].unique().tolist())
            feat_cols = [c for c in self._df.columns if c not in (YEAR_COL, TARGET_COL)]
            logger.info(
                "[%s] Real BRFSS data loaded: %d rows, %d years, %d feature columns",
                node_id, len(self._df), len(self._years), len(feat_cols),
            )
        else:
            logger.warning(
                "[%s] No CSV found in %s — using synthetic data", node_id, data_dir
            )
            self._df = None
            self._years = list(range(SYNTHETIC_YEAR_START, SYNTHETIC_YEAR_END + 1))

    # ------------------------------------------------------------------
    def years(self) -> list:
        return list(self._years)

    def get_batch(self, year: int) -> pd.DataFrame:
        """Return the dataframe slice for a single survey year."""
        if self._df is not None:
            batch = self._df[self._df[YEAR_COL] == year].copy()
            if batch.empty:
                logger.warning("[%s] No rows for year %d", self.node_id, year)
            return batch
        else:
            return _synthetic_batch(year, self.node_id)

    def stream(self) -> Iterator[Tuple[int, pd.DataFrame]]:
        """Yield (year, dataframe) pairs in chronological order."""
        for year in self._years:
            df = self.get_batch(year)
            if not df.empty:
                logger.debug("[%s] Streaming year %d (%d rows)", self.node_id, year, len(df))
                yield year, df

    def feature_names(self, sample_df: pd.DataFrame) -> list:
        """Return the list of feature column names (everything except year + target)."""
        return [c for c in sample_df.columns if c not in (YEAR_COL, TARGET_COL)]
