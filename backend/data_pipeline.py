from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = PROJECT_ROOT / "Datasets" / "unified_crop_data before crop.csv"
DATA_DIRECTORY = Path(__file__).resolve().parent / "data"
CLEANED_PATH = DATA_DIRECTORY / "crop_recommendation_cleaned.csv"
REPORT_PATH = DATA_DIRECTORY / "cleaning_report.json"

FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
TARGET = "crop"
OPTIONAL_NUMERIC_COLUMNS = ["Avg_Yield_Tons_Per_Hectare", "Avg_Price_per_Quintal"]
VALID_RANGES = {
    "N": (0, 500),
    "P": (0, 500),
    "K": (0, 500),
    "temperature": (-20, 70),
    "humidity": (0, 100),
    "ph": (0, 14),
    "rainfall": (0, 10000),
}


def clean_dataset() -> tuple[pd.DataFrame, dict]:
    if not SOURCE_PATH.is_file():
        raise FileNotFoundError(f"Crop recommendation source dataset was not found: {SOURCE_PATH}")

    original = pd.read_csv(SOURCE_PATH)
    original_rows = len(original)
    original_columns = list(original.columns)
    frame = original.copy()
    frame.columns = [str(column).strip() for column in frame.columns]

    missing_columns = [column for column in [*FEATURES, TARGET] if column not in frame.columns]
    if missing_columns:
        raise ValueError(f"Crop dataset is missing required columns: {', '.join(missing_columns)}")

    missing_before = {
        column: int(frame[column].isna().sum())
        for column in frame.columns
    }
    for column in [*FEATURES, *OPTIONAL_NUMERIC_COLUMNS]:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")

    frame[TARGET] = frame[TARGET].astype("string").str.strip().str.lower()
    invalid_measurement = pd.Series(False, index=frame.index)
    for column, (minimum, maximum) in VALID_RANGES.items():
        values = frame[column]
        invalid_measurement |= values.isna() | (values < minimum) | (values > maximum)
    invalid_measurement |= frame[TARGET].isna() | frame[TARGET].eq("")

    invalid_rows = int(invalid_measurement.sum())
    frame = frame.loc[~invalid_measurement].copy()
    duplicate_rows = int(frame.duplicated(subset=[*FEATURES, TARGET], keep="first").sum())
    frame = frame.drop_duplicates(subset=[*FEATURES, TARGET], keep="first").reset_index(drop=True)

    if frame.empty:
        raise ValueError("No valid crop records remain after cleaning.")

    DATA_DIRECTORY.mkdir(parents=True, exist_ok=True)
    frame.to_csv(CLEANED_PATH, index=False)

    report = {
        "source_file": str(SOURCE_PATH.relative_to(PROJECT_ROOT)),
        "source_provenance": "Not documented in the supplied project; publisher, license, and collection method are unverified.",
        "geographic_coverage": "Not documented in the supplied crop recommendation CSV.",
        "date_range": None,
        "original_rows": original_rows,
        "cleaned_rows": len(frame),
        "invalid_rows_excluded": invalid_rows,
        "duplicate_rows_excluded": duplicate_rows,
        "missing_values_before_cleaning": missing_before,
        "missing_values_after_cleaning": {
            column: int(frame[column].isna().sum())
            for column in frame.columns
        },
        "original_columns": original_columns,
        "cleaned_columns": list(frame.columns),
        "feature_columns": FEATURES,
        "feature_count": len(FEATURES),
        "target_column": TARGET,
        "crop_categories": sorted(frame[TARGET].unique().tolist()),
        "excluded_from_model_features": [
            column for column in OPTIONAL_NUMERIC_COLUMNS if column in frame.columns
        ],
        "transformations": [
            "Trimmed column names and crop labels; lowercased crop labels.",
            "Parsed model features as numeric values.",
            "Excluded rows with missing or out-of-range required measurements.",
            "Removed duplicate rows with identical model features and crop target.",
            "Kept yield and price columns out of the crop classifier to prevent target leakage.",
        ],
        "processed_at_utc": datetime.now(timezone.utc).isoformat(),
        "cleaned_file": str(CLEANED_PATH.relative_to(PROJECT_ROOT)),
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return frame, report


if __name__ == "__main__":
    _, cleaning_report = clean_dataset()
    print(json.dumps(cleaning_report, indent=2))
