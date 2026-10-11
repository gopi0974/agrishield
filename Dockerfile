FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_BASE_URL=/api
ARG VITE_OWM_API_KEY
ENV VITE_OWM_API_KEY=${VITE_OWM_API_KEY}
RUN npm run build

FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

COPY backend/requirements.txt backend/requirements.txt
RUN python -m pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY ["Datasets/unified_crop_data before crop.csv", "Datasets/unified_crop_data before crop.csv"]
COPY --from=frontend-build /app/frontend/dist frontend/dist

# Train only the crop recommendation model. The store-or-sell dataset is not
# included in this deployment, so that optional API remains unavailable.
RUN python -m backend.train_model

EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
