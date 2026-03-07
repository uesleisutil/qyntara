# Implementation Plan: Model Optimization

## Overview

Este plano implementa um sistema de forecasting otimizado para ações da B3, com ensemble de 4 modelos (DeepAR, LSTM, Prophet, XGBoost), feature engineering avançado, otimização bayesiana de hiperparâmetros, monitoramento de drift, e dashboard interativo completo. O objetivo é reduzir MAPE de 10.5% para abaixo de 7% mantendo cobertura acima de 90%.

**Linguagens**: Python 3.9+ (backend/ML), JavaScript/React 18 (frontend)

**Infraestrutura**: AWS Lambda, SageMaker, S3, SNS

**Priorização**: Feature engineering → Modelos individuais → Ensemble → Monitoramento → Dashboard → Testes

## Tasks

- [x] 1. Setup project structure and core infrastructure
  - Create directory structure for Lambda functions, models, and dashboard
  - Setup Python virtual environment with dependencies (PyTorch, Prophet, XGBoost, Optuna, SHAP, boto3)
  - Configure AWS resources (S3 buckets, SNS topics, IAM roles)
  - Setup React project with dependencies (Recharts, D3.js, Plotly.js, React Query, Zustand, TailwindCSS)
  - Create base interfaces and data schemas
  - _Requirements: All_

- [ ] 2. Implement feature engineering pipeline (Priority 1)
  - [x] 2.1 Create technical indicators calculator
    - Implement RSI, MACD, Bollinger Bands, Stochastic, ATR calculations
    - _Requirements: 3.1_
  
  - [x] 2.2 Create rolling statistics calculator
    - Implement rolling mean, std, min, max for windows [5, 10, 20, 60]
    - Implement EWMA volatility calculation
    - _Requirements: 3.2, 3.4_
  
  - [x] 2.3 Create lag features calculator
    - Implement lag features for periods [1, 2, 3, 5, 10]
    - Implement diff features
    - _Requirements: 3.3_
  
  - [x] 2.4 Create volume features calculator
    - Implement volume ratio, OBV, VWAP calculations
    - _Requirements: 3.5_
  
  - [x] 2.5 Create feature normalizer with robust scaling
    - Implement fit, transform, inverse_transform methods
    - Use median and IQR for robust scaling
    - Implement save/load scaler functionality
    - _Requirements: 3.7_
  
  - [ ]* 2.6 Write property test for complete feature set generation
    - **Property 6: Complete Feature Set Generation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
  
  - [ ]* 2.7 Write property test for robust feature normalization
    - **Property 7: Robust Feature Normalization**
    - **Validates: Requirements 3.7**
  
  - [x] 2.8 Create feature engineering Lambda function
    - Orchestrate all feature calculators
    - Read raw data from S3, write features to S3
    - Handle errors and logging
    - _Requirements: 3.6_

- [x] 3. Implement outlier detection and treatment (Priority 1)
  - [x] 3.1 Create Isolation Forest detector
    - Implement fit and detect methods
    - Calculate anomaly scores
    - _Requirements: 6.1_
  
  - [x] 3.2 Create statistical outlier detector
    - Implement z-score detection (threshold 3.5)
    - Implement IQR detection
    - _Requirements: 6.2_
  
  - [x] 3.3 Create outlier treatment module
    - Implement winsorization at 1st and 99th percentiles
    - Implement interpolation for prediction inputs
    - Create audit logging functionality
    - _Requirements: 6.3, 6.4, 6.5_
  
  - [ ]* 3.4 Write property test for z-score outlier flagging
    - **Property 13: Z-Score Outlier Flagging**
    - **Validates: Requirements 6.2**
  
  - [ ]* 3.5 Write property test for training data outlier treatment
    - **Property 14: Training Data Outlier Treatment**
    - **Validates: Requirements 6.3**
  
  - [ ]* 3.6 Write property test for prediction input outlier handling
    - **Property 15: Prediction Input Outlier Handling**
    - **Validates: Requirements 6.4**
  
  - [ ]* 3.7 Write property test for outlier audit trail
    - **Property 16: Outlier Audit Trail**
    - **Validates: Requirements 6.5**

- [x] 4. Implement missing data handler (Priority 1)
  - [x] 4.1 Create missing data analyzer
    - Calculate missing percentage per stock
    - Identify missing patterns
    - _Requirements: 11.4_
  
  - [x] 4.2 Create interpolation handler
    - Implement forward fill for < 5% missing
    - Implement linear interpolation for 5-20% missing
    - Implement exclusion logic for > 20% missing
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [x] 4.3 Create data validator
    - Validate completeness before feature calculation
    - Validate schema
    - Log validation results
    - _Requirements: 11.5_
  
  - [ ]* 4.4 Write property test for missing data treatment strategy
    - **Property 29: Missing Data Treatment Strategy**
    - **Validates: Requirements 11.1, 11.2, 11.3**
  
  - [ ]* 4.5 Write property test for missing data logging
    - **Property 30: Missing Data Logging**
    - **Validates: Requirements 11.4**
  
  - [ ]* 4.6 Write property test for data completeness validation order
    - **Property 31: Data Completeness Validation Order**
    - **Validates: Requirements 11.5**

- [x] 5. Checkpoint - Validate feature engineering pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement DeepAR model wrapper (Priority 2)
  - [x] 6.1 Create DeepAR model wrapper class
    - Implement train method with SageMaker integration
    - Implement predict method
    - Implement get_prediction_intervals with quantiles
    - _Requirements: 4.1_

- [x] 7. Implement LSTM model (Priority 2)
  - [x] 7.1 Create LSTM PyTorch model
    - Define LSTM architecture with configurable layers
    - Implement forward pass
    - _Requirements: 4.1_
  
  - [x] 7.2 Create LSTM training module
    - Implement train_model with DataLoader
    - Implement early stopping
    - Implement save/load model functionality
    - _Requirements: 4.1_
  
  - [x] 7.3 Create LSTM prediction module
    - Implement predict method
    - Handle batch predictions
    - _Requirements: 4.1_

- [x] 8. Implement Prophet model wrapper (Priority 2)
  - [x] 8.1 Create Prophet model wrapper class
    - Implement train method with hyperparameters
    - Implement predict method
    - Implement get_prediction_intervals
    - _Requirements: 4.1_

- [x] 9. Implement XGBoost model wrapper (Priority 2)
  - [x] 9.1 Create XGBoost model wrapper class
    - Implement train method with hyperparameters
    - Implement predict method
    - Implement get_feature_importance
    - Implement save/load model functionality
    - _Requirements: 4.1_

- [x] 10. Implement hyperparameter optimization (Priority 2)
  - [x] 10.1 Create Optuna optimizer for each model type
    - Define search spaces for DeepAR, LSTM, Prophet, XGBoost
    - Implement objective function with walk-forward validation
    - Configure minimum 50 trials
    - _Requirements: 5.1, 5.3_
  
  - [x] 10.2 Create walk-forward validator
    - Implement split_data with 12-month train, 1-month test, 1-month step
    - Implement validate method
    - Implement aggregate_metrics
    - _Requirements: 5.3, 8.1, 8.2, 8.3_
  
  - [x] 10.3 Create hyperparameter optimization Lambda function
    - Orchestrate optimization for each model independently
    - Save best parameters to S3
    - Implement timeout handling (24 hours)
    - _Requirements: 5.2, 5.4, 5.6_
  
  - [ ]* 10.4 Write property test for bayesian optimization minimum trials
    - **Property 10: Bayesian Optimization Minimum Trials**
    - **Validates: Requirements 5.1, 5.3**
  
  - [ ]* 10.5 Write property test for independent model optimization
    - **Property 11: Independent Model Optimization**
    - **Validates: Requirements 5.2**
  
  - [ ]* 10.6 Write property test for hyperparameter persistence
    - **Property 12: Hyperparameter Persistence**
    - **Validates: Requirements 5.4**
  
  - [ ]* 10.7 Write property test for walk-forward validation configuration
    - **Property 20: Walk-Forward Validation Configuration**
    - **Validates: Requirements 8.1, 8.2**
  
  - [ ]* 10.8 Write property test for validation fold retraining
    - **Property 21: Validation Fold Retraining**
    - **Validates: Requirements 8.3**
  
  - [ ]* 10.9 Write property test for validation metrics aggregation
    - **Property 22: Validation Metrics Aggregation**
    - **Validates: Requirements 8.4, 8.5**

- [x] 11. Implement model training Lambda function (Priority 2)
  - [x] 11.1 Create ensemble training orchestrator
    - Train all 4 models in parallel
    - Save model artifacts to S3 with versioning
    - Calculate validation metrics for each model
    - _Requirements: 4.1, 12.5_

- [x] 12. Checkpoint - Validate individual models
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement ensemble manager (Priority 3)
  - [x] 13.1 Create ensemble manager class
    - Implement train_all method
    - Implement predict_all method
    - Load models from S3
    - _Requirements: 4.1_
  
  - [x] 13.2 Create dynamic weight calculator
    - Calculate weights based on historical MAPE
    - Implement monthly weight recalculation with 3-month window
    - Adjust weights when MAPE differs > 20%
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [x] 13.3 Create weighted average combiner
    - Combine predictions using calculated weights
    - _Requirements: 4.2_
  
  - [x] 13.4 Create prediction interval generator
    - Generate ensemble intervals using quantile regression
    - Implement conformal prediction calibration
    - Minimize width while maintaining 90% coverage
    - _Requirements: 4.5, 10.1, 10.2, 10.5_
  
  - [ ]* 13.5 Write property test for weighted ensemble combination
    - **Property 8: Weighted Ensemble Combination**
    - **Validates: Requirements 4.2, 4.5, 10.1**
  
  - [ ]* 13.6 Write property test for dynamic weight adjustment
    - **Property 9: Dynamic Weight Adjustment**
    - **Validates: Requirements 4.3**
  
  - [ ]* 13.7 Write property test for interval width optimization
    - **Property 26: Interval Width Optimization**
    - **Validates: Requirements 10.2**
  
  - [ ]* 13.8 Write property test for interval width measurement
    - **Property 27: Interval Width Measurement**
    - **Validates: Requirements 10.3**
  
  - [ ]* 13.9 Write property test for interval tightening trigger
    - **Property 28: Interval Tightening Trigger**
    - **Validates: Requirements 10.4, 10.5**

- [x] 14. Implement ensemble prediction Lambda function (Priority 3)
  - [x] 14.1 Create prediction orchestrator
    - Load all models and calculate ensemble prediction
    - Generate prediction intervals
    - Save predictions to S3
    - Handle errors and retries
    - _Requirements: 4.1, 4.2, 4.5_

- [x] 15. Implement performance monitoring (Priority 4)
  - [x] 15.1 Create metrics calculator
    - Implement MAPE, MAE, RMSE calculations
    - Implement coverage calculation
    - Implement interval width calculation
    - Calculate per-stock, per-sector, and overall metrics
    - _Requirements: 1.3, 2.2, 7.1, 10.3, 13.2_
  
  - [ ]* 15.2 Write property test for ensemble MAPE target achievement
    - **Property 1: Ensemble MAPE Target Achievement**
    - **Validates: Requirements 1.1, 1.3**
  
  - [ ]* 15.3 Write property test for top performer distribution
    - **Property 2: Top Performer Distribution**
    - **Validates: Requirements 1.2**
  
  - [ ]* 15.4 Write property test for coverage maintenance
    - **Property 4: Coverage Maintenance**
    - **Validates: Requirements 2.1, 2.2**
  
  - [ ]* 15.5 Write property test for multi-level metrics aggregation
    - **Property 35: Multi-Level Metrics Aggregation**
    - **Validates: Requirements 13.2**
  
  - [ ]* 15.6 Write property test for time series metrics reporting
    - **Property 36: Time Series Metrics Reporting**
    - **Validates: Requirements 13.3**

- [x] 16. Implement drift detection (Priority 4)
  - [x] 16.1 Create performance drift detector
    - Compare current MAPE vs baseline (30-day rolling window)
    - Detect drift when MAPE increases > 20%
    - _Requirements: 7.2, 7.3_
  
  - [x] 16.2 Create feature drift detector
    - Implement Kolmogorov-Smirnov test for each feature
    - Detect drift when p-value < 0.05
    - _Requirements: 7.4, 7.5_
  
  - [x] 16.3 Create alert manager
    - Send SNS alerts for performance drift
    - Send SNS alerts for feature drift
    - Trigger retraining on drift detection
    - _Requirements: 7.3, 7.5_
  
  - [ ]* 16.4 Write property test for automatic retraining trigger
    - **Property 3: Automatic Retraining Trigger**
    - **Validates: Requirements 1.4**
  
  - [ ]* 16.5 Write property test for coverage alert trigger
    - **Property 5: Coverage Alert Trigger**
    - **Validates: Requirements 2.3**
  
  - [ ]* 16.6 Write property test for rolling window MAPE comparison
    - **Property 17: Rolling Window MAPE Comparison**
    - **Validates: Requirements 7.2**
  
  - [ ]* 16.7 Write property test for performance drift alert
    - **Property 18: Performance Drift Alert**
    - **Validates: Requirements 7.3**
  
  - [ ]* 16.8 Write property test for feature distribution drift detection
    - **Property 19: Feature Distribution Drift Detection**
    - **Validates: Requirements 7.4, 7.5**

- [x] 17. Implement stock ranking (Priority 4)
  - [x] 17.1 Create stock ranker
    - Rank stocks by MAPE in ascending order
    - Identify top 10 performers
    - Calculate ranking stability using Spearman correlation
    - Trigger investigation when correlation < 0.7
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ]* 17.2 Write property test for stock ranking by MAPE
    - **Property 23: Stock Ranking by MAPE**
    - **Validates: Requirements 9.1, 9.2**
  
  - [ ]* 17.3 Write property test for ranking stability measurement
    - **Property 24: Ranking Stability Measurement**
    - **Validates: Requirements 9.3**
  
  - [ ]* 17.4 Write property test for ranking instability investigation trigger
    - **Property 25: Ranking Instability Investigation Trigger**
    - **Validates: Requirements 9.4**

- [x] 18. Implement monitoring Lambda function (Priority 4)
  - [x] 18.1 Create monitoring orchestrator
    - Calculate daily metrics
    - Detect performance and feature drift
    - Send alerts via SNS
    - Save metrics to S3
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 13.1_

- [x] 19. Checkpoint - Validate monitoring pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Implement model explainability (Priority 4)
  - [x] 20.1 Create SHAP explainer
    - Calculate SHAP values for top 10 features
    - Aggregate feature importance across predictions
    - _Requirements: 15.1, 15.3_
  
  - [x] 20.2 Create ensemble contribution analyzer
    - Identify dominant model for each prediction
    - Calculate model contributions
    - Provide breakdown for high uncertainty predictions
    - _Requirements: 15.2, 15.5_
  
  - [ ]* 20.3 Write property test for SHAP feature importance
    - **Property 41: SHAP Feature Importance**
    - **Validates: Requirements 15.1**
  
  - [ ]* 20.4 Write property test for dominant model identification
    - **Property 42: Dominant Model Identification**
    - **Validates: Requirements 15.2**
  
  - [ ]* 20.5 Write property test for top features reporting
    - **Property 43: Top Features Reporting**
    - **Validates: Requirements 15.4**
  
  - [ ]* 20.6 Write property test for high uncertainty explanation
    - **Property 44: High Uncertainty Explanation**
    - **Validates: Requirements 15.5**

- [x] 21. Implement retraining pipeline (Priority 4)
  - [x] 21.1 Create retraining orchestrator
    - Trigger monthly retraining on first day of month
    - Trigger emergency retraining within 4 hours of drift alert
    - Validate retrained models using walk-forward validation
    - Deploy or rollback based on performance comparison
    - Maintain version history
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [ ]* 21.2 Write property test for retrained model validation
    - **Property 32: Retrained Model Validation**
    - **Validates: Requirements 12.3**
  
  - [ ]* 21.3 Write property test for model rollback on degradation
    - **Property 33: Model Rollback on Degradation**
    - **Validates: Requirements 12.4**
  
  - [ ]* 21.4 Write property test for model version history
    - **Property 34: Model Version History**
    - **Validates: Requirements 12.5**

- [x] 22. Implement data augmentation (Priority 4)
  - [x] 22.1 Create data augmentation module
    - Detect datasets with < 500 observations
    - Apply jittering with 5% noise
    - Apply window slicing with 80% overlap
    - Limit augmented data to 2x original size
    - Validate statistical properties preservation
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [ ]* 22.2 Write property test for data augmentation trigger
    - **Property 37: Data Augmentation Trigger**
    - **Validates: Requirements 14.1**
  
  - [ ]* 22.3 Write property test for augmentation methods
    - **Property 38: Augmentation Methods**
    - **Validates: Requirements 14.2, 14.3**
  
  - [ ]* 22.4 Write property test for augmentation size limit
    - **Property 39: Augmentation Size Limit**
    - **Validates: Requirements 14.4**
  
  - [ ]* 22.5 Write property test for augmentation statistical preservation
    - **Property 40: Augmentation Statistical Preservation**
    - **Validates: Requirements 14.5**

- [ ] 23. Implement dashboard API Lambda (Priority 5)
  - [x] 23.1 Create dashboard API class
    - Implement get_performance_metrics endpoint
    - Implement get_model_comparison endpoint
    - Implement get_feature_importance endpoint
    - Implement get_drift_status endpoint
    - Implement get_ensemble_weights endpoint
    - Implement get_prediction_details endpoint
    - Implement get_hyperparameter_history endpoint
    - _Requirements: 13.1, 13.3, 13.4, 13.5_
  
  - [x] 23.2 Create API Lambda handler
    - Route requests to appropriate API methods
    - Handle CORS
    - Implement error handling and logging
    - _Requirements: 13.1_

- [x] 24. Implement dashboard React components - Charts (Priority 5)
  - [x] 24.1 Create MAPETimeSeriesChart component
    - Multi-line chart with ensemble and individual models
    - Confidence bands, zoom/pan, hover tooltips
    - Threshold line at 7% target
    - _Requirements: 13.3_
  
  - [x] 24.2 Create ModelComparisonChart component
    - Radar chart comparing 4 models across metrics
    - Interactive highlighting and tooltips
    - _Requirements: 13.3_
  
  - [x] 24.3 Create FeatureImportanceChart component
    - Horizontal bar chart with SHAP values
    - Color-coded by feature category
    - Click to see feature distribution
    - _Requirements: 13.3, 15.3_
  
  - [x] 24.4 Create DriftDetectionChart component
    - Heatmap showing KS test p-values over time
    - Color-coded by drift status
    - Click cell for distribution comparison
    - _Requirements: 13.3_
  
  - [x] 24.5 Create PredictionIntervalChart component
    - Fan chart with 50%, 80%, 95% confidence intervals
    - Show actual values and point forecast
    - Hover for exact values and coverage
    - _Requirements: 13.3_
  
  - [x] 24.6 Create EnsembleWeightsChart component
    - Stacked area chart showing weight evolution
    - Click for weight calculation details
    - _Requirements: 13.3_
  
  - [x] 24.7 Create StockRankingChart component
    - Bump chart showing ranking changes over time
    - Top 20 stocks by MAPE
    - Click stock for detailed metrics
    - _Requirements: 13.3, 13.5_

- [x] 25. Implement dashboard React components - Panels (Priority 5)
  - [x] 25.1 Create ModelPerformancePanel component
    - Display metric cards (MAPE, coverage, interval width, top performers)
    - Integrate MAPETimeSeriesChart and ModelComparisonChart
    - Add stock and date range filters
    - _Requirements: 13.1, 13.2, 13.3_
  
  - [x] 25.2 Create EnsembleInsightsPanel component
    - Display current weights and contributions
    - Show prediction breakdown table
    - Integrate EnsembleWeightsChart and pie chart
    - _Requirements: 13.3_
  
  - [x] 25.3 Create FeatureAnalysisPanel component
    - Tabs for feature importance, distributions, correlations
    - Integrate FeatureImportanceChart and heatmap
    - Add stock and date filters
    - _Requirements: 13.3, 15.3_
  
  - [x] 25.4 Create DriftMonitoringPanel component
    - Display drift summary with status badges
    - Show performance and feature drift charts
    - Display drift events timeline
    - Add alerts-only toggle
    - _Requirements: 13.3_
  
  - [x] 25.5 Create ExplainabilityPanel component
    - Display recent predictions selector
    - Show SHAP waterfall chart
    - Display feature values table with contributions
    - _Requirements: 13.3, 13.5, 15.1, 15.2_
  
  - [x] 25.6 Create HyperparameterPanel component
    - Display hyperparameter history per model
    - Show optimization progress and best trials
    - _Requirements: 13.3_

- [x] 26. Implement dashboard React components - Shared (Priority 5)
  - [x] 26.1 Create filter components
    - StockSelector with search and autocomplete
    - DateRangePicker with presets
    - ModelSelector with multi-select
    - MetricSelector dropdown
    - _Requirements: 13.5_
  
  - [x] 26.2 Create shared UI components
    - LoadingSpinner with animations
    - ErrorBoundary for error handling
    - Tooltip component
    - Card component with consistent styling
    - _Requirements: 13.3_

- [x] 27. Implement dashboard custom hooks (Priority 5)
  - [x] 27.1 Create useMetrics hook
    - Fetch metrics with React Query
    - Auto-refresh every 30 seconds
    - Handle loading and error states
    - _Requirements: 13.1_
  
  - [x] 27.2 Create usePredictions hook
    - Fetch predictions with caching
    - Filter by stock and date range
    - _Requirements: 13.1_
  
  - [x] 27.3 Create useModels hook
    - Fetch model metadata and comparison data
    - Cache model information
    - _Requirements: 13.1_
  
  - [x] 27.4 Create useDrift hook
    - Fetch drift status with auto-refresh
    - Provide manual refresh function
    - _Requirements: 13.1_
  
  - [x] 27.5 Create useExplainability hook
    - Fetch SHAP values and feature importance
    - Handle prediction-specific queries
    - _Requirements: 13.1_

- [x] 28. Implement dashboard state management (Priority 5)
  - [x] 28.1 Create Zustand store
    - Manage selected stock, date range, models
    - Manage theme and UI preferences
    - Provide actions for state updates
    - _Requirements: 13.3_

- [x] 29. Implement dashboard main app (Priority 5)
  - [x] 29.1 Create main dashboard layout
    - Setup routing for different panels
    - Integrate all panels into main view
    - Add navigation and header
    - Apply TailwindCSS styling
    - _Requirements: 13.1, 13.3_
  
  - [x] 29.2 Setup API integration
    - Configure fetch client with base URL
    - Implement error handling and retries
    - Setup React Query provider
    - _Requirements: 13.1_

- [x] 30. Checkpoint - Validate dashboard functionality
  - Ensure all tests pass, ask the user if questions arise.

- [x] 31. Integration and deployment
  - [x] 31.1 Wire all Lambda functions together
    - Setup EventBridge rules for scheduled executions
    - Configure SNS topic subscriptions
    - Setup S3 event triggers
    - _Requirements: All_
  
  - [x] 31.2 Create deployment scripts
    - Package Lambda functions with dependencies
    - Deploy to AWS using SAM or Terraform
    - Configure environment variables
    - _Requirements: All_
  
  - [x] 31.3 Setup monitoring and logging
    - Configure CloudWatch logs for all Lambdas
    - Setup CloudWatch alarms for errors
    - Create CloudWatch dashboard
    - _Requirements: 13.1_

- [x] 32. Final checkpoint - End-to-end validation
  - Run complete pipeline with real B3 data
  - Validate MAPE < 7% and coverage > 90%
  - Verify dashboard displays all metrics correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties (44 total)
- Unit tests should be added for critical business logic
- Use LocalStack for local AWS service testing during development
- Dashboard should be deployed to S3 + CloudFront for production
- All Lambda functions should have appropriate timeout and memory configurations
- Consider using Step Functions for complex orchestration workflows
