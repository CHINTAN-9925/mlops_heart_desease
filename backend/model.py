import pandas as pd
import pickle
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.naive_bayes import GaussianNB
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score

BASE_DIR = Path(__file__).parent


# ── load_pipeline() — used by app.py at startup ───────────────────────────────
def load_pipeline():
    with open(BASE_DIR / "pipeline.pkl", "rb") as f:
        return pickle.load(f)


# ── Training — only runs when executed directly: python model.py ──────────────
if __name__ == "__main__":

    # Load dataset
    df = pd.read_csv(BASE_DIR / "heart.csv")

    # Rename short UCI column names → exact API column names
    df.rename(columns={
        "cp":       "chest pain type",
        "trestbps": "resting blood pressure",
        "chol":     "serum cholestoral in mg/dl",
        "fbs":      "fasting blood sugar > 120 mg/dl",
        "restecg":  "resting electrocardiographic results",
        "thalach":  "maximum heart rate achieved",
        "exang":    "exercise induced angina",
        "oldpeak":  "oldpeak = ST depression induced by exercise relative to rest",
        "slope":    "the slope of the peak exercise ST segment",
        "ca":       "number of major vessels (0-3) colored by flourosopy",
    }, inplace=True)

    # If target column is called 'num' (raw UCI), binarise it
    if "num" in df.columns and "target" not in df.columns:
        df["target"] = (df["num"] > 0).astype(int)
        df.drop(columns=["num"], inplace=True)

    FEATURE_COLS = [
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

    X = df[FEATURE_COLS].values
    y = df["target"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Pipeline: scaling + GaussianNB
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    GaussianNB()),
    ])

    # Hyperparameter tuning with GridSearchCV
    param_grid = {
        "clf__var_smoothing": [1e-9, 1e-8, 1e-7, 1e-6],
    }

    grid_search = GridSearchCV(pipeline, param_grid, cv=5, scoring="accuracy")
    grid_search.fit(X_train, y_train)

    # Results
    print("Best Parameters:", grid_search.best_params_)

    y_pred = grid_search.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"Tuned Pipeline Accuracy: {accuracy:.2f}")

    # Save the tuned pipeline
    with open(BASE_DIR / "pipeline.pkl", "wb") as f:
        pickle.dump(grid_search.best_estimator_, f)
    print("Tuned pipeline saved as 'pipeline.pkl'")

    # Load and test the saved pipeline
    with open(BASE_DIR / "pipeline.pkl", "rb") as f:
        pipeline_tuned = pickle.load(f)

    # Example prediction (13 features in API column order)
    X_new = np.array([[54, 1, 0, 130, 250, 0, 0, 150, 0, 1.5, 1, 0, 2]])

    prediction = pipeline_tuned.predict(X_new)
    probability = pipeline_tuned.predict_proba(X_new)[0][1]

    print(f"Predicted class: {prediction[0]}")
    print(f"Disease probability: {probability:.2f}")
