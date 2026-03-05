# Design Document: GitHub-Hosted Dashboard

## Overview

This design specifies a static web dashboard hosted on GitHub Pages that provides real-time monitoring and visualization of an ML-based trading system. The dashboard replaces AWS QuickSight with a free, powerful alternative built using React and Recharts, deployed as a static site that reads data directly from S3.

### Key Design Decisions

1. **Static Site Architecture**: The dashboard is built as a static React application that runs entirely in the browser, eliminating the need for backend servers and reducing operational costs to zero for hosting.

2. **Direct S3 Access**: The dashboard uses the AWS SDK for JavaScript to fetch data directly from S3, leveraging CORS configuration and IAM credentials passed via environment variables at build time.

3. **GitHub Pages Deployment**: GitHub Pages provides free, reliable hosting with HTTPS support and global CDN distribution, making it ideal for this use case.

4. **Client-Side Data Processing**: All data aggregation, filtering, and visualization logic runs in the browser, keeping the architecture simple and serverless.

5. **Auto-Refresh Mechanism**: The dashboard implements a client-side polling mechanism that refreshes data every 5 minutes without requiring user intervention.

### Technology Stack

- **Frontend Framework**: React 18.2
- **Visualization Library**: Recharts 2.12 (declarative charting library built on D3)
- **AWS Integration**: AWS SDK for JavaScript v3 (@aws-sdk/client-s3)
- **Date Handling**: date-fns 3.6 (lightweight alternative to moment.js)
- **Icons**: lucide-react 0.460 (modern icon library)
- **Build Tool**: Create React App (react-scripts 5.0.1)
- **Deployment**: GitHub Actions + GitHub Pages

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           GitHub Pages (Static Hosting)                │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │         React Dashboard Application              │  │ │
│  │  │  - Data Fetcher (AWS SDK)                        │  │ │
│  │  │  - Visualization Components (Recharts)           │  │ │
│  │  │  - Auto-Refresh Logic                            │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS (AWS SDK)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS S3 Bucket (CORS)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  recommendations/                                      │ │
│  │    └── YYYY-MM-DD.json                                 │ │
│  │  monitoring/                                           │ │
│  │    ├── model_quality/YYYY-MM-DD.json                   │ │
│  │    └── ingestion/YYYY-MM-DD-HH-MM.json                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      App Component                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              State Management                          │ │
│  │  - recommendations: Array                              │ │
│  │  - qualityData: Array                                  │ │
│  │  - ingestionData: Array                                │ │
│  │  - loading: Boolean                                    │ │
│  │  - error: String | null                                │ │
│  │  - lastUpdated: Date | null                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Data Fetching Layer                       │ │
│  │  - S3Client (AWS SDK)                                  │ │
│  │  - readS3Object(key): Promise<Object>                  │ │
│  │  - listS3Objects(prefix): Promise<Array>               │ │
│  │  - loadRecommendations(): Promise<void>                │ │
│  │  - loadQualityData(): Promise<void>                    │ │
│  │  - loadIngestionData(): Promise<void>                  │ │
│  │  - loadData(): Promise<void>                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Visualization Components                     │ │
│  │  - RecommendationsTable                                │ │
│  │  - ModelQualityPanel (metrics + line chart)            │ │
│  │  - IngestionStatusPanel (metrics + bar chart)          │ │
│  │  - SystemStatusPanel (health indicators)               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  dashboard/                                            │ │
│  │    ├── src/                                            │ │
│  │    ├── public/                                         │ │
│  │    └── package.json                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ git push
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. Checkout code                                      │ │
│  │  2. Setup Node.js                                      │ │
│  │  3. Install dependencies (npm ci)                      │ │
│  │  4. Build React app (npm run build)                    │ │
│  │  5. Deploy to GitHub Pages                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ deploy
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Pages                              │
│  https://<username>.github.io/<repo>/                       │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Data Fetching Components

#### S3Client Configuration

```javascript
const s3Client = new S3Client({
  region: process.env.REACT_APP_AWS_REGION,
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  },
});
```

**Configuration Requirements**:
- Environment variables must be set at build time (not runtime for static sites)
- Credentials should use a dedicated IAM user with read-only S3 access
- CORS must be configured on the S3 bucket to allow requests from GitHub Pages domain

#### Data Fetcher Interface

```javascript
// Read a single S3 object and parse as JSON
async function readS3Object(key: string): Promise<Object | null>

// List S3 objects with a given prefix
async function listS3Objects(prefix: string): Promise<Array<S3Object>>

// Load the most recent recommendations file
async function loadRecommendations(): Promise<void>

// Load quality data for the last 30 days
async function loadQualityData(): Promise<void>

// Load ingestion data for the last 48 hours
async function loadIngestionData(): Promise<void>

// Load all data sources
async function loadData(): Promise<void>
```

### Visualization Components

#### RecommendationsTable

Displays the top 10 stock recommendations in a sortable table format.

**Props**: None (reads from parent state)

**State**: None

**Rendering Logic**:
- Display rank, ticker, score, predicted return, and sector
- Color-code predicted returns (green for positive, red for negative)
- Show rank badges for visual hierarchy
- Handle empty state with appropriate message

#### ModelQualityPanel

Displays current model quality metrics and historical trends.

**Props**: None (reads from parent state)

**State**: None

**Rendering Logic**:
- Display current MAPE, coverage, successful predictions, and total predictions
- Render line chart showing MAPE and coverage trends over last 14 days
- Show warning indicators when MAPE > 15% or coverage < 80%
- Handle empty state with appropriate message

**Chart Configuration**:
- X-axis: Date (formatted as dd/MM)
- Y-axis: Percentage (0-100%)
- Lines: MAPE (red), Coverage (green)
- Tooltip: Show formatted date and percentage values

#### IngestionStatusPanel

Displays data ingestion metrics and execution history.

**Props**: None (reads from parent state)

**State**: None

**Rendering Logic**:
- Calculate and display success rate for last 24 hours
- Display total executions, successful executions, and failed executions
- Render bar chart showing records ingested over last 24 hours
- Show status indicator based on success rate thresholds:
  - Green (healthy): ≥ 90%
  - Yellow (warning): 70-89%
  - Red (critical): < 70%

**Chart Configuration**:
- X-axis: Time (formatted as HH:mm)
- Y-axis: Record count
- Bars: Records ingested (blue)
- Tooltip: Show formatted timestamp and record count

#### SystemStatusPanel

Displays overall system health with status indicators for each subsystem.

**Props**: None (reads from parent state)

**State**: None

**Rendering Logic**:
- Show health indicator for ingestion (based on success rate)
- Show health indicator for model quality (based on MAPE and coverage)
- Show health indicator for recommendations (based on data availability)
- Use icons: CheckCircle (green), AlertTriangle (yellow), XCircle (red)

### Auto-Refresh Mechanism

The dashboard implements automatic data refresh using React's `useEffect` hook:

```javascript
useEffect(() => {
  loadData(); // Initial load
  const interval = setInterval(loadData, 5 * 60 * 1000); // Refresh every 5 minutes
  return () => clearInterval(interval); // Cleanup on unmount
}, []);
```

**Features**:
- Automatic refresh every 5 minutes
- Manual refresh button for immediate updates
- Loading indicator during refresh
- Error handling with fallback to previous data
- Timestamp display for last successful refresh

## Data Models

### Recommendation Data

**S3 Location**: `s3://{bucket}/recommendations/YYYY-MM-DD.json`

**Schema**:
```json
{
  "date": "2024-01-15",
  "generated_at": "2024-01-15T21:45:00Z",
  "recommendations": [
    {
      "rank": 1,
      "ticker": "PETR4",
      "score": 0.85,
      "predicted_return": 0.0234,
      "sector": "Energy"
    }
  ]
}
```

**Field Descriptions**:
- `date`: Trading date for recommendations (ISO 8601 date)
- `generated_at`: Timestamp when recommendations were generated (ISO 8601 datetime)
- `recommendations`: Array of recommendation objects
  - `rank`: Position in ranking (1-based)
  - `ticker`: Stock ticker symbol
  - `score`: Normalized score (0-1)
  - `predicted_return`: Expected return as decimal (0.0234 = 2.34%)
  - `sector`: Industry sector classification

### Model Quality Data

**S3 Location**: `s3://{bucket}/monitoring/model_quality/YYYY-MM-DD.json`

**Schema**:
```json
{
  "dt": "2024-01-15",
  "mape": 0.12,
  "coverage": 0.87,
  "successful_predictions": 245,
  "total_predictions": 282,
  "status": "good"
}
```

**Field Descriptions**:
- `dt`: Date of quality measurement (ISO 8601 date)
- `mape`: Mean Absolute Percentage Error (0-1, lower is better)
- `coverage`: Percentage of successful predictions (0-1)
- `successful_predictions`: Count of predictions within acceptable error
- `total_predictions`: Total count of predictions made
- `status`: Overall status ("good", "warning", "critical")

**Status Calculation**:
- `good`: MAPE ≤ 15% AND coverage ≥ 80%
- `warning`: MAPE > 15% OR coverage < 80%
- `critical`: MAPE > 20% OR coverage < 70%

### Ingestion Data

**S3 Location**: `s3://{bucket}/monitoring/ingestion/YYYY-MM-DD-HH-MM.json`

**Schema**:
```json
{
  "timestamp": "2024-01-15T14:30:00Z",
  "status": "success",
  "records_ingested": 150,
  "execution_time_seconds": 12.5,
  "error_message": null
}
```

**Field Descriptions**:
- `timestamp`: Execution timestamp (ISO 8601 datetime)
- `status`: Execution status ("success" or "error")
- `records_ingested`: Number of records successfully ingested
- `execution_time_seconds`: Duration of ingestion process
- `error_message`: Error details if status is "error", null otherwise

### Configuration Data

**Environment Variables** (set at build time):

```bash
REACT_APP_AWS_REGION=us-east-1
REACT_APP_AWS_ACCESS_KEY_ID=AKIA...
REACT_APP_AWS_SECRET_ACCESS_KEY=...
REACT_APP_S3_BUCKET=b3tr-200093399689-us-east-1
```

**Note**: These are embedded in the built JavaScript bundle and are visible to users. The IAM credentials should have minimal permissions (read-only access to specific S3 paths).


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, I identified several opportunities to consolidate redundant properties:

1. **Status indicator properties (3.5, 3.6, 3.7)** can be combined into a single property that tests the status indicator logic across all threshold ranges.

2. **Warning indicator properties (2.4, 2.5)** can be combined into a single property that tests warning display for both MAPE and coverage thresholds.

3. **Data fetching properties (1.1, 2.1, 3.1)** share similar logic but operate on different data sources, so they remain separate.

4. **Display properties (2.2, 3.3)** test similar rendering behavior but for different metrics, so they remain separate.

### Property 1: Most Recent Recommendation Fetch

For any S3 bucket state containing multiple recommendation files with different timestamps, when the dashboard loads, it should fetch and display data from the file with the most recent LastModified timestamp.

**Validates: Requirements 1.1**

### Property 2: Top 10 Recommendations Display

For any valid recommendation dataset with N recommendations (where N ≥ 10), the dashboard should display exactly 10 recommendations, and each displayed recommendation should include ticker, rank, score, predicted_return, and sector fields.

**Validates: Requirements 1.2**

### Property 3: Return Color Coding

For any recommendation with a predicted_return value, the dashboard should apply green styling when predicted_return ≥ 0 and red styling when predicted_return < 0.

**Validates: Requirements 1.3**

### Property 4: Recommendation Sorting

For any recommendation dataset, the displayed recommendations should be sorted by rank in ascending order (rank 1 first, rank 10 last).

**Validates: Requirements 1.5**

### Property 5: Quality Data Time Window

For any S3 bucket state containing quality data files, when the dashboard loads, it should fetch only files with dates within the last 30 days from the current date.

**Validates: Requirements 2.1**

### Property 6: Quality Metrics Display

For any valid quality data object, the dashboard should display all four metrics: MAPE, coverage, successful_predictions, and total_predictions.

**Validates: Requirements 2.2**

### Property 7: Quality Chart Time Window

For any quality dataset with N days of data (where N ≥ 14), the line chart should display data for exactly the last 14 days.

**Validates: Requirements 2.3**

### Property 8: Quality Warning Indicators

For any quality data object, the dashboard should display a warning indicator if and only if MAPE > 0.15 OR coverage < 0.80.

**Validates: Requirements 2.4, 2.5**

### Property 9: Ingestion Data Time Window

For any S3 bucket state containing ingestion data files, when the dashboard loads, it should fetch only files with timestamps within the last 48 hours from the current time.

**Validates: Requirements 3.1**

### Property 10: Success Rate Calculation

For any ingestion dataset filtered to the last 24 hours, the displayed success rate should equal (count of records with status="success" / total count of records) × 100.

**Validates: Requirements 3.2**

### Property 11: Ingestion Execution Counts

For any ingestion dataset filtered to the last 24 hours, the dashboard should display total executions equal to the dataset length, successful executions equal to the count of status="success" records, and failed executions equal to the count of status="error" records.

**Validates: Requirements 3.3**

### Property 12: Ingestion Chart Time Window

For any ingestion dataset with N hours of data (where N ≥ 24), the bar chart should display data for exactly the last 24 hours.

**Validates: Requirements 3.4**

### Property 13: Ingestion Status Indicators

For any calculated success rate percentage, the dashboard should display:
- Critical indicator (red) when success rate < 70%
- Warning indicator (yellow) when 70% ≤ success rate < 90%
- Healthy indicator (green) when success rate ≥ 90%

**Validates: Requirements 3.5, 3.6, 3.7**

### Property 14: System Status Health Indicators

For any system state, the dashboard should display:
- Green check mark for ingestion when success rate ≥ 90%
- Green check mark for model quality when MAPE ≤ 0.15 AND coverage ≥ 0.80
- Green check mark for recommendations when recommendations.length > 0
- Warning or error icons otherwise

**Validates: Requirements 4.2, 4.3**

### Property 15: Status Update on Refresh

For any data refresh operation that completes successfully, all status indicators should reflect the values from the newly loaded data, not the previous data.

**Validates: Requirements 4.4**

### Property 16: Auto-Refresh Interval

For any dashboard instance, the loadData function should be called automatically at intervals of 5 minutes (300,000 milliseconds) after the initial load.

**Validates: Requirements 5.1**

### Property 17: Timestamp Update on Refresh

For any successful data refresh operation, the displayed lastUpdated timestamp should be set to the current time when the refresh completes.

**Validates: Requirements 5.2**

### Property 18: Loading Indicator Display

For any data fetch operation, the loading indicator should be visible from the moment the fetch starts until the moment it completes (either successfully or with an error).

**Validates: Requirements 5.4**

### Property 19: S3 Client Configuration

For any dashboard initialization, the S3Client should be configured with region, accessKeyId, and secretAccessKey values read from environment variables REACT_APP_AWS_REGION, REACT_APP_AWS_ACCESS_KEY_ID, and REACT_APP_AWS_SECRET_ACCESS_KEY respectively.

**Validates: Requirements 7.1, 7.2**

### Property 20: Credential Validation

For any S3 operation, if the AWS credentials are invalid or missing, the operation should fail and trigger an error state before attempting to fetch data.

**Validates: Requirements 7.3**

### Property 21: Responsive Layout Stacking

For any viewport width < 768px, the dashboard layout should apply vertical stacking styles to visualization components.

**Validates: Requirements 8.4**

### Property 22: Efficient Data Fetching

For any data loading operation, the number of S3 GetObject calls should not exceed:
- 1 for recommendations (most recent file only)
- 30 for quality data (last 30 days)
- 48 for ingestion data (last 48 hours)

**Validates: Requirements 9.2**

### Property 23: Data Caching

For any sequence of data access operations within a single refresh interval (5 minutes), the dashboard should reuse cached data from the initial fetch rather than making redundant S3 requests.

**Validates: Requirements 9.3**

### Property 24: Error Logging

For any error that occurs during data fetching, parsing, or rendering, the dashboard should call console.error with details about the error.

**Validates: Requirements 10.4**

### Property 25: Error State Preservation

For any error that occurs during a data refresh, if previous data exists in state, that previous data should remain displayed in the UI.

**Validates: Requirements 10.5**

## Error Handling

### Error Categories

The dashboard must handle four categories of errors:

1. **Network Errors**: S3 unreachable, timeout, connection failures
2. **Authentication Errors**: Invalid AWS credentials, expired tokens, insufficient permissions
3. **Data Errors**: Malformed JSON, missing required fields, invalid data types
4. **Configuration Errors**: Missing environment variables, invalid bucket names

### Error Handling Strategy

#### Network Errors

```javascript
try {
  const response = await s3Client.send(command);
  // Process response
} catch (error) {
  if (error.name === 'NetworkingError' || error.name === 'TimeoutError') {
    setError('Unable to connect to data source. Please check your internet connection.');
    console.error('Network error:', error);
  }
}
```

**Behavior**:
- Display user-friendly error message
- Preserve previously loaded data if available
- Log detailed error to console for debugging
- Allow manual retry via refresh button

#### Authentication Errors

```javascript
try {
  const response = await s3Client.send(command);
  // Process response
} catch (error) {
  if (error.name === 'CredentialsError' || error.name === 'AccessDenied') {
    setError('Authentication failed. Please check AWS credentials configuration.');
    console.error('Authentication error:', error);
  }
}
```

**Behavior**:
- Display configuration error message
- Do not retry automatically (credentials won't change without rebuild)
- Log detailed error to console
- Provide guidance on checking environment variables

#### Data Errors

```javascript
try {
  const text = await response.Body.transformToString();
  const data = JSON.parse(text);
  
  // Validate required fields
  if (!data.recommendations || !Array.isArray(data.recommendations)) {
    throw new Error('Invalid data format: missing recommendations array');
  }
  
  setRecommendations(data.recommendations);
} catch (error) {
  setError('Data parsing failed. The data format may be invalid.');
  console.error('Data parsing error:', error);
}
```

**Behavior**:
- Validate data structure before using
- Display parsing error message
- Preserve previously loaded data
- Log detailed error with data sample to console

#### Configuration Errors

```javascript
// Check required environment variables at initialization
const requiredEnvVars = [
  'REACT_APP_AWS_REGION',
  'REACT_APP_AWS_ACCESS_KEY_ID',
  'REACT_APP_AWS_SECRET_ACCESS_KEY',
  'REACT_APP_S3_BUCKET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  setError(`Configuration error: Missing environment variables: ${missingVars.join(', ')}`);
  console.error('Missing environment variables:', missingVars);
  return;
}
```

**Behavior**:
- Check configuration at startup
- Display clear error message listing missing variables
- Prevent data fetching attempts
- Provide guidance on setting environment variables

### Error Recovery

The dashboard implements graceful degradation:

1. **Partial Data Loading**: If one data source fails, others continue to load
2. **Stale Data Display**: Previous data remains visible during errors
3. **Manual Retry**: Users can trigger refresh to retry failed operations
4. **Auto-Retry**: Automatic refresh continues on schedule even after errors

### Error UI Components

```javascript
{error && (
  <div className="error-banner">
    <AlertTriangle size={20} />
    <span>{error}</span>
    <button onClick={() => setError(null)}>Dismiss</button>
  </div>
)}
```

**Error Banner Features**:
- Prominent display at top of dashboard
- Icon indicating error severity
- Clear, actionable error message
- Dismissible (error state cleared)
- Does not block access to other dashboard features

## Testing Strategy

### Dual Testing Approach

The dashboard requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both testing approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing

**Library**: fast-check (JavaScript property-based testing library)

**Configuration**: Each property test must run a minimum of 100 iterations to ensure adequate coverage through randomization.

**Test Tagging**: Each property test must include a comment referencing the design document property:

```javascript
// Feature: github-hosted-dashboard, Property 1: Most Recent Recommendation Fetch
it('should fetch the most recent recommendation file', () => {
  fc.assert(
    fc.property(fc.array(s3ObjectArbitrary()), (objects) => {
      // Test implementation
    }),
    { numRuns: 100 }
  );
});
```

### Unit Testing

**Library**: Jest + React Testing Library

**Focus Areas**:
- Specific examples demonstrating correct behavior
- Integration between components
- Edge cases (empty data, missing fields, null values)
- Error conditions (network failures, invalid credentials)

**Balance**: Avoid writing too many unit tests for scenarios that property tests already cover. Focus unit tests on:
- Specific user interactions (button clicks, form submissions)
- Component integration points
- Error boundary behavior
- Specific edge cases identified during development

### Test Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

### Testing Recommendations

1. **Data Fetching**: Mock S3Client responses using jest.mock()
2. **Time-Based Logic**: Use jest.useFakeTimers() for auto-refresh testing
3. **Responsive Design**: Use window.matchMedia mocks for viewport testing
4. **Error Scenarios**: Test all error categories with appropriate mocks
5. **State Management**: Verify state updates after async operations complete

### Example Property Test

```javascript
import fc from 'fast-check';

// Feature: github-hosted-dashboard, Property 10: Success Rate Calculation
describe('Success Rate Calculation', () => {
  it('should calculate success rate correctly for any ingestion dataset', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            timestamp: fc.date(),
            status: fc.constantFrom('success', 'error'),
            records_ingested: fc.nat(),
          })
        ),
        (ingestionData) => {
          // Filter to last 24 hours
          const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recent = ingestionData.filter(d => d.timestamp > cutoff);
          
          if (recent.length === 0) return true; // Skip empty datasets
          
          // Calculate expected success rate
          const successCount = recent.filter(d => d.status === 'success').length;
          const expectedRate = (successCount / recent.length) * 100;
          
          // Render component and extract displayed rate
          const { getByText } = render(<IngestionStatusPanel data={ingestionData} />);
          const displayedRate = parseFloat(getByText(/Taxa de Sucesso/).textContent);
          
          // Verify calculation
          return Math.abs(displayedRate - expectedRate) < 0.1; // Allow for rounding
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Example Unit Test

```javascript
// Feature: github-hosted-dashboard, Manual refresh button interaction
describe('Manual Refresh Button', () => {
  it('should trigger data reload when clicked', async () => {
    const mockLoadData = jest.fn();
    const { getByText } = render(<App loadData={mockLoadData} />);
    
    const refreshButton = getByText('Atualizar');
    fireEvent.click(refreshButton);
    
    expect(mockLoadData).toHaveBeenCalledTimes(1);
  });
});
```

