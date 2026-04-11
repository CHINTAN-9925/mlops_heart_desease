import logging
import os
from datetime import datetime, timezone

import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from waitress import serve


from model import load_pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ── Load pipeline once at startup ─────────────────────────────────────────────
pipeline = load_pipeline()

# ── MongoDB ───────────────────────────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
    client.admin.command("ping")
    collection = client["heart_disease_db"]["predictions"]
    log.info("MongoDB connected at %s", MONGO_URI)
except Exception as e:
    collection = None
    log.warning("MongoDB unavailable: %s — history will be disabled", e)

# ── Required input fields ─────────────────────────────────────────────────────
REQUIRED_FIELDS = [
    "age",
    "sex",
    "chest pain type",
    "resting blood pressure",
    "serum cholestoral in mg/dl",
    "fasting blood sugar > 120 mg/dl",
    "resting electrocardiographic results",
    "maximum heart rate achieved",
    "exercise induced angina",
    "oldpeak = ST depression induced by exercise relative to rest",
    "the slope of the peak exercise ST segment",
    "number of major vessels (0-3) colored by flourosopy",
    "thal",
]


def risk_label(probability: float) -> str:
    if probability < 0.30:
        return "Low Risk"
    if probability < 0.55:
        return "Moderate Risk"
    if probability < 0.75:
        return "High Risk"
    return "Critical Risk"


# ── Routes ────────────────────────────────────────────────────────────────────


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@app.route("/predict", methods=["POST"])
def predict():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON"}), 400

    # Validate fields
    for field in REQUIRED_FIELDS:
        if field not in body:
            return jsonify({"error": f"Missing field: '{field}'"}), 400

    try:
        df = pd.DataFrame([body])
        prediction = int(pipeline.predict(df)[0])
        probability = round(float(pipeline.predict_proba(df)[0][1]), 6)
        label = risk_label(probability)
    except Exception as e:
        log.exception("Prediction error")
        return jsonify({"error": "Prediction failed", "detail": str(e)}), 500

    log.info(
        "prediction=%d  probability=%.4f  label=%s", prediction, probability, label
    )

    # Store in MongoDB (non-fatal)
    if collection is not None:
        try:
            collection.insert_one(
                {
                    "input": body,
                    "prediction": prediction,
                    "probability": probability,
                    "label": label,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
        except Exception as e:
            log.warning("MongoDB write failed: %s", e)

    return (
        jsonify({"prediction": prediction, "probability": probability, "label": label}),
        200,
    )


@app.route("/history", methods=["GET"])
def history():
    if collection is None:
        return jsonify([]), 200
    try:
        docs = list(collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(100))
        return jsonify(docs), 200
    except Exception as e:
        log.exception("History fetch error")
        return jsonify({"error": "Failed to fetch history", "detail": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    log.info("Starting CardioScan API on port %d via Waitress", port)
    serve(app, host="0.0.0.0", port=port)
