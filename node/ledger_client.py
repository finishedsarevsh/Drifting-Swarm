"""
ledger_client.py
HTTP client wrapper for POST /claim and GET /version/{node_id}.

Communicates with the ledger-service FastAPI microservice which enforces
atomic compare-and-swap lease grants per drift epoch.
"""

import logging
import time
from typing import Dict, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

CLAIM_TIMEOUT_S = 10
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_S = 1.0


class LedgerClient:
    """
    Thin HTTP client for the ledger-service.

    Parameters
    ----------
    ledger_url : str
        Base URL of ledger-service, e.g. "http://ledger-service:8000"
    node_id    : str
        This node's identifier (e.g. "CA", "NY")
    """

    def __init__(self, ledger_url: str, node_id: str):
        self.ledger_url = ledger_url.rstrip("/")
        self.node_id = node_id
        self._session = requests.Session()

    # ------------------------------------------------------------------
    def claim_epoch(self, epoch_id: str) -> Tuple[bool, Optional[str]]:
        """
        POST /claim to attempt to acquire the retrain lease for this drift epoch.

        Returns
        -------
        (granted, winner_node_id)
            granted        : True if this node won the lease
            winner_node_id : which node was granted (could be self or another)
        """
        url = f"{self.ledger_url}/claim"
        payload = {"epoch_id": epoch_id, "node_id": self.node_id}

        for attempt in range(1, RETRY_ATTEMPTS + 1):
            try:
                resp = self._session.post(url, json=payload, timeout=CLAIM_TIMEOUT_S)
                if resp.status_code == 200:
                    data = resp.json()
                    granted = data.get("granted", False)
                    winner = data.get("winner", self.node_id)
                    logger.info(
                        "[%s] /claim epoch=%s → granted=%s winner=%s",
                        self.node_id, epoch_id, granted, winner,
                    )
                    return granted, winner
                elif resp.status_code == 409:
                    data = resp.json()
                    winner = data.get("winner", "unknown")
                    logger.info(
                        "[%s] /claim epoch=%s → DENIED (winner=%s)",
                        self.node_id, epoch_id, winner,
                    )
                    return False, winner
                else:
                    logger.warning(
                        "[%s] /claim unexpected status %d: %s",
                        self.node_id, resp.status_code, resp.text[:200],
                    )
            except requests.exceptions.RequestException as exc:
                logger.warning(
                    "[%s] /claim attempt %d/%d failed: %s",
                    self.node_id, attempt, RETRY_ATTEMPTS, exc,
                )
                if attempt < RETRY_ATTEMPTS:
                    time.sleep(RETRY_BACKOFF_S * attempt)

        logger.error("[%s] /claim failed after %d attempts", self.node_id, RETRY_ATTEMPTS)
        return False, None

    # ------------------------------------------------------------------
    def get_version(self, node_id: Optional[str] = None) -> Optional[Dict]:
        """
        GET /version/{node_id} — query the current model version for a node.

        Parameters
        ----------
        node_id : str, optional
            Defaults to this node's own ID.

        Returns
        -------
        dict with {"node_id", "version", "last_epoch", "updated_at"} or None on error.
        """
        target = node_id or self.node_id
        url = f"{self.ledger_url}/version/{target}"
        try:
            resp = self._session.get(url, timeout=CLAIM_TIMEOUT_S)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 404:
                return None
            else:
                logger.warning("[%s] GET /version/%s → %d", self.node_id, target, resp.status_code)
                return None
        except requests.exceptions.RequestException as exc:
            logger.warning("[%s] GET /version/%s failed: %s", self.node_id, target, exc)
            return None

    # ------------------------------------------------------------------
    def report_version(self, epoch_id: str, model_version: int) -> bool:
        """
        PATCH /version/{node_id} to record this node's updated model version.
        Called by a non-winner node after successfully applying a ΔW.
        """
        url = f"{self.ledger_url}/version/{self.node_id}"
        payload = {"epoch_id": epoch_id, "version": model_version}
        try:
            resp = self._session.patch(url, json=payload, timeout=CLAIM_TIMEOUT_S)
            return resp.status_code in (200, 204)
        except requests.exceptions.RequestException as exc:
            logger.warning("[%s] PATCH /version failed: %s", self.node_id, exc)
            return False
