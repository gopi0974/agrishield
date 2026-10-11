from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from backend.data_pipeline import CLEANED_PATH, DATA_DIRECTORY, FEATURES, REPORT_PATH, TARGET, clean_dataset

ARTIFACT_DIRECTORY = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACT_DIRECTORY / "crop_recommendation.joblib"
METRICS_PATH = ARTIFACT_DIRECTORY / "crop_recommendation_metrics.json"


def train_model() -> dict:
    frame, report = clean_dataset()
    if frame[TARGET].value_counts().min() < 2:
        raise ValueError("Each crop class needs at least two rows for a stratified train/test split.")

    features = frame[FEATURES]
    target = frame[TARGET]
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=42,
        stratify=target,
    )

    pipeline = Pipeline([
        ("classifier", RandomForestClassifier(
            n_estimators=300,
            random_state=42,
            n_jobs=-1,
        )),
    ])
    pipeline.fit(x_train, y_train)
    predictions = pipeline.predict(x_test)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test,
        predictions,
        average="macro",
        zero_division=0,
    )
    labels = sorted(target.unique().tolist())
    metrics = {
        "model": "RandomForestClassifier",
        "evaluation": "Stratified 80/20 holdout split; random_state=42.",
        "training_rows": len(x_train),
        "test_rows": len(x_test),
        "class_count": len(labels),
        "features": FEATURES,
        "target": TARGET,
        "accuracy": float(accuracy_score(y_test, predictions)),
        "precision_macro": float(precision),
        "recall_macro": float(recall),
        "f1_macro": float(f1),
        "confusion_matrix_labels": labels,
        "confusion_matrix": confusion_matrix(y_test, predictions, labels=labels).tolist(),
        "source_provenance": report["source_provenance"],
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
    }

    ARTIFACT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "pipeline": pipeline,
        "features": FEATURES,
        "classes": labels,
        "source_file": report["source_file"],
    }, MODEL_PATH)
    digest = hashlib.sha256(CLEANED_PATH.read_bytes()).hexdigest()
    metrics["cleaned_dataset_sha256"] = digest
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))
    return metrics


if __name__ == "__main__":
    train_model()
