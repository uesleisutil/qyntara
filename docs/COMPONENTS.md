# Component Guide

React component architecture for the B3 Tactical Ranking Dashboard.

## Component Hierarchy

```
App
├── AuthProvider
│   ├── Header (navigation, notifications, system health)
│   ├── TabNavigation (8 tabs)
│   └── TabContent
│       ├── RecommendationsTab
│       │   ├── FilterBar (sector, score, return range)
│       │   ├── RecommendationsTable (TanStack Table)
│       │   ├── TickerDetailModal
│       │   ├── ComparisonView
│       │   └── ExportMenu (CSV, Excel, PDF)
│       ├── PerformanceTab
│       │   ├── ModelBreakdownTable
│       │   ├── ConfusionMatrix
│       │   ├── ErrorDistribution
│       │   ├── BenchmarkComparison
│       │   ├── FeatureImportanceChart
│       │   └── ProgressBars (goals)
│       ├── ValidationTab
│       │   ├── ScatterPlot (predicted vs actual)
│       │   ├── TemporalAccuracyChart
│       │   ├── SegmentationChart
│       │   └── OutlierTable
│       ├── CostsTab
│       │   ├── CostTrendChart (stacked area)
│       │   ├── CostPerPrediction
│       │   ├── BudgetIndicators
│       │   ├── OptimizationSuggestions
│       │   └── ROICalculator
│       ├── DataQualityTab
│       │   ├── CompletenessTable
│       │   ├── AnomalyList
│       │   ├── FreshnessIndicators
│       │   └── CoverageMetrics
│       ├── DriftDetectionTab
│       │   ├── DataDriftPanel
│       │   ├── ConceptDriftHeatmap
│       │   ├── DegradationAlerts
│       │   └── RetrainingRecommendations
│       ├── ExplainabilityTab
│       │   ├── SHAPWaterfallChart
│       │   ├── SensitivityAnalysis
│       │   ├── FeatureImpactSummary
│       │   └── DecisionPathViewer
│       └── BacktestingTab
│           ├── BacktestConfig
│           ├── EquityCurveChart
│           ├── RiskMetrics
│           └── TradeLog
└── Footer
```

## Key Components by Tab

### Recommendations

| Component | Location | Purpose |
|-----------|----------|---------|
| `RecommendationsTable` | `components/recommendations/` | Main table with sorting, filtering, pagination via TanStack Table |
| `TickerDetailModal` | `components/recommendations/` | Modal with history, fundamentals, news for a ticker |
| `ComparisonView` | `components/recommendations/` | Side-by-side comparison of up to 5 tickers |
| `FilterBar` | `components/filters/` | Sector, score, return range filters |
| `ExportMenu` | `components/export/` | CSV, Excel, PDF export with active filters applied |

### Performance

| Component | Location | Purpose |
|-----------|----------|---------|
| `ConfusionMatrix` | `components/charts/` | Directional prediction accuracy (up/down/neutral) |
| `ErrorDistribution` | `components/charts/` | Histogram of prediction errors with normal curve overlay |
| `BenchmarkComparison` | `components/charts/` | Model vs Ibovespa and moving-average benchmarks |
| `FeatureImportanceChart` | `components/charts/` | Horizontal bar chart of top-20 features |
| `ProgressBars` | `components/shared/` | Goal tracking (return, Sharpe, accuracy targets) |

### Validation

| Component | Location | Purpose |
|-----------|----------|---------|
| `ScatterPlot` | `components/validation/` | Predicted vs actual returns with R² and correlation |
| `TemporalAccuracyChart` | `components/validation/` | Accuracy/MAPE over time with trend lines |
| `SegmentationChart` | `components/validation/` | Performance by return range buckets |
| `OutlierTable` | `components/validation/` | Predictions with errors > 3σ |

### Costs

| Component | Location | Purpose |
|-----------|----------|---------|
| `CostTrendChart` | `components/costs/` | Stacked area chart of daily costs by service |
| `CostPerPrediction` | `components/costs/` | Unit economics time series |
| `BudgetIndicators` | `components/costs/` | Budget status with 80%/100% thresholds |
| `ROICalculator` | `components/costs/` | ROI and break-even analysis |

### Data Quality

| Component | Location | Purpose |
|-----------|----------|---------|
| `CompletenessTable` | `components/dataQuality/` | Per-ticker completeness rates, highlights < 95% |
| `AnomalyList` | `components/dataQuality/` | Detected gaps and outliers with severity |
| `FreshnessIndicators` | `components/dataQuality/` | Data age per source (prices, fundamentals, news) |
| `CoverageMetrics` | `components/dataQuality/` | Universe coverage percentage and excluded tickers |

### Drift Detection

| Component | Location | Purpose |
|-----------|----------|---------|
| `DataDriftPanel` | `components/driftDetection/` | KS test results per feature |
| `ConceptDriftHeatmap` | `components/driftDetection/` | Correlation changes over time |
| `DegradationAlerts` | `components/driftDetection/` | Active performance degradation warnings |
| `RetrainingRecommendations` | `components/driftDetection/` | Retrain priority and checklist |

### Explainability

| Component | Location | Purpose |
|-----------|----------|---------|
| `SHAPWaterfallChart` | `components/explainability/` | Per-ticker SHAP value waterfall |
| `SensitivityAnalysis` | `components/explainability/` | Prediction sensitivity to feature changes |
| `FeatureImpactSummary` | `components/explainability/` | Aggregate feature impact across all recommendations |

### Backtesting

| Component | Location | Purpose |
|-----------|----------|---------|
| `BacktestConfig` | `components/backtesting/` | Start/end date, capital, position size, rebalancing |
| `EquityCurveChart` | `components/backtesting/` | Cumulative portfolio value vs benchmarks |
| `RiskMetrics` | `components/backtesting/` | Max drawdown, VaR, CVaR, Sharpe |
| `TradeLog` | `components/backtesting/` | Individual trade entries with P&L |

### Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `StatusBadge` | `components/shared/` | Color-coded status indicators |
| `Sparkline` | `components/shared/` | Inline 30-day trend charts in tables |
| `SkeletonScreen` | `components/shared/` | Loading placeholders with shimmer |
| `CandlestickChart` | `components/charts/` | D3.js OHLC chart with volume |
| `NotificationCenter` | `components/monitoring/` | Notification panel with unread badge |
| `SystemHealthIndicator` | `components/monitoring/` | Green/yellow/red system status |
| `GuidedTour` | `components/help/` | react-joyride onboarding tour |
| `FAQ` | `components/help/` | Searchable FAQ with accordion |
| `Glossary` | `components/help/` | 100+ term definitions |

---

## Contexts

React Context providers manage global state. All are composed in the root `App` component.

| Context | File | Purpose |
|---------|------|---------|
| `FilterContext` | `contexts/FilterContext.tsx` | Global filter state (sector, date range, score) |
| `UIContext` | `contexts/UIContext.tsx` | Theme, layout, modal state |
| `AuthContext` | `contexts/AuthContext.tsx` | Authentication state, user roles (admin/analyst/viewer) |
| `NotificationContext` | `contexts/NotificationContext.tsx` | Notification list, unread count, mark-as-read |
| `CrossFilterContext` | `contexts/CrossFilterContext.tsx` | Cross-filtering state across charts |
| `DrillDownContext` | `contexts/DrillDownContext.tsx` | Drill-down navigation state |
| `FavoritesContext` | `contexts/FavoritesContext.tsx` | User-favorited tickers |
| `FontSizeContext` | `contexts/FontSizeContext.tsx` | Adjustable font size (small/medium/large/xl) |
| `KeyboardContext` | `contexts/KeyboardContext.tsx` | Keyboard shortcut bindings |
| `LayoutContext` | `contexts/LayoutContext.tsx` | Dashboard layout preferences |
| `BreadcrumbContext` | `contexts/BreadcrumbContext.tsx` | Breadcrumb navigation trail |
| `AnnotationContext` | `contexts/AnnotationContext.tsx` | User annotations on charts |
| `RealTimeContext` | `contexts/RealTimeContext.tsx` | WebSocket connection, auto-refresh state |
| `SystemHealthContext` | `contexts/SystemHealthContext.tsx` | API/Lambda/S3 health status |

---

## Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useAccessibility` | `hooks/useAccessibility.ts` | ARIA attributes, focus management, screen reader announcements |
| `useChartZoom` | `hooks/useChartZoom.ts` | Zoom/pan state for time series charts |
| `useCosts` | `hooks/useCosts.js` | Fetch and cache AWS cost data |
| `useDataQuality` | `hooks/useDataQuality.js` | Fetch data quality metrics |
| `useDrift` | `hooks/useDrift.js` | Fetch drift detection results |
| `useEnsembleWeights` | `hooks/useEnsembleWeights.js` | Fetch ensemble model weights |
| `useExplainability` | `hooks/useExplainability.js` | Fetch SHAP values and feature impacts |
| `useMetrics` | `hooks/useMetrics.js` | Fetch general dashboard metrics |
| `useModelPerformance` | `hooks/useModelPerformance.js` | Fetch model performance data |
| `useModels` | `hooks/useModels.js` | Fetch model list and metadata |
| `usePredictions` | `hooks/usePredictions.js` | Fetch prediction data |
| `useRecommendations` | `hooks/useRecommendations.js` | Fetch recommendation data with filters |
| `useURLSync` | `hooks/useURLSync.ts` | Sync filter state with URL query params |

---

## Services

| Service | File | Purpose |
|---------|------|---------|
| `api` | `services/api.js` | Centralized HTTP client with retry logic, auth headers, error handling |
| `cacheService` | `services/cacheService.ts` | Browser-side cache (5 min recommendations, 60 min historical) |
| `monitoring` | `services/monitoring.ts` | CloudWatch metric publishing, Sentry integration |
| `websocket` | `services/websocket.ts` | WebSocket connection manager for real-time updates |

---

## Utilities

| Utility | File | Purpose |
|---------|------|---------|
| `accessibility` | `utils/accessibility.ts` | WCAG helpers: contrast checking, focus trapping, ARIA utilities |
| `accessibilityAudit` | `utils/accessibilityAudit.ts` | axe-core integration for automated accessibility auditing |
| `codeSplitting` | `utils/codeSplitting.ts` | React.lazy wrappers, preloading, tab unloading after 10 min |
| `dataLoader` | `utils/dataLoader.js` | S3 data fetching with caching |
| `s3Config` | `utils/s3Config.js` | AWS S3 client configuration |
| `serviceWorkerRegistration` | `utils/serviceWorkerRegistration.ts` | Service worker setup for offline support |
