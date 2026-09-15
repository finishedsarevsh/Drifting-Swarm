"""
delta_retrain.py
Warm-start fine-tunes the node's LightGBM model on ΔD (data since last sync).

Responsibilities
----------------
1. Accept a base model (or None for cold-start) and a new data batch.
2. Train / continue-train a LightGBM binary classifier.
3. Evaluate on a held-out validation slice and return (new_model, metrics).
"""

import logging
import numpy as np
import pandas as pd
from typing import Optional, Tuple, Dict, Any

try:
    import lightgbm as lgb
    LGB_AVAILABLE = True
except ImportError:
    LGB_AVAILABLE = False

from data_loader import TARGET_COL, YEAR_COL

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# LightGBM hyperparameters — size-constrained for Phase 1
# ------------------------------------------------------------------
# Design constraints:
#   • Pickled model must stay < 5 MB (so ΔW codec output < ~1 MB)
#   • Node containers have ~512 MB RAM — model must never OOM
#   • Warm-start tree growth is capped at MAX_TOTAL_TREES
# ------------------------------------------------------------------
LGB_PARAMS: Dict[str, Any] = {
    "objective": "binary",
    "metric": "binary_logloss",
    "learning_rate": 0.05,
    "n_estimators": 50,           # trees added per delta-retrain step
    "max_depth": 6,               # hard cap on tree depth (default: -1 = unlimited)
    "num_leaves": 31,             # must be <= 2^max_depth (2^6 = 64, so 31 is fine)
    "max_bin": 63,                # down from default 255 — cuts histogram memory 4x
    "min_child_samples": 50,      # prevents micro-splits on tiny partitions
    "verbose": -1,
    "n_jobs": 1,                  # single-threaded — predictable memory, no thread OOM
    "random_state": 42,
}
# Absolute ceiling on accumulated trees across all warm-start rounds.
# 200 trees × depth-6 × 31 leaves × 15 features ≈ 2-4 MB pickled.
MAX_TOTAL_TREES = 200
VALIDATION_FRACTION = 0.20
MIN_TRAIN_ROWS = 30


# ------------------------------------------------------------------
# Fallback: dummy model when LightGBM is unavailable
# ------------------------------------------------------------------
class _DummyModel:
    """Placeholder model that always predicts 0.5 probability."""

    def predict(self, X):  # noqa: D102
        return np.full(len(X), 0.5)

    def predict_proba(self, X):
        p = self.predict(X)
        return np.column_stack([1 - p, p])


def _feature_cols(df: pd.DataFrame) -> list:
    return [c for c in df.columns if c not in (TARGET_COL, YEAR_COL)]


class DeltaRetrain:
    """
    Manages the node's LightGBM model lifecycle.

    Parameters
    ----------
    node_id : str
        Used only for logging.
    """

    def __init__(self, node_id: str):
        self.node_id = node_id
        self._model: Optional[Any] = None   # lgb.LGBMClassifier or _DummyModel
        self._model_version: int = 0

    # ------------------------------------------------------------------
    @property
    def model(self):
        return self._model

    @property
    def model_version(self) -> int:
        return self._model_version

    # ------------------------------------------------------------------
    def fit_or_update(
        self,
        delta_df: pd.DataFrame,
        warm_start: bool = True,
    ) -> Tuple[Any, Dict[str, float]]:
        """
        Train (or warm-start update) the model on `delta_df`.

        Returns
        -------
        model   : trained model object
        metrics : dict with at least {"val_accuracy": float, "val_logloss": float,
                                       "n_train": int, "n_val": int}
        """
        if len(delta_df) < MIN_TRAIN_ROWS:
            logger.warning(
                "[%s] Too few rows to retrain (%d). Skipping.", self.node_id, len(delta_df)
            )
            return self._model or _DummyModel(), {"val_accuracy": 0.0, "val_logloss": 99.9,
                                                   "n_train": 0, "n_val": 0}

        # ---- split train/val ----
        val_n = max(1, int(len(delta_df) * VALIDATION_FRACTION))
        val_df = delta_df.iloc[-val_n:]
        train_df = delta_df.iloc[:-val_n]

        feat_cols = _feature_cols(train_df)

        X_train = train_df[feat_cols].values.astype(np.float32)
        y_train = train_df[TARGET_COL].values
        X_val = val_df[feat_cols].values.astype(np.float32)
        y_val = val_df[TARGET_COL].values

        metrics: Dict[str, float] = {
            "n_train": int(len(X_train)),
            "n_val": int(len(X_val)),
        }

        if not LGB_AVAILABLE:
            logger.warning("[%s] LightGBM not installed – using dummy model", self.node_id)
            self._model = _DummyModel()
            metrics.update(val_accuracy=0.5, val_logloss=0.693)
            return self._model, metrics

        # ---- LightGBM warm-start ----
        if warm_start and self._model is not None and isinstance(self._model, lgb.LGBMClassifier):
            existing_trees = getattr(self._model, "n_estimators_", LGB_PARAMS["n_estimators"])
            new_total = min(existing_trees + LGB_PARAMS["n_estimators"], MAX_TOTAL_TREES)
            logger.info(
                "[%s] Warm-starting: %d existing trees + %d new = %d total (cap=%d)",
                self.node_id, existing_trees, LGB_PARAMS["n_estimators"],
                new_total, MAX_TOTAL_TREES,
            )
            model = lgb.LGBMClassifier(**LGB_PARAMS)
            model.set_params(n_estimators=new_total)
            model.fit(
                X_train, y_train,
                init_model=self._model.booster_,
                eval_set=[(X_val, y_val)],
                callbacks=[lgb.log_evaluation(period=-1)],
            )
        else:
            logger.info("[%s] Cold-start training (%d rows)", self.node_id, len(X_train))
            model = lgb.LGBMClassifier(**LGB_PARAMS)
            model.fit(
                X_train, y_train,
                eval_set=[(X_val, y_val)],
                callbacks=[lgb.log_evaluation(period=-1)],
            )

        # ---- validation metrics ----
        preds = model.predict(X_val)
        proba = model.predict_proba(X_val)[:, 1]
        acc = float(np.mean(preds == y_val))

        # compute binary logloss manually
        eps = 1e-9
        ll = -float(np.mean(
            y_val * np.log(proba + eps) + (1 - y_val) * np.log(1 - proba + eps)
        ))

        metrics.update(val_accuracy=acc, val_logloss=ll)
        logger.info(
            "[%s] Retrain complete → acc=%.4f logloss=%.4f (train=%d val=%d)",
            self.node_id, acc, ll, len(X_train), len(X_val),
        )

        self._model = model
        self._model_version += 1
        return model, metrics

    # ------------------------------------------------------------------
    def predict_errors(self, df: pd.DataFrame) -> np.ndarray:
        """
        Run current model on df and return per-row binary errors (0=correct, 1=wrong).
        Used to feed the ADWIN detector.
        """
        if self._model is None:
            return np.ones(len(df))  # assume all wrong before first training

        feat_cols = _feature_cols(df)
        X = df[feat_cols].values.astype(np.float32)
        preds = self._model.predict(X) if hasattr(self._model, "predict") else np.zeros(len(X))
        y = df[TARGET_COL].values
        return (preds != y).astype(int)
