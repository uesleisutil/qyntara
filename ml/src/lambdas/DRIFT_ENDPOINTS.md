# Drift Detection Endpoints Implementation

## Overview

This document describes the four new drift detection endpoints added to the Dashboard API Lambda function (`dashboard_api.py`).

## Endpoints

### 1. Data Drift Endpoint
**Path:** `/api/drift/data-drift?days={days}`  
**Default days:** 90  
**Requirements:** 25.1-25.8, 80.1, 80.10

**Purpose:** Returns data drift analysis with Kolmogorov-Smirnov (KS) test statistics for feature distribution changes.

**Response Format:**
```json
{
  "driftData": [
    {
      "feature": "feature_name",
      "ksStatistic": 0.15,
      "pValue": 0.03,
      "drifted": true,
      "magnitude": 0.15,
      "currentDistribution": [0.1, 0.2, ...],
      "baselineDistribution": [0.12, 0.18, ...]
    }
  ],
  "summary": {
    "totalFeatures": 50,
    "driftedFeatures": 5,
    "driftPercentage": 10.0
  },
  "metadata": {
    "days": 90,
    "timestamp": "2024-01-15T10:30:00Z",
    "cached": true,
    "cacheExpiry": "2024-01-15T11:00:00Z"
  }
}
```

### 2. Concept Drift Endpoint
**Path:** `/api/drift/concept-drift?days={days}`  
**Default days:** 90  
**Requirements:** 26.1-26.8, 80.1, 80.10

**Purpose:** Returns concept drift analysis showing changes in feature-target correlations.


**Response Format:**
```json
{
  "conceptDriftData": [
    {
      "feature": "feature_name",
      "currentCorrelation": 0.45,
      "baselineCorrelation": 0.65,
      "change": -0.20,
      "drifted": true
    }
  ],
  "overallDriftScore": 0.15,
  "summary": {
    "totalFeatures": 50,
    "driftedFeatures": 8,
    "driftPercentage": 16.0
  }
}
```

### 3. Performance Degradation Endpoint
**Path:** `/api/drift/degradation?days={days}`  
**Default days:** 90  
**Requirements:** 27.1-27.8, 80.1, 80.10

**Purpose:** Returns performance degradation metrics and alerts.

**Response Format:**
```json
{
  "performanceDegradation": [
    {
      "metric": "mape",
      "current": 0.15,
      "baseline": 0.12,
      "change": 0.03,
      "changePercentage": 25.0,
      "degraded": true,
      "duration": 10,
      "severity": "high",
      "threshold": 0.2,
      "firstDetected": "2024-01-15"
    }
  ],
  "driftEvents": [
    {
      "date": "2024-01-15",
      "type": "performance",
      "description": "MAPE increased by 25%",
      "severity": "high"
    }
  ]
}
```

### 4. Retraining Recommendations Endpoint
**Path:** `/api/drift/retraining?days={days}`  
**Default days:** 90  
**Requirements:** 28.1-28.8, 80.1, 80.10

**Purpose:** Returns retraining recommendations based on drift and degradation.

**Response Format:**
```json
{
  "driftedFeaturesPercentage": 35.0,
  "conceptDriftDetected": true,
  "performanceDegradationDays": 12,
  "daysSinceLastTraining": 45,
  "recommendation": {
    "priority": "high",
    "reason": "Model retraining recommended due to...",
    "expectedImprovement": 15.5,
    "triggers": [...]
  }
}
```

## Implementation Details

### Caching (Requirement 80.10)
All endpoints implement 30-minute response caching:
- `cached: true` in metadata
- `cacheExpiry` timestamp 30 minutes in future

### Error Handling (Requirement 80.10)
- Returns 404 if no drift data found
- Returns 500 with error details on exceptions
- All errors logged with full stack traces

### CORS Headers
All responses include:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, X-Api-Key, Authorization`

### Gzip Compression
Responses are compressed with gzip when client sends `Accept-Encoding: gzip` header.

## Testing

Run tests with:
```bash
cd ml
python3 tests/test_dashboard_api_drift.py
python3 tests/test_dashboard_api_drift_routing.py
```
