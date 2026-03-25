# B3 Tactical Ranking Dashboard — User Guide

**Version**: 2.0 | **Last Updated**: 2026-03-15

## Overview

The B3 Tactical Ranking Dashboard is a DLOps monitoring platform for the Brazilian stock market (B3). It provides real-time insights into DL model recommendations, performance, data quality, drift detection, explainability, backtesting, and cost management across 8 tabs.

---

## Getting Started

1. **Login** — Authenticate via AWS Cognito (SSO or username/password).
2. **Guided Tour** — First-time visitors are offered an interactive tour. You can restart it anytime from the Help menu.
3. **Theme** — Toggle between light and dark mode using the theme switch in the top bar.
4. **Help** — Click the help icon (top-right) for FAQ, glossary, release notes, and feedback.

---

## Tab Reference

### 1. Recommendations

View the latest DL model stock recommendations with filtering, comparison, and export.

| Feature | Description |
|---------|-------------|
| Filters | Filter by sector, return range, and minimum score. Filters compose as intersection. |
| Ticker Detail | Click any ticker to see recommendation history, fundamentals, and news. |
| Comparison | Toggle comparison mode, select up to 5 tickers, and view side-by-side metrics. |
| Alerts | Configure alerts for score, return, or rank changes. Notifications appear in the notification center. |
| Export | Export filtered data as CSV or Excel. Filename includes timestamp. |

### 2. Performance

Monitor individual model performance and compare against benchmarks.

| Feature | Description |
|---------|-------------|
| Model Breakdown | MAPE, accuracy, and Sharpe ratio per model with sortable columns. |
| Confusion Matrix | Categorizes predictions as up/down/neutral with precision and recall. |
| Error Distribution | Histogram of prediction errors with normal distribution overlay. |
| Benchmark Comparison | Cumulative returns vs. Ibovespa buy-and-hold and moving average crossover. |
| Feature Importance | Top 20 features by importance percentage per model. |
| Correlation Heatmap | Pearson correlation between features with hierarchical clustering. |

### 3. Validation

Assess prediction accuracy with statistical analysis.

| Feature | Description |
|---------|-------------|
| Scatter Plot | Predicted vs. actual returns with R² and correlation coefficient. |
| Temporal Accuracy | Daily/weekly/monthly accuracy, MAPE, and correlation over time. |
| Segmentation | Performance breakdown by return range (large negative to large positive). |
| Outlier Analysis | Predictions with errors > 3σ, grouped by over/under prediction. |

### 4. Costs

Track AWS infrastructure costs and optimize spending.

| Feature | Description |
|---------|-------------|
| Cost Trends | 90-day stacked area chart by service (Lambda, S3, API Gateway). |
| Cost per Prediction | Daily cost / predictions with trend analysis. |
| Budget Alerts | Warning at 80%, critical at 100% of configured budget. |
| Optimization | AI-generated suggestions with estimated monthly savings. |
| ROI Calculator | Calculate return on investment based on portfolio alpha vs. costs. |

### 5. Data Quality

Monitor the health and completeness of input data.

| Feature | Description |
|---------|-------------|
| Completeness | Per-ticker completeness rate. Highlights tickers below 95%. |
| Anomalies | Detects data gaps and statistical outliers (> 5σ). Categorized by severity. |
| Freshness | Data age per source. Warning at 24h, critical at 48h. |
| Coverage | Universe coverage rate. Lists excluded tickers with reasons. |

### 6. Drift Detection

Detect changes in data distributions and model behavior.

| Feature | Description |
|---------|-------------|
| Data Drift | KS-test on rolling 30-day windows. Flags features with p-value < 0.05. |
| Concept Drift | Feature-target correlation changes. Flags when |change| > 0.2. |
| Degradation Alerts | Monitors MAPE (+20%), accuracy (-10pp), Sharpe (-0.5). |
| Retraining | Recommends retraining when >30% features drifted or degradation persists >7 days. |

### 7. Explainability

Understand why the model makes specific predictions.

| Feature | Description |
|---------|-------------|
| SHAP Waterfall | Feature contributions for a selected ticker. Base value → final prediction. |
| Sensitivity | Vary a feature across its range and observe prediction changes. |
| Aggregate Impact | Average absolute SHAP value per feature across all predictions. |
| Natural Language | Plain-English explanation of top positive and negative contributors. |

### 8. Backtesting

Simulate historical trading strategies based on model recommendations.

| Feature | Description |
|---------|-------------|
| Portfolio Simulation | Construct portfolios from top N recommendations with configurable parameters. |
| Walk-Forward | Rolling train/test windows to evaluate out-of-sample performance. |
| Risk Metrics | VaR (95%/99%), CVaR, max drawdown, Sharpe ratio, Sortino ratio. |
| Stress Testing | Evaluate portfolio under historical crisis scenarios. |

---

## Common Workflows

### Investigating a Recommendation
1. Go to **Recommendations** tab
2. Apply sector or score filters to narrow results
3. Click a ticker to open the detail modal
4. Check **Performance** tab for model accuracy on that sector
5. Check **Explainability** tab for SHAP values on that ticker

### Monitoring Data Health
1. Go to **Data Quality** tab
2. Review completeness rates — investigate any ticker below 95%
3. Check freshness indicators — ensure all sources are current
4. Go to **Drift Detection** tab to check for distribution changes

### Evaluating Strategy Performance
1. Go to **Backtesting** tab
2. Configure simulation parameters (top N, rebalancing frequency)
3. Review cumulative returns and risk metrics
4. Compare against benchmark strategies
5. Check **Costs** tab to calculate ROI

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `?` | Open help menu |
| `Esc` | Close modal or menu |
| `Tab` / `Shift+Tab` | Navigate interactive elements |
| `Enter` / `Space` | Activate focused element |

---

## Feedback

Use the **Feedback** option in the Help menu to submit ratings and comments directly from the dashboard. Your feedback helps us prioritize improvements.

---

## Support

- **Email**: support@qyntara.tech
- **Documentation**: See `docs/API.md` for REST API reference
- **FAQ**: Available in the Help menu within the dashboard
