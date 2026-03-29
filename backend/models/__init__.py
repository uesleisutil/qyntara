# Lazy imports — torch models only loaded when needed (not in Lambda)
def get_edge_estimator():
    from .edge_estimator import EdgeEstimator
    return EdgeEstimator

def get_anomaly_detector():
    from .anomaly_detector import AnomalyDetector
    return AnomalyDetector

from .sentiment_scorer import SentimentScorer
