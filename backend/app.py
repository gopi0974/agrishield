from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path
from typing import Annotated, Self
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

from backend.data_pipeline import REPORT_PATH
from backend.storage_model import MarketDataError, load_storage_model, predict_storage, storage_model_status
from backend.train_model import METRICS_PATH, MODEL_PATH

logger = logging.getLogger("farmshield.api")
model_bundle: dict | None = None
metrics: dict | None = None


def load_artifacts() -> None:
    global model_bundle, metrics
    model_bundle = None
    metrics = None
    if not MODEL_PATH.is_file():
        logger.warning("Crop recommendation model is not trained. Run `python -m backend.train_model`.")
        return
    if not METRICS_PATH.is_file():
        logger.error("Crop recommendation model metrics are missing: %s", METRICS_PATH)
        return
    model_bundle = joblib.load(MODEL_PATH)
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_artifacts()
    load_storage_model()
    yield


app = FastAPI(
    title="FarmShield API",
    description="Local crop recommendations, store-or-sell predictions, and aggregate dataset insights.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class CropPredictionRequest(BaseModel):
    N: Annotated[float, Field(ge=0, le=500)]
    P: Annotated[float, Field(ge=0, le=500)]
    K: Annotated[float, Field(ge=0, le=500)]
    temperature: Annotated[float, Field(ge=-20, le=70)]
    humidity: Annotated[float, Field(ge=0, le=100)]
    ph: Annotated[float, Field(ge=0, le=14)]
    rainfall: Annotated[float, Field(ge=0, le=10000)]


class StoragePredictionRequest(BaseModel):
    crop: Annotated[str, Field(min_length=1, max_length=50)]
    state: Annotated[str | None, Field(max_length=80)] = None
    district: Annotated[str | None, Field(max_length=80)] = None
    market: Annotated[str | None, Field(max_length=100)] = None
    mode: str = "auto"

    @model_validator(mode="after")
    def validate_mode(self) -> Self:
        if self.mode not in {"auto", "offline", "online"}:
            raise ValueError("mode must be auto, offline, or online.")
        return self


class CalendarPredictionRequest(BaseModel):
    latitude: Annotated[float, Field(ge=-90, le=90)]
    longitude: Annotated[float, Field(ge=-180, le=180)]
    start_date: date
    end_date: date
    t_base: Annotated[float, Field(ge=-10, le=30)] = 10
    maturity_gdd_target: Annotated[float, Field(gt=0, le=5000)] = 1200

    @model_validator(mode="after")
    def validate_date_range(self) -> Self:
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date.")
        if (self.end_date - self.start_date).days > 366:
            raise ValueError("Weather date range cannot exceed 366 days.")
        if self.end_date > date.today() - timedelta(days=5):
            raise ValueError("Historical weather is available only through dates at least five days ago.")
        return self


class FarmAdvisoryRequest(BaseModel):
    latitude: Annotated[float, Field(ge=-90, le=90)]
    longitude: Annotated[float, Field(ge=-180, le=180)]
    sowing_date: date
    crop_days: Annotated[int, Field(ge=1, le=365)]
    nitrogen: Annotated[float, Field(ge=0, le=500)] = 0
    phosphorus: Annotated[float, Field(ge=0, le=500)] = 0
    potassium: Annotated[float, Field(ge=0, le=500)] = 0
    ph: Annotated[float, Field(ge=0, le=14)] = 7.0
    irrigation: str = ""


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/models/status")
def model_status() -> dict:
    return {
        "crop_recommendation": {
            "available": model_bundle is not None,
            "kind": "Random forest classifier trained from the supplied crop dataset.",
        },
        "crop_calendar_gdd_demo": {
            "available": True,
            "kind": "Notebook-derived GDD calculation using Open-Meteo historical weather; not DSSAT.",
        },
        "dssat_crop_calendar": {
            "available": False,
            "reason": "No DSSAT engine, cultivar/soil files, or validated weather inputs are supplied.",
        },
        "storage_store_sell": storage_model_status(),
    }


@app.get("/api/models/metrics")
def model_metrics() -> dict:
    if metrics is None:
        raise HTTPException(status_code=503, detail="Crop model metrics are unavailable. Train the crop model first.")
    return {
        "crop_recommendation": metrics,
        "dssat_crop_calendar": None,
    }


@app.get("/api/data/summary")
def data_summary() -> dict:
    if not REPORT_PATH.is_file():
        raise HTTPException(status_code=503, detail="Cleaned data summary is unavailable. Run `python -m backend.data_pipeline` first.")
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    public_fields = (
        "source_file",
        "source_provenance",
        "original_rows",
        "cleaned_rows",
        "invalid_rows_excluded",
        "duplicate_rows_excluded",
        "feature_count",
        "crop_categories",
        "missing_values_after_cleaning",
        "processed_at_utc",
        "date_range",
    )
    return {field: report[field] for field in public_fields}


@app.post("/api/predict/crop")
def predict_crop(request: CropPredictionRequest) -> dict:
    if model_bundle is None:
        raise HTTPException(status_code=503, detail="Crop recommendation model is not available. Train it with `python -m backend.train_model`.")

    values = request.model_dump()
    row = pd.DataFrame([values], columns=model_bundle["features"])
    pipeline = model_bundle["pipeline"]
    probabilities = pipeline.predict_proba(row)[0]
    classes = pipeline.named_steps["classifier"].classes_
    ranking = sorted(
        (
            {"crop": str(crop), "class_probability": float(probability)}
            for crop, probability in zip(classes, probabilities, strict=True)
            if probability > 0
        ),
        key=lambda item: item["class_probability"],
        reverse=True,
    )
    return {
        "model": "RandomForestClassifier",
        "source_provenance": "The supplied dataset's publisher, license, and collection method are unverified.",
        "inputs": values,
        "recommendations": ranking[:5],
        "probability_note": "Class probabilities are model scores and are not calibrated guarantees of agronomic suitability.",
    }


@app.post("/api/predict/storage")
def predict_storage_decision(request: StoragePredictionRequest) -> dict:
    try:
        return predict_storage(
            crop=request.crop.strip(),
            state=request.state,
            district=request.district,
            market=request.market,
            mode=request.mode,
        )
    except MarketDataError as error:
        status_code = 503 if "not trained" in str(error).lower() else 422
        raise HTTPException(status_code=status_code, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.post("/api/predict/calendar")
def predict_calendar(request: CalendarPredictionRequest) -> dict:
    params = urlencode({
        "latitude": request.latitude,
        "longitude": request.longitude,
        "start_date": request.start_date.isoformat(),
        "end_date": request.end_date.isoformat(),
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean",
        "timezone": "auto",
    })
    weather_request = Request(
        f"https://archive-api.open-meteo.com/v1/archive?{params}",
        headers={"User-Agent": "FarmShield/1.0"},
    )
    try:
        with urlopen(weather_request, timeout=15) as response:
            weather = json.loads(response.read())
    except HTTPError as error:
        logger.warning("Historical weather provider returned HTTP %s.", error.code)
        raise HTTPException(status_code=502, detail="Historical weather provider rejected the request.") from error
    except (URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        logger.warning("Could not retrieve historical weather: %s", error)
        raise HTTPException(status_code=502, detail="Historical weather is temporarily unavailable.") from error

    daily = weather.get("daily")
    if not isinstance(daily, dict) or not daily.get("time"):
        raise HTTPException(status_code=502, detail="Historical weather provider returned no daily weather for these dates.")

    required_columns = ("time", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "relative_humidity_2m_mean")
    if any(column not in daily for column in required_columns):
        raise HTTPException(status_code=502, detail="Historical weather provider returned an incomplete daily record.")
    row_count = len(daily["time"])
    if any(len(daily[column]) != row_count for column in required_columns):
        raise HTTPException(status_code=502, detail="Historical weather provider returned mismatched daily records.")

    cumulative_gdd = 0.0
    harvest_date = None
    spray_screen_dates = []
    for index, weather_date in enumerate(daily["time"]):
        tmax = daily["temperature_2m_max"][index]
        tmin = daily["temperature_2m_min"][index]
        rainfall = daily["precipitation_sum"][index]
        humidity = daily["relative_humidity_2m_mean"][index]
        if any(value is None for value in (tmax, tmin, rainfall, humidity)):
            raise HTTPException(status_code=502, detail="Historical weather provider returned missing daily measurements.")
        average_temperature = (float(tmax) + float(tmin)) / 2
        cumulative_gdd += max(average_temperature - request.t_base, 0)
        if harvest_date is None and cumulative_gdd >= request.maturity_gdd_target:
            harvest_date = weather_date
        if (400 <= cumulative_gdd <= 800 and average_temperature > 20 and float(humidity) > 80 and float(rainfall) < 2):
            spray_screen_dates.append(weather_date)

    return {
        "model": "Notebook-derived GDD threshold demonstration",
        "weather_source": "Open-Meteo Historical Weather API",
        "weather_note": "Historical gridded weather, not measurements from a farm sensor or a forecast.",
        "location": {"latitude": request.latitude, "longitude": request.longitude},
        "period": {"start_date": daily["time"][0], "end_date": daily["time"][-1], "days": row_count},
        "parameters": {"t_base": request.t_base, "maturity_gdd_target": request.maturity_gdd_target},
        "cumulative_gdd": round(cumulative_gdd, 1),
        "estimated_maturity_threshold_date": harvest_date,
        "pesticide_weather_screen": {"dates": spray_screen_dates, "note": "Notebook heuristic only; not a pesticide recommendation."},
        "irrigation": {"available": False, "reason": "The supplied notebook does not calculate irrigation demand or soil water balance."},
        "dssat_simulation": False,
    }


@app.post("/api/predict/advisory")
def predict_advisory(request: FarmAdvisoryRequest) -> dict:
    """Fetch 16-day forecast from Open-Meteo and return daily irrigation/fertilizer/harvest advice."""
    forecast_days = min(request.crop_days, 16)
    params = urlencode({
        "latitude": request.latitude,
        "longitude": request.longitude,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,et0_fao_evapotranspiration",
        "forecast_days": forecast_days,
        "timezone": "auto",
    })
    weather_request = Request(
        f"https://api.open-meteo.com/v1/forecast?{params}",
        headers={"User-Agent": "FarmShield/1.0"},
    )
    try:
        with urlopen(weather_request, timeout=15) as response:
            weather = json.loads(response.read())
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail="Weather forecast temporarily unavailable.") from error

    daily = weather.get("daily", {})
    times = daily.get("time", [])
    if not times:
        raise HTTPException(status_code=502, detail="No forecast data returned.")

    today = date.today()
    days_since_sowing = (today - request.sowing_date).days
    crop_days = request.crop_days
    low_n = request.nitrogen < 40
    low_p = request.phosphorus < 20
    low_k = request.potassium < 20
    rain_fed = "rain" in request.irrigation.lower() or request.irrigation == ""

    daily_advice = []
    cumulative_gdd = 0.0
    for i, day_str in enumerate(times):
        tmax = daily["temperature_2m_max"][i] or 0
        tmin = daily["temperature_2m_min"][i] or 0
        rain = daily["precipitation_sum"][i] or 0
        humidity = daily["relative_humidity_2m_mean"][i] or 0
        et0 = daily.get("et0_fao_evapotranspiration", [None] * len(times))[i] or 0
        tavg = (tmax + tmin) / 2
        cumulative_gdd += max(tavg - 10, 0)
        day_offset = days_since_sowing + i
        pct = round(min(day_offset / crop_days * 100, 100), 1) if crop_days > 0 else 0

        # Irrigation advice
        water_deficit = max(et0 - rain, 0)
        if rain >= 5:
            irrigation = "No irrigation needed — sufficient rainfall."
        elif rain_fed:
            irrigation = "Rain-fed only — monitor soil moisture."
        elif water_deficit > 4:
            irrigation = f"Irrigate today — estimated deficit {water_deficit:.1f} mm."
        elif water_deficit > 2:
            irrigation = f"Light irrigation suggested — deficit {water_deficit:.1f} mm."
        else:
            irrigation = "Soil moisture likely adequate."

        # Fertilizer advice based on growth stage and soil NPK
        fertilizer = []
        if day_offset < 15 and low_n:
            fertilizer.append("Apply basal nitrogen (soil N is low).")
        if day_offset < 15 and low_p:
            fertilizer.append("Apply phosphorus at sowing (soil P is low).")
        if day_offset < 15 and low_k:
            fertilizer.append("Apply potassium at sowing (soil K is low).")
        if 25 <= day_offset <= 35 and low_n:
            fertilizer.append("Top-dress nitrogen at tillering stage.")
        if 45 <= day_offset <= 55 and low_n:
            fertilizer.append("Second nitrogen top-dress at panicle initiation.")
        if not fertilizer:
            fertilizer.append("No fertilizer action needed today.")

        # Harvest readiness
        harvest_note = None
        if pct >= 90:
            harvest_note = "Crop approaching maturity — prepare for harvest."
        elif pct >= 100:
            harvest_note = "Crop ready for harvest."

        daily_advice.append({
            "date": day_str,
            "day_of_season": day_offset,
            "season_progress_pct": pct,
            "temperature_max": round(tmax, 1),
            "temperature_min": round(tmin, 1),
            "rainfall_mm": round(rain, 1),
            "humidity_pct": round(humidity, 1),
            "cumulative_gdd": round(cumulative_gdd, 1),
            "irrigation_advice": irrigation,
            "fertilizer_advice": fertilizer,
            "harvest_note": harvest_note,
        })

    return {
        "location": {"latitude": request.latitude, "longitude": request.longitude},
        "sowing_date": request.sowing_date.isoformat(),
        "crop_days": crop_days,
        "forecast_days": len(daily_advice),
        "daily": daily_advice,
    }


FRONTEND_BUILD_DIRECTORY = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if FRONTEND_BUILD_DIRECTORY.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_BUILD_DIRECTORY, html=True), name="frontend")
