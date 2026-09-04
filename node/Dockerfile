FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy node source
COPY *.py ./

# Default environment (overridden by docker-compose)
ENV NODE_ID=LOCAL
ENV MQTT_HOST=mosquitto
ENV MQTT_PORT=1883
ENV LEDGER_URL=http://ledger-service:8000
ENV MLFLOW_URL=http://mlflow:5000
ENV DATA_DIR=/app/data
ENV KEYS_DIR=/app/keys
ENV METRICS_PORT=8080
ENV BATCH_SLEEP_S=2

EXPOSE 8080

CMD ["python", "main.py"]
