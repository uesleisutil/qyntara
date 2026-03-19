# Changelog

All notable changes to the B3 Tactical Ranking project are documented in this file.

## [2.0.1] — 2026-03-15

Launch and onboarding release with user adoption tracking and feedback collection.

### Added
- In-app feedback widget (rating + comments) accessible from Help menu
- User adoption tracking service (DAU, session duration, feature usage, retention)
- Backend feedback submission endpoint (`/api/feedback`)
- Launch announcement email template (`docs/launch/announcement-email.html`)
- User guide documentation (`docs/USER_GUIDE.md`)
- Launch monitoring runbook (`docs/runbooks/launch-monitoring.md`)
- Release notes component in Help menu

### Changed
- Extended HelpMenu with Feedback and Release Notes options
- Extended dashboard API handler with feedback route

---

## [2.0.0] — 2026-03-12

Major dashboard enhancement release. Expanded from 4 tabs to 8 tabs with comprehensive MLOps monitoring capabilities.

### Added

**New Dashboard Tabs**
- Data Quality tab: completeness monitoring, anomaly detection, freshness indicators, universe coverage
- Drift Detection tab: data drift (KS test), concept drift, performance degradation alerts, retraining recommendations
- Explainability tab: SHAP value waterfall charts, sensitivity analysis, feature impact visualization
- Backtesting tab: historical strategy simulation, walk-forward analysis, risk metrics (VaR, CVaR, max drawdown)

**Enhanced Existing Tabs**
- Recommendations: sector/score/return filters, ticker detail modal, multi-ticker comparison (up to 5), configurable alerts, CSV/Excel/PDF export
- Performance: individual model breakdown, confusion matrix, error distribution histogram, benchmark comparison (Ibovespa), feature importance charts, goal progress bars
- Validation: predicted vs actual scatter plot, temporal accuracy analysis, performance segmentation by return range, outlier analysis (3σ)
- Costs: cost trend visualization (stacked area), cost-per-prediction metric, budget alert indicators (80%/100% thresholds), optimization suggestions, ROI calculator

**Advanced Visualizations**
- Candlestick charts with volume (D3.js)
- Sparklines in tables (30-day trends)
- Heatmaps for correlation and drift
- Waterfall charts for SHAP values
- Sankey diagrams for data flow
- Status badges with color coding
- Temporal comparison mode (day/week/month/quarter/year)

**UX Enhancements**
- Cross-filtering across charts
- Chart zoom and pan (mouse wheel, pinch-to-zoom, box-select)
- User annotations on time series charts (persisted in DynamoDB)
- Notification center with unread badge and severity categories
- Email and SMS alert integration via SNS
- System health indicator (green/yellow/red)
- Real-time updates via WebSocket
- Skeleton loading screens with shimmer animation
- Lazy loading for tabs with 10-minute unload
- Intelligent browser caching (5 min recommendations, 60 min historical, 50 MB limit)
- Table pagination (25/50/100/200 rows per page)
- Service worker for offline support

**Accessibility (WCAG 2.1 Level AA)**
- Full keyboard navigation
- Screen reader support (ARIA landmarks, live regions, chart descriptions)
- Adjustable font sizes (small/medium/large/extra-large)
- Contrast ratio compliance (4.5:1 normal, 3:1 large text)
- Skip navigation links
- Comprehensive metric tooltips with definitions and formulas

**Help System**
- Guided tour for new users (react-joyride)
- Searchable FAQ (30+ entries)
- Technical glossary (100+ terms)

**Integration Features**
- REST API with 15+ endpoints (see docs/API.md)
- API key authentication with rate limiting (1,000 req/hour)
- OpenAPI 3.0 documentation
- Webhook system for event notifications (drift, degradation, cost alerts)
- Automated PDF report generation (weekly/monthly)
- Excel and Google Sheets export

**Security**
- AWS Cognito authentication (SAML/OAuth SSO)
- Role-based access control (admin/analyst/viewer)
- API key rotation (90-day policy)
- TLS 1.3 encryption in transit
- S3 encryption at rest
- CSRF protection and XSS input sanitization
- Security audit (OWASP Top 10)

**Infrastructure**
- ElastiCache Redis caching layer
- CloudFront CDN with compression
- CloudWatch monitoring and alarms
- Sentry error tracking (frontend + backend)
- S3 lifecycle policies (IA at 90 days, Glacier at 365 days)
- Lambda optimization (connection pooling, parallel processing)
- Disaster recovery (cross-region backups, RTO 4h, RPO 24h)

**Testing**
- Unit tests with Jest and React Testing Library
- Property-based tests with fast-check
- E2E tests with Playwright
- Load testing with k6 (1,000 concurrent users)
- Lighthouse CI performance audits
- Visual regression testing
- Browser compatibility testing (Chrome, Firefox, Safari, Edge)

### Changed
- Migrated frontend to TypeScript
- Upgraded to React 18 with concurrent rendering
- Replaced inline SVG charts with Recharts + D3.js
- Replaced basic tables with TanStack Table v8
- Added Tailwind CSS for styling alongside MUI
- Upgraded React Query to v5
- Restructured component directory by feature

### Infrastructure
- Added monitoring-stack.ts (CloudWatch dashboards and alarms)
- Added security-stack.ts (WAF, Cognito, encryption)
- Added optimization-stack.ts (ElastiCache, CloudFront, Lambda tuning)
- Added disaster-recovery-stack.ts (cross-region backups, health checks)

---

## [1.0.0] — 2025-01-15

Initial release of the B3 Tactical Ranking system.

### Added
- ML ensemble model for stock ranking (XGBoost, LightGBM, DeepAR)
- 50+ technical features (RSI, MACD, Bollinger Bands, ATR, etc.)
- Walk-forward validation (5 splits)
- Automatic feature selection (top 30)
- In-memory inference (no SageMaker endpoints)
- Basic dashboard with 4 tabs (Recommendations, Performance, Validation, Costs)
- Automated daily ranking at 18:10 BRT
- Prediction validation at 19:30 BRT
- Cost monitoring at 20:00 BRT
- SageMaker instance monitoring (every 5 min)
- Drift detection with SNS alerts
- AWS CDK infrastructure
- GitHub Pages deployment
