# FarmShield local API

The API serves the crop recommendation model, an experimental store-or-sell model, aggregate insights from the cleaned crop dataset, and a notebook-derived crop-calendar demonstration. It does not expose individual dataset rows. It does not run DSSAT: the project does not include the DSSAT executable, cultivar coefficients, validated soil/weather files, or crop-specific management inputs.

## Setup

From the FarmShield project directory, create/activate a Python environment, install the backend requirements, clean the data, and train the crop model:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m backend.train_model
.\.venv\Scripts\python.exe -m backend.storage_model
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
```

The crop training command writes `backend\data\crop_recommendation_cleaned.csv`, `backend\data\cleaning_report.json`, and its model plus held-out metrics under `backend\artifacts\`. It uses a stratified 80/20 split and excludes the yield/price columns from classifier features. The storage training command reads the local `Datasets\final_combined_cleaned_dataset(STOREORSELL).csv` and writes `backend\artifacts\storage_store_sell.joblib`. Both model artifacts are generated locally and ignored by Git.

The farmer's store-or-sell prediction works offline using the local historical dataset. With internet access and a privately configured `DATA_GOV_IN_API_KEY`, it also requests current mandi prices from the Government of India's data.gov.in price resource and combines them with local history. The key is read only by the backend; never put it in a frontend environment variable or commit it. In PowerShell, set it for the backend process before starting Uvicorn:

```powershell
$env:DATA_GOV_IN_API_KEY = "your-private-data.gov.in-api-key"
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
```

Run the frontend separately from `frontend`:

```powershell
npm install
npm run dev
```

The Vite development server proxies `/api` to the local backend. Set `VITE_API_BASE_URL` only when using a different API base (copy `frontend\.env.example` to `frontend\.env.local`).

## Data and model limits

The supplied crop file has 2,200 rows and 22 crop labels. The project contains no publisher, license, collection-method, geographic-coverage, or measurement-unit metadata for it, so the underlying observations cannot be independently verified as real. The trained model is a genuine classifier fit to that supplied file, but its high held-out score only describes this dataset split and is not evidence of field accuracy.

The frontend displays aggregate counts, crop categories, data-source caveats, and held-out model metrics calculated from the supplied dataset. The API summary returns only these aggregate fields; it does not return the cleaned records or individual feature values. The raw-row preview endpoint is intentionally not provided.

The connected `/api/predict/calendar` endpoint applies the notebook's GDD threshold demonstration to historical daily weather from Open-Meteo. It accepts latitude, longitude, start/end dates, and optional base-temperature and maturity-GDD thresholds. Weather is historical gridded data, not a farm sensor reading or a forecast; the browser sends the coordinates and dates to the local API, which requests them from Open-Meteo.

This endpoint is not DSSAT and is not a validated crop-growth simulation. Its pesticide weather screen is an illustrative notebook heuristic, not a pesticide recommendation; no pest observations, pesticide labels, or crop-specific validation are available. The notebook does not calculate irrigation demand, so irrigation scheduling remains unavailable. The calendar also retains its separate day-count demonstration.

The storage model follows the notebook's experimental rule: it labels a case “Store” when the modal price is more than 10% higher after the next 30 market records, otherwise “Sell”. A market record is not necessarily one calendar day. The available bundled price file covers 2019 only; offline output is therefore historical, not a current market quote. The model has a chronological holdout evaluation, but its probability is not calibrated and the result is not financial advice or a guaranteed future price. Live mode requires a valid data.gov.in API key and a matching crop/market; if live fetching fails in automatic mode, the API reports that it fell back to local or cached data.
