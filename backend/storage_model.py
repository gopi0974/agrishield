from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

logger = logging.getLogger("farmshield.storage_model")

ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "Datasets" / "final_combined_cleaned_dataset(STOREORSELL).csv"
ARTIFACT_DIRECTORY = Path(__file__).resolve().parent / "artifacts"
MODEL_PATH = ARTIFACT_DIRECTORY / "storage_store_sell.joblib"
MARKET_CACHE_PATH = ARTIFACT_DIRECTORY / "storage_market_cache.json"

FEATURES = ["Min_Price", "Max_Price", "Modal_Price", "MA_7", "MA_30", "Volatility_7"]
RAW_COLUMNS = [
    "State", "District", "Market", "Arrival_Date", "Min_Price",
    "Max_Price", "Modal_Price", "Crop",
]
TARGET_LOOKAHEAD_RECORDS = 30
STORE_THRESHOLD = 0.10
DATA_GOV_RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070"
CROP_COMMODITY = {
    "Apple": "Apple",
    "Banana": "Banana",
    "Cauliflower": "Cauliflower",
    "Chilli": "Dry Chillies",
    "Garlic": "Garlic",
    "Okra": "Bhindi",
    "Onion": "Onion",
    "Potato": "Potato",
    "Tomato": "Tomato",
    "Cabbage": "Cabbage",
}

storage_bundle: dict[str, Any] | None = None
_historical_rows: pd.DataFrame | None = None


class MarketDataError(RuntimeError):
    pass


def load_storage_model() -> dict[str, Any] | None:
    global storage_bundle
    storage_bundle = None
    if not MODEL_PATH.is_file():
        logger.warning("Storage model is not trained. Run `python -m backend.storage_model`.")
        return None
    storage_bundle = joblib.load(MODEL_PATH)
    return storage_bundle


def _read_historical_rows() -> pd.DataFrame:
    global _historical_rows
    if _historical_rows is None:
        if not DATASET_PATH.is_file():
            raise FileNotFoundError(
                f"Storage training data was not found: {DATASET_PATH}. "
                "Restore the local storage-price CSV before training or predicting."
            )
        frame = pd.read_csv(DATASET_PATH, usecols=RAW_COLUMNS, low_memory=False)
        frame["Arrival_Date"] = pd.to_datetime(frame["Arrival_Date"], errors="coerce")
        for column in ("Min_Price", "Max_Price", "Modal_Price"):
            frame[column] = pd.to_numeric(frame[column], errors="coerce")
        frame["Crop"] = frame["Crop"].astype("string").str.strip().str.title()
        frame = frame.dropna(subset=["Crop", "Arrival_Date", *FEATURES[:3]])
        frame = frame.loc[
            (frame["Min_Price"] > 0)
            & (frame["Max_Price"] >= frame["Min_Price"])
            & (frame["Modal_Price"] > 0)
        ]
        _historical_rows = (
            frame.groupby(
                ["Crop", "State", "District", "Market", "Arrival_Date"],
                as_index=False,
                sort=False,
            )[["Min_Price", "Max_Price", "Modal_Price"]]
            .mean()
            .sort_values(["Crop", "State", "District", "Market", "Arrival_Date"])
            .reset_index(drop=True)
        )
    return _historical_rows


def _add_price_features(frame: pd.DataFrame, groups: list[str]) -> pd.DataFrame:
    result = frame.sort_values([*groups, "Arrival_Date"]).copy()
    rolling = result.groupby(groups, sort=False)["Modal_Price"]
    result["MA_7"] = rolling.transform(lambda values: values.rolling(7, min_periods=1).mean())
    result["MA_30"] = rolling.transform(lambda values: values.rolling(30, min_periods=1).mean())
    result["Volatility_7"] = rolling.transform(
        lambda values: values.rolling(7, min_periods=1).std().fillna(0)
    )
    return result


def train_storage_model() -> dict[str, Any]:
    history = _read_historical_rows()
    groups = ["Crop", "State", "Market"]
    featured = _add_price_features(history, groups)
    featured["Future_Price"] = featured.groupby(groups, sort=False)["Modal_Price"].shift(
        -TARGET_LOOKAHEAD_RECORDS
    )
    featured = featured.dropna(subset=["Future_Price"]).copy()
    featured["Decision"] = (
        featured["Future_Price"] > featured["Modal_Price"] * (1 + STORE_THRESHOLD)
    ).astype("int8")

    models: dict[str, Any] = {}
    metrics: dict[str, Any] = {}
    for crop, rows in featured.groupby("Crop", sort=True):
        rows = rows.sort_values("Arrival_Date")
        if len(rows) < 100 or rows["Decision"].nunique() < 2:
            continue
        cutoff = rows["Arrival_Date"].quantile(0.8)
        training = rows.loc[rows["Arrival_Date"] < cutoff]
        testing = rows.loc[rows["Arrival_Date"] >= cutoff]
        if training["Decision"].nunique() < 2 or testing.empty:
            continue

        model = RandomForestClassifier(
            n_estimators=60,
            min_samples_leaf=10,
            max_leaf_nodes=31,
            class_weight="balanced_subsample",
            random_state=42,
            n_jobs=-1,
        )
        model.fit(training[FEATURES], training["Decision"])
        score = float(accuracy_score(testing["Decision"], model.predict(testing[FEATURES])))
        models[str(crop)] = model
        metrics[str(crop)] = {
            "training_rows": int(len(training)),
            "test_rows": int(len(testing)),
            "accuracy": score,
            "first_test_date": testing["Arrival_Date"].min().date().isoformat(),
            "last_test_date": testing["Arrival_Date"].max().date().isoformat(),
        }

    if not models:
        raise ValueError("The storage dataset did not produce enough examples for both decisions.")

    artifact = {
        "models": models,
        "features": FEATURES,
        "classes": {"0": "Sell", "1": "Store"},
        "training_source": DATASET_PATH.name,
        "target_definition": (
            f"Store when the price is more than {STORE_THRESHOLD:.0%} higher "
            f"after {TARGET_LOOKAHEAD_RECORDS} subsequent market records."
        ),
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "training_date_range": {
            "start": history["Arrival_Date"].min().date().isoformat(),
            "end": history["Arrival_Date"].max().date().isoformat(),
        },
        "metrics": metrics,
    }
    ARTIFACT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)
    global storage_bundle
    storage_bundle = artifact
    return artifact


def storage_model_status() -> dict[str, Any]:
    bundle = storage_bundle
    return {
        "available": bundle is not None,
        "supported_crops": sorted((bundle or {}).get("models", {})),
        "online_market_feed_configured": bool(os.getenv("DATA_GOV_IN_API_KEY")),
        "historical_date_range": (bundle or {}).get("training_date_range"),
        "source_file": (bundle or {}).get("training_source"),
    }


def _text_match(series: pd.Series, value: str | None) -> pd.Series:
    if not value:
        return pd.Series(True, index=series.index)
    return series.astype("string").str.casefold().str.contains(
        value.strip().casefold(), regex=False, na=False
    )


def _select_history(
    crop: str,
    state: str | None = None,
    district: str | None = None,
    market: str | None = None,
) -> pd.DataFrame:
    rows = _read_historical_rows()
    selected = rows.loc[rows["Crop"].str.casefold() == crop.casefold()]
    selected = selected.loc[
        _text_match(selected["State"], state)
        & _text_match(selected["District"], district)
        & _text_match(selected["Market"], market)
    ]
    if selected.empty:
        raise MarketDataError(
            "No historical prices match this crop and market. Try another location or crop."
        )
    return selected


def _live_market_rows(
    crop: str,
    state: str | None,
    district: str | None,
    market: str | None,
) -> pd.DataFrame:
    api_key = os.getenv("DATA_GOV_IN_API_KEY", "").strip()
    if not api_key:
        raise MarketDataError("The government market-price API key is not configured.")
    commodity = CROP_COMMODITY.get(crop)
    if not commodity:
        raise MarketDataError("This crop is not available in the government market-price feed.")

    params = {
        "api-key": api_key,
        "format": "json",
        "limit": "1000",
        "filters[commodity]": commodity,
        "sort[arrival_date]": "desc",
    }
    if state:
        params["filters[state]"] = state
    if district:
        params["filters[district]"] = district
    if market:
        params["filters[market]"] = market
    request = Request(
        f"https://api.data.gov.in/resource/{DATA_GOV_RESOURCE}?{urlencode(params)}",
        headers={"User-Agent": "FarmShield/1.0", "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=12) as response:
            payload = json.loads(response.read())
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        raise MarketDataError("The current government market-price feed could not be reached.") from error
    records = payload.get("records") if isinstance(payload, dict) else None
    if not isinstance(records, list) or not records:
        raise MarketDataError("The current market-price feed returned no records for this crop.")

    normalized: list[dict[str, Any]] = []
    for record in records:
        if not isinstance(record, dict):
            continue
        item = {str(key).strip().lower(): value for key, value in record.items()}
        normalized.append({
            "Crop": crop,
            "State": item.get("state", ""),
            "District": item.get("district", ""),
            "Market": item.get("market", ""),
            "Arrival_Date": pd.to_datetime(item.get("arrival_date"), errors="coerce"),
            "Min_Price": pd.to_numeric(item.get("min_price"), errors="coerce"),
            "Max_Price": pd.to_numeric(item.get("max_price"), errors="coerce"),
            "Modal_Price": pd.to_numeric(item.get("modal_price"), errors="coerce"),
        })
    live = pd.DataFrame(normalized).dropna(subset=["Arrival_Date", *FEATURES[:3]])
    live = live.loc[
        _text_match(live["State"], state)
        & _text_match(live["District"], district)
        & _text_match(live["Market"], market)
        & (live["Modal_Price"] > 0)
        & (live["Max_Price"] >= live["Min_Price"])
    ]
    if live.empty:
        raise MarketDataError("No current prices match the requested crop and market.")
    return live


def _save_market_cache(rows: pd.DataFrame) -> None:
    MARKET_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    existing: list[dict[str, Any]] = []
    if MARKET_CACHE_PATH.is_file():
        try:
            existing = json.loads(MARKET_CACHE_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            logger.warning("Ignoring unreadable cached government market-price data.")
    current = rows.copy()
    current["Arrival_Date"] = current["Arrival_Date"].dt.strftime("%Y-%m-%d")
    combined = pd.concat([pd.DataFrame(existing), current], ignore_index=True)
    key_columns = ["Crop", "State", "District", "Market", "Arrival_Date"]
    combined = combined.drop_duplicates(subset=key_columns, keep="last")
    combined.to_json(MARKET_CACHE_PATH, orient="records", date_format="iso")


def _cached_market_rows() -> pd.DataFrame:
    if not MARKET_CACHE_PATH.is_file():
        return pd.DataFrame(columns=RAW_COLUMNS)
    try:
        rows = pd.read_json(MARKET_CACHE_PATH)
    except (OSError, ValueError) as error:
        logger.warning("Could not read cached government market-price data: %s", error)
        return pd.DataFrame(columns=RAW_COLUMNS)
    if not rows.empty:
        rows["Arrival_Date"] = pd.to_datetime(rows["Arrival_Date"], errors="coerce")
    return rows


def predict_storage(
    crop: str,
    state: str | None = None,
    district: str | None = None,
    market: str | None = None,
    mode: str = "auto",
) -> dict[str, Any]:
    bundle = storage_bundle
    if bundle is None:
        raise MarketDataError("The offline storage model is not trained. Run `python -m backend.storage_model`.")
    model = bundle["models"].get(crop)
    if model is None:
        raise MarketDataError(f"No trained storage model is available for {crop}.")

    historical = _select_history(crop, state, district, market)
    source = "local_historical_csv"
    offline_reason = None
    live = pd.DataFrame()
    if mode != "offline":
        try:
            live = _live_market_rows(crop, state, district, market)
            _save_market_cache(live)
            source = "data.gov.in_current_market_prices_plus_local_history"
        except MarketDataError as error:
            if mode == "online":
                raise
            offline_reason = str(error)
            logger.info("Using offline storage data: %s", error)
            live = _cached_market_rows()
            if not live.empty:
                live = live.loc[
                    (live["Crop"].str.casefold() == crop.casefold())
                    & _text_match(live["State"], state)
                    & _text_match(live["District"], district)
                    & _text_match(live["Market"], market)
                ]
                if not live.empty:
                    source = "cached_government_market_prices_plus_local_history"

    if not live.empty:
        market_keys = ["State", "District", "Market"]
        available_keys = live.sort_values("Arrival_Date").drop_duplicates(market_keys, keep="last")
        matching_history = historical
        if state or district or market:
            matching_history = historical.loc[
                _text_match(historical["State"], state)
                & _text_match(historical["District"], district)
                & _text_match(historical["Market"], market)
            ]
        history_key = set(
            matching_history.sort_values("Arrival_Date")
            .drop_duplicates(market_keys, keep="last")[market_keys]
            .itertuples(index=False, name=None)
        )
        eligible = available_keys.loc[
            available_keys[market_keys].apply(tuple, axis=1).isin(history_key)
        ]
        if not eligible.empty:
            newest = eligible.sort_values("Arrival_Date").iloc[-1]
            matching_history = historical.loc[
                (historical["State"] == newest["State"])
                & (historical["District"] == newest["District"])
                & (historical["Market"] == newest["Market"])
            ]
            live = live.loc[
                (live["State"] == newest["State"])
                & (live["District"] == newest["District"])
                & (live["Market"] == newest["Market"])
            ]
            prices = pd.concat([matching_history, live], ignore_index=True)
            prices = prices.drop_duplicates(
                subset=["Crop", "State", "District", "Market", "Arrival_Date"], keep="last"
            )
            source = (
                "data.gov.in_current_market_prices_plus_local_history"
                if source.startswith("data.gov.in")
                else "cached_government_market_prices_plus_local_history"
            )
        else:
            if mode == "online":
                raise MarketDataError(
                    "Current prices arrived, but no matching historical market exists to calculate the model features."
                )
            prices = historical
            offline_reason = (
                "Current prices were available, but no matching local market history was found; "
                "the prediction uses local historical prices."
            )
            source = "local_historical_csv"
    else:
        prices = historical

    group_columns = ["Crop", "State", "Market"]
    featured = _add_price_features(prices, group_columns)
    latest = featured.sort_values("Arrival_Date").iloc[-1]
    feature_row = pd.DataFrame([{feature: float(latest[feature]) for feature in FEATURES}])
    probabilities = model.predict_proba(feature_row)[0]
    class_index = int(np.argmax(probabilities))
    prediction = int(model.classes_[class_index])
    probability = float(probabilities[class_index])
    return {
        "crop": crop,
        "decision": "Store" if prediction == 1 else "Sell",
        "class_probability": probability,
        "market": {
            "state": str(latest["State"]),
            "district": str(latest["District"]),
            "name": str(latest["Market"]),
            "arrival_date": latest["Arrival_Date"].date().isoformat(),
            "modal_price_per_quintal": round(float(latest["Modal_Price"]), 2),
            "min_price_per_quintal": round(float(latest["Min_Price"]), 2),
            "max_price_per_quintal": round(float(latest["Max_Price"]), 2),
        },
        "data_mode": "online" if source.startswith("data.gov.in") else "offline",
        "data_source": source,
        "offline_reason": offline_reason,
        "historical_training_range": bundle["training_date_range"],
        "target_definition": bundle["target_definition"],
        "model_evaluation": bundle["metrics"].get(crop),
        "advisory_note": (
            "Experimental model trained on historical market records. Its class probability is not "
            "a calibrated price forecast or a guarantee; verify today's local price and storage costs."
        ),
    }


if __name__ == "__main__":
    trained = train_storage_model()
    print(json.dumps({
        "model_path": str(MODEL_PATH),
        "training_source": trained["training_source"],
        "training_date_range": trained["training_date_range"],
        "target_definition": trained["target_definition"],
        "metrics": trained["metrics"],
    }, indent=2))
