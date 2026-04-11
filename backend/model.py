import pickle
from pathlib import Path

import pandas as pd
from sklearn.metrics import accuracy_score
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).parent


def load_pipeline():
    with open(BASE_DIR / "pipeline.pkl", "rb") as f:
        return pickle.load(f)


if __name__ == "__main__":
    df = pd.read_csv(BASE_DIR / "heart.csv")

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

    FEATURES = [
        "age", "sex", "chest pain type", "resting blood pressure",
        "serum cholestoral in mg/dl", "fasting blood sugar > 120 mg/dl",
        "resting electrocardiographic results", "maximum heart rate achieved",
        "exercise induced angina",
        "oldpeak = ST depression induced by exercise relative to rest",
        "the slope of the peak exercise ST segment",
        "number of major vessels (0-3) colored by flourosopy", "thal",
    ]

    X = df[FEATURES]
    y = df["target"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    GaussianNB()),
    ])

    grid = GridSearchCV(pipeline, {"clf__var_smoothing": [1e-9, 1e-8, 1e-7, 1e-6]}, cv=5, scoring="accuracy")
    grid.fit(X_train, y_train)

    accuracy = accuracy_score(y_test, grid.predict(X_test))
    print(f"Best params: {grid.best_params_}")
    print(f"Accuracy:    {accuracy:.2f}")

    with open(BASE_DIR / "pipeline.pkl", "wb") as f:
        pickle.dump(grid.best_estimator_, f)
    print("Saved pipeline.pkl")
