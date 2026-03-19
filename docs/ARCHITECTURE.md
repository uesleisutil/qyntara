# Architecture Decision Records

This document captures the key architecture decisions for the B3 Tactical Ranking MLOps Dashboard.

---

## ADR-001: React 18 + TypeScript for Frontend

**Status:** Accepted

**Context:** The dashboard requires a rich, interactive UI with 8 tabs, complex visualizations, real-time updates, and accessibility compliance.

**Decision:** Use React 18 with TypeScript for the frontend application.

**Rationale:**
- React 18 provides concurrent rendering for smooth UI updates during heavy data processing
- TypeScript catches type errors at compile time, critical for a data-heavy dashboard
- Large ecosystem of compatible charting and table libraries
- React's component model maps well to the tab-based architecture
- Existing team familiarity with React

**Consequences:**
- Bundle size is larger than lighter frameworks (mitigated by code splitting)
- TypeScript adds compilation step but reduces runtime errors

---

## ADR-002: Recharts + D3.js for Visualizations

**Status:** Accepted

**Context:** The dashboard needs diverse chart types: line charts, bar charts, scatter plots, heatmaps, candlestick charts, waterfall charts, Sankey diagrams, and sparklines.

**Decision:** Use Recharts as the primary charting library with D3.js for custom visualizations.

**Rationale:**
- Recharts provides declarative React components for common chart types (line, bar, area, scatter)
- D3.js handles specialized charts (candlestick, Sankey, waterfall) that Recharts doesn't support
- Plotly.js supplements for interactive 3D and statistical charts
- Recharts is built on D3 primitives, so styling is consistent
- D3.js gives full control over SVG rendering for custom visualizations

**Consequences:**
- Two charting paradigms (declarative Recharts vs imperative D3) require different mental models
- D3 charts need manual React lifecycle management
- Bundle includes multiple charting libraries (mitigated by code splitting heavy libraries into separate chunks)

---

## ADR-003: TanStack Table v8 for Data Tables

**Status:** Accepted

**Context:** The dashboard displays large datasets (500+ tickers) in sortable, filterable, paginated tables with inline sparklines and virtual scrolling.

**Decision:** Use TanStack Table v8 for all data tables.

**Rationale:**
- Headless design allows full control over rendering and styling
- Built-in sorting, filtering, pagination, and column resizing
- Virtual scrolling support for large datasets without DOM bloat
- TypeScript-first API with strong type inference
- Framework-agnostic core with React adapter

**Consequences:**
- More boilerplate than opinionated table libraries (trade-off for flexibility)
- Requires custom rendering for all table UI elements

---

## ADR-004: State Management — React Context + React Query + URL State

**Status:** Accepted

**Context:** The dashboard needs to manage UI state (theme, layout), server state (API data), filter state (shared across tabs), and shareable URLs.

**Decision:** Use a three-layer state management approach:
1. **React Context** for UI state (theme, auth, notifications, layout preferences)
2. **React Query** for server state (API data fetching, caching, background refetching)
3. **URL query parameters** for filter state (enables shareable/bookmarkable views)

**Rationale:**
- React Context is sufficient for low-frequency UI state updates
- React Query handles caching, deduplication, background refetching, and stale-while-revalidate patterns
- URL state makes filter configurations shareable and supports browser back/forward
- Avoids introducing Redux or other heavy state management libraries
- Each layer has clear responsibilities with no overlap

**Consequences:**
- Multiple state sources require clear conventions about where state lives
- Context re-renders can affect performance if not properly memoized (mitigated with `useMemo` and context splitting)

---

## ADR-005: AWS Lambda Backend (Serverless)

**Status:** Accepted

**Context:** The backend processes ML predictions, serves API requests, monitors data quality, and handles webhooks. Traffic is bursty (concentrated around market hours).

**Decision:** Use AWS Lambda functions behind API Gateway for all backend compute.

**Rationale:**
- Pay-per-invocation pricing keeps costs under $1/month for typical usage
- No server management or capacity planning
- Automatic scaling handles traffic spikes during market hours
- Each Lambda function has a single responsibility (ranking, monitoring, backtesting, etc.)
- Cold start latency is acceptable for dashboard use cases (not real-time trading)

**Key Lambda Functions:**
- `dashboard_api.py` — Dashboard data serving
- `rest_api.py` — Public REST API
- `backtesting_api.py` — Backtesting simulation
- `rank_sagemaker.py` — Daily recommendation generation
- `train_sagemaker.py` — Model training orchestration
- `monitor_drift.py` — Drift detection
- `monitor_costs.py` — Cost monitoring
- `data_quality.py` — Data quality checks
- `webhook_management.py` — Webhook delivery
- `security_middleware.py` — Auth and rate limiting

**Consequences:**
- Cold starts add 1–3 seconds on first invocation (mitigated by provisioned concurrency for critical paths)
- 15-minute execution limit constrains long-running backtests (mitigated by chunking)
- Debugging distributed Lambda functions requires structured logging and tracing

---

## ADR-006: ElastiCache Redis for Caching

**Status:** Accepted

**Context:** API responses for recommendations, performance metrics, and monitoring data are expensive to compute but change infrequently (every 5–60 minutes).

**Decision:** Use ElastiCache Redis as a server-side caching layer between Lambda and data stores.

**Rationale:**
- Sub-millisecond read latency for cached responses
- TTL-based expiration aligns with data freshness requirements (5 min for recommendations, 60 min for historical)
- Reduces S3 read costs and Lambda execution time
- Shared cache across all Lambda invocations (unlike in-memory caching)

**Cache Strategy:**
- Recommendations: 5-minute TTL
- Historical/performance data: 60-minute TTL
- Static reference data: 24-hour TTL
- Manual refresh invalidates relevant cache keys

**Consequences:**
- Additional infrastructure cost (~$15/month for cache.t3.micro)
- Cache invalidation complexity when data updates
- VPC configuration required for Lambda-to-ElastiCache connectivity

---

## ADR-007: S3 for Data Storage with Lifecycle Policies

**Status:** Accepted

**Context:** The system stores daily recommendations, model artifacts, monitoring metrics, and historical data. Data volume grows linearly over time.

**Decision:** Use S3 as the primary data store with lifecycle policies for cost optimization.

**Rationale:**
- Virtually unlimited storage at low cost
- Native integration with Lambda and SageMaker
- Lifecycle policies automate tiering: Standard → Infrequent Access (90 days) → Glacier (365 days) → Delete (3 years)
- Partitioning by date (`dt=YYYY-MM-DD/`) enables efficient queries
- Parquet format for large datasets reduces storage and improves read performance

**Consequences:**
- No query engine (requires Lambda to read and filter data)
- Eventually consistent reads (acceptable for dashboard use case)
- Cross-region replication needed for disaster recovery

---

## ADR-008: Error Handling Strategy

**Status:** Accepted

**Context:** The dashboard must gracefully handle API failures, data quality issues, and network problems without crashing.

**Decision:** Implement a multi-layer error handling strategy:

1. **API Client Layer** (`services/api.js`): Automatic retry with exponential backoff (3 retries for 5xx errors, no retry for 4xx)
2. **React Query Layer**: `staleWhileRevalidate` shows cached data while refetching; `onError` callbacks for user notifications
3. **Component Layer**: Error boundaries catch rendering errors; fallback UI shows error state with retry button
4. **Service Worker**: Serves cached responses when offline; displays staleness indicator

**Consequences:**
- Users see stale data rather than error screens in most failure scenarios
- Retry logic can mask persistent backend issues (mitigated by monitoring and alerting)

---

## ADR-009: Authentication — AWS Cognito with RBAC

**Status:** Accepted

**Context:** The dashboard needs enterprise SSO integration, role-based access control, and API key management.

**Decision:** Use AWS Cognito for authentication with three roles: admin, analyst, viewer.

**Role Permissions:**
- **Viewer**: Read-only access to all tabs
- **Analyst**: Viewer + export, alerts, annotations, backtesting
- **Admin**: Analyst + settings, API key management, webhook configuration, user management

**Consequences:**
- Cognito handles SAML/OAuth federation with enterprise identity providers
- Session timeout at 60 minutes of inactivity
- API keys (for programmatic access) stored hashed in DynamoDB with 90-day rotation

---

## ADR-010: Monitoring and Observability

**Status:** Accepted

**Context:** The system needs comprehensive monitoring for both infrastructure health and business metrics.

**Decision:** Use CloudWatch for infrastructure monitoring and Sentry for frontend error tracking.

**Monitoring Layers:**
- **CloudWatch Metrics**: Lambda duration, error rates, API latency, custom business metrics
- **CloudWatch Alarms**: Threshold-based alerts sent to SNS
- **CloudWatch Dashboards**: System health overview
- **Sentry**: Frontend JavaScript error tracking with source maps
- **Frontend Monitoring**: Page load time, time to interactive, Core Web Vitals

**Consequences:**
- CloudWatch costs scale with metric volume (mitigated by sampling)
- Sentry adds ~15KB to frontend bundle
