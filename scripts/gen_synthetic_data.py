"""
gen_synthetic_data.py
Generates synthetic BRFSS-shaped CSV files for all 6 nodes so the
pipeline can be fully tested without the real BRFSS dataset.

Run:
    python scripts/gen_synthetic_data.py

Output:
    data/CA/brfss_synthetic.csv
    data/TX/brfss_synthetic.csv
    ... (one file per node)
"""

import numpy as np
import pandas as pd
from pathlib import Path

NODES = {
    "CA": 1200,   # large state
    "TX": 1100,   # large state
    "OH": 700,    # mid-size
    "WY": 150,    # small / territory-scale - low-data edge case
    "NY": 800,    # concurrent-drift pair A
    "NJ": 750,    # concurrent-drift pair B
}

YEARS = list(range(1999, 2025))   # 1999-2024, 26 survey years
N_FEATURES = 20
DRIFT_YEAR = 2015   # distribution shift after this year
DRIFT_NODES = {"NY", "NJ"}   # these two drift simultaneously in 2020
DRIFT_YEAR_CONCURRENT = 2020

DATA_DIR = Path(__file__).parent.parent / "data"


def make_batch(node: str, year: int, n_rows: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed=hash(f"{node}{year}") % (2**32))

    X = rng.normal(loc=0.0, scale=1.0, size=(n_rows, N_FEATURES)).astype(np.float32)

    # Global drift after 2015: shift first 5 features
    if year > DRIFT_YEAR:
        X[:, :5] += 1.5

    # Concurrent drift for NY/NJ exactly at 2020 (larger shift)
    if node in DRIFT_NODES and year >= DRIFT_YEAR_CONCURRENT:
        X[:, 5:10] += 2.0

    # Logistic target
    logit = (
        0.8 * X[:, 0]
        - 0.5 * X[:, 1]
        + 0.3 * X[:, 2]
        - 0.2 * X[:, 3]
    )
    prob = 1 / (1 + np.exp(-logit))
    y = (rng.random(n_rows) < prob).astype(int)

    df = pd.DataFrame(X, columns=[f"feat_{i:02d}" for i in range(N_FEATURES)])
    df["TARGET"] = y
    df["IYEAR"] = year
    return df


def main():
    for node, n_rows_per_year in NODES.items():
        out_dir = DATA_DIR / node
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "brfss_synthetic.csv"

        batches = []
        for year in YEARS:
            # WY gets fewer rows per year to simulate small-state edge case
            rows = max(30, n_rows_per_year + np.random.randint(-50, 50))
            batches.append(make_batch(node, year, rows))

        df = pd.concat(batches, ignore_index=True)
        df.to_csv(out_path, index=False)
        print(f"[{node}] {len(df):,} rows -> {out_path}")

    print("\nDone. Synthetic BRFSS data generated for all 6 nodes.")


if __name__ == "__main__":
    main()
