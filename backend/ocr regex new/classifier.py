"""
Invoice Type Classifier Module
Uses TF-IDF + Logistic Regression to classify invoice layout type.
"""

import os
import pickle

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRAINING_DATA_PATH = os.path.join(BASE_DIR, "training_data", "invoices.csv")
MODEL_PATH = os.path.join(BASE_DIR, "training_data", "classifier_model.pkl")


def train_model():
    """
    Train a TF-IDF + Logistic Regression classifier on the invoices dataset.
    Saves the trained pipeline to disk and returns it.
    """
    df = pd.read_csv(TRAINING_DATA_PATH)
    df = df.dropna(subset=["text", "label"])

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            stop_words="english",
        )),
        ("clf", LogisticRegression(
            max_iter=1000,
            solver="lbfgs",
        )),
    ])

    pipeline.fit(df["text"], df["label"])

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(pipeline, f)

    return pipeline


def _load_model():
    """Load the trained model from disk, training first if not found."""
    if not os.path.exists(MODEL_PATH):
        return train_model()
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)


def predict_invoice_type(text):
    """
    Predict the invoice layout type for the given OCR text.

    Returns:
        str - one of: corporate_gst, eway_bill, gst_einvoice,
              thermal_bill, retail_bill
    """
    model = _load_model()
    prediction = model.predict([text])[0]
    return prediction
