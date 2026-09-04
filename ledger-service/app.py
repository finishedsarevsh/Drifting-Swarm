"""
app.py — ledger-service
FastAPI microservice implementing atomic compare-and-swap lease grants
for DTASS drift epochs.

Endpoints
---------
POST /claim                      → attempt to acquire retrain lease
GET  /version/{node_id}          → query node's current model version
PATCH /version/{node_id}         → update node's model version after applying ΔW
GET  /health                     → liveness check
GET  /epochs                     → list all epoch records (for debugging)

Storage: SQLite via aiosqlite (single file, no external dependencies).
In Phase 2 this is replaced by DynamoDB conditional writes with the same
HTTP contract — no node code changes required.
"""

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

import aiosqlite
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger("ledger")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

DB_PATH = os.environ.get("DB_PATH", "/data/ledger.db")


# ==================================================================
# Database setup
# ==================================================================

async def init_db(db: aiosqlite.Connection):
    await db.execute("""
        CREATE TABLE IF NOT EXISTS epochs (
            epoch_id   TEXT PRIMARY KEY,
            winner     TEXT NOT NULL,
            granted_at REAL NOT NULL
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS node_versions (
            node_id    TEXT PRIMARY KEY,
            version    INTEGER NOT NULL DEFAULT 0,
            last_epoch TEXT,
            updated_at REAL NOT NULL
        )
    """)
    await db.commit()
    logger.info("Database initialised at %s", DB_PATH)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    os.makedirs(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else ".", exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        app.state.db = db
        await init_db(db)
        yield


# ==================================================================
# FastAPI app
# ==================================================================

app = FastAPI(
    title="DTASS Ledger Service",
    description="Atomic compare-and-swap lease grants for DTASS drift epochs (Phase 1)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================================
# Pydantic models
# ==================================================================

class ClaimRequest(BaseModel):
    epoch_id: str
    node_id: str


class ClaimResponse(BaseModel):
    granted: bool
    winner: str
    epoch_id: str


class VersionResponse(BaseModel):
    node_id: str
    version: int
    last_epoch: Optional[str]
    updated_at: float


class VersionUpdateRequest(BaseModel):
    epoch_id: str
    version: int


# ==================================================================
# Helpers
# ==================================================================

async def get_db(request: Request) -> aiosqlite.Connection:
    return request.app.state.db


# ==================================================================
# Endpoints
# ==================================================================

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ledger-service", "timestamp": time.time()}


@app.post("/claim", response_model=ClaimResponse)
async def claim_epoch(body: ClaimRequest, request: Request):
    """
    Atomic compare-and-swap: the first node to POST /claim for a given
    epoch_id wins the retrain lease.  All subsequent claims for the same
    epoch return HTTP 409 with the winner's node_id.

    This is the entire conflict-resolution mechanism — a SQLite UNIQUE
    constraint on epoch_id does the work; no additional locking needed.
    """
    db: aiosqlite.Connection = await get_db(request)

    try:
        await db.execute(
            "INSERT INTO epochs (epoch_id, winner, granted_at) VALUES (?, ?, ?)",
            (body.epoch_id, body.node_id, time.time()),
        )
        await db.commit()
        logger.info("CLAIM GRANTED  epoch=%s winner=%s", body.epoch_id, body.node_id)
        return ClaimResponse(granted=True, winner=body.node_id, epoch_id=body.epoch_id)

    except aiosqlite.IntegrityError:
        # Already exists → find the winner
        async with db.execute(
            "SELECT winner FROM epochs WHERE epoch_id = ?", (body.epoch_id,)
        ) as cursor:
            row = await cursor.fetchone()
        winner = row[0] if row else "unknown"
        logger.info("CLAIM DENIED   epoch=%s winner=%s (requester=%s)", body.epoch_id, winner, body.node_id)
        raise HTTPException(status_code=409, detail={"granted": False, "winner": winner, "epoch_id": body.epoch_id})


@app.get("/version/{node_id}", response_model=VersionResponse)
async def get_version(node_id: str, request: Request):
    """Return the current model version record for `node_id`."""
    db: aiosqlite.Connection = await get_db(request)
    async with db.execute(
        "SELECT node_id, version, last_epoch, updated_at FROM node_versions WHERE node_id = ?",
        (node_id,),
    ) as cursor:
        row = await cursor.fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail=f"No version record for node {node_id}")

    return VersionResponse(
        node_id=row[0], version=row[1], last_epoch=row[2], updated_at=row[3]
    )


@app.patch("/version/{node_id}", response_model=VersionResponse)
async def update_version(node_id: str, body: VersionUpdateRequest, request: Request):
    """Upsert the model version for `node_id` (called after retrain or ΔW apply)."""
    db: aiosqlite.Connection = await get_db(request)
    now = time.time()
    await db.execute(
        """
        INSERT INTO node_versions (node_id, version, last_epoch, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(node_id) DO UPDATE SET
            version    = excluded.version,
            last_epoch = excluded.last_epoch,
            updated_at = excluded.updated_at
        """,
        (node_id, body.version, body.epoch_id, now),
    )
    await db.commit()
    logger.info("VERSION UPDATE node=%s version=%d epoch=%s", node_id, body.version, body.epoch_id)
    return VersionResponse(node_id=node_id, version=body.version, last_epoch=body.epoch_id, updated_at=now)


@app.get("/epochs")
async def list_epochs(request: Request, limit: int = 50):
    """List recent epoch records (for debugging and dashboard)."""
    db: aiosqlite.Connection = await get_db(request)
    async with db.execute(
        "SELECT epoch_id, winner, granted_at FROM epochs ORDER BY granted_at DESC LIMIT ?",
        (limit,),
    ) as cursor:
        rows = await cursor.fetchall()
    return [{"epoch_id": r[0], "winner": r[1], "granted_at": r[2]} for r in rows]


@app.get("/versions")
async def list_versions(request: Request):
    """List all node version records."""
    db: aiosqlite.Connection = await get_db(request)
    async with db.execute(
        "SELECT node_id, version, last_epoch, updated_at FROM node_versions ORDER BY node_id"
    ) as cursor:
        rows = await cursor.fetchall()
    return [{"node_id": r[0], "version": r[1], "last_epoch": r[2], "updated_at": r[3]} for r in rows]
