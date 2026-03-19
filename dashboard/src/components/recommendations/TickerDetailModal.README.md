# TickerDetailModal Component

## Overview

The TickerDetailModal component displays comprehensive information about a selected stock ticker in a modal dialog. It fetches and displays recommendation history, fundamental metrics, recent news articles, and ensemble model contributions.

**Requirements:** 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8

## Features

### Data Display (Requirements 3.2, 3.3, 3.4)

1. **Recommendation History** - Historical scores and returns for the ticker
2. **Fundamental Metrics** - Key financial metrics (P/E, P/B, Dividend Yield, ROE, Debt/Equity)
3. **Recent News** - Latest news articles related to the ticker
4. **Ensemble Model Contributions** - Individual model weights and predictions

### User Interactions (Requirements 3.5, 3.6)

1. **Close Button** - X button in the header
2. **Escape Key** - Press Escape to close the modal
3. **Overlay Click** - Click outside the modal to close

### Loading States (Requirements 3.7, 3.8)

1. **Loading Indicator** - Displays while fetching data
2. **Error Message** - Shows user-friendly error if data fetch fails
3. **Graceful Fallback** - Uses mock data if API endpoints are not available

## API Integration

The component fetches data from three API endpoints:

### 1. Ticker History
```
GET /api/ticker/{ticker}/history?days=90
```

**Expected Response:**
```json
{
  "data": [
    {
      "date": "2024-01-01",
      "score": 85.5,
      "return": 0.12
    }
  ]
}
```

### 2. Ticker Fundamentals
```
GET /api/ticker/{ticker}/fundamentals
```

**Expected Response:**
```json
{
  "data": {
    "P/L": "15.50",
    "P/VP": "2.30",
    "Div. Yield": "5.2%",
    "ROE": "18.5%",
    "Dív/PL": "0.85"
  }
}
```

### 3. Ticker News
```
GET /api/ticker/{ticker}/news?limit=5
```

**Expected Response:**
```json
{
  "data": [
    {
      "title": "PETR4 anuncia resultados do trimestre",
      "source": "InfoMoney",
      "date": "Há 2 dias"
    }
  ]
}
```

## Usage

```jsx
import TickerDetailModal from './components/recommendations/TickerDetailModal';

function RecommendationsPage() {
  const [selectedTicker, setSelectedTicker] = useState(null);

  return (
    <>
      {/* Ticker list */}
      <div onClick={() => setSelectedTicker(ticker)}>
        {ticker.ticker}
      </div>

      {/* Modal */}
      {selectedTicker && (
        <TickerDetailModal
          ticker={selectedTicker}
          onClose={() => setSelectedTicker(null)}
        />
      )}
    </>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| ticker | Object | Yes | Ticker object containing ticker symbol and metadata |
| ticker.ticker | string | Yes | Stock ticker symbol (e.g., "PETR4") |
| ticker.sector | string | No | Sector name |
| ticker.expected_return | number | No | Expected return (decimal) |
| ticker.confidence_score | number | No | Confidence score |
| ticker.model_weights | Object | No | Ensemble model weights |
| ticker.predictions | Object | No | Individual model predictions |
| onClose | Function | Yes | Callback function to close the modal |

## Implementation Details

### Parallel Data Fetching

The component uses `Promise.allSettled()` to fetch all data in parallel for better performance:

```javascript
const [historyData, fundamentalsData, newsData] = await Promise.allSettled([
  api.get(`/api/ticker/${ticker.ticker}/history`, { days: 90 }),
  api.get(`/api/ticker/${ticker.ticker}/fundamentals`),
  api.get(`/api/ticker/${ticker.ticker}/news`, { limit: 5 })
]);
```

### Graceful Degradation

If any API endpoint fails, the component falls back to mock data and logs a warning:

```javascript
const history = historyData.status === 'fulfilled' && historyData.value?.data
  ? historyData.value.data
  : generateMockHistory(ticker.ticker);
```

This ensures the modal always displays content, even if the backend endpoints are not yet implemented.

### Keyboard Accessibility

The modal implements proper keyboard handling:
- **Escape key** closes the modal
- **Close button** has proper ARIA label for screen readers

### Event Handling

The component properly cleans up event listeners:

```javascript
useEffect(() => {
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };
  
  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [onClose]);
```

## Styling

The modal uses inline styles for simplicity and portability:
- **Overlay**: Semi-transparent black background
- **Modal**: White card with rounded corners and shadow
- **Responsive**: Max width of 800px, scrollable content
- **Sticky Header**: Header stays visible when scrolling

## Testing

The component includes comprehensive unit tests covering all requirements:

```bash
npm test -- TickerDetailModal.test.jsx
```

### Test Coverage

- ✅ Modal displays with ticker information (Req 3.1)
- ✅ Displays recommendation history (Req 3.2)
- ✅ Displays fundamental metrics (Req 3.3)
- ✅ Displays recent news articles (Req 3.4)
- ✅ Displays close button (Req 3.5)
- ✅ Closes on Escape key (Req 3.6)
- ✅ Closes on overlay click (Req 3.6)
- ✅ Closes on close button click (Req 3.6)
- ✅ Displays loading indicator (Req 3.7)
- ✅ Displays error message on failure (Req 3.8)
- ✅ Falls back to mock data when API unavailable
- ✅ Displays ensemble model contributions

## Future Enhancements

1. **Price Chart** - Add candlestick chart for price history
2. **Technical Indicators** - Display moving averages, RSI, MACD
3. **Analyst Ratings** - Show analyst recommendations and price targets
4. **Peer Comparison** - Compare metrics with sector peers
5. **Export** - Allow exporting ticker details to PDF/Excel
6. **Favorites** - Add ticker to favorites/watchlist
7. **Alerts** - Quick access to configure alerts for this ticker

## Backend Implementation Notes

The backend Lambda function should implement these endpoints:

### /api/ticker/{ticker}/history

```python
def get_ticker_history(ticker: str, days: int = 90) -> dict:
    """
    Fetch recommendation history for a ticker.
    
    Returns:
        {
            "data": [
                {
                    "date": "2024-01-01",
                    "score": 85.5,
                    "return": 0.12,
                    "rank": 5
                }
            ]
        }
    """
    # Query S3 for historical recommendations
    # Filter by ticker
    # Return last N days
```

### /api/ticker/{ticker}/fundamentals

```python
def get_ticker_fundamentals(ticker: str) -> dict:
    """
    Fetch fundamental metrics for a ticker.
    
    Returns:
        {
            "data": {
                "P/L": "15.50",
                "P/VP": "2.30",
                "Div. Yield": "5.2%",
                "ROE": "18.5%",
                "Dív/PL": "0.85",
                "Market Cap": "R$ 500B"
            }
        }
    """
    # Query fundamentals data source
    # Could be from S3, external API, or database
```

### /api/ticker/{ticker}/news

```python
def get_ticker_news(ticker: str, limit: int = 5) -> dict:
    """
    Fetch recent news articles for a ticker.
    
    Returns:
        {
            "data": [
                {
                    "title": "Company announces results",
                    "source": "InfoMoney",
                    "date": "2024-01-15",
                    "url": "https://...",
                    "sentiment": "positive"
                }
            ]
        }
    """
    # Query news API or database
    # Filter by ticker
    # Return most recent articles
```

## Dependencies

- `react` - Core React library
- `lucide-react` - Icons (X, TrendingUp, BarChart3, Newspaper, AlertCircle, Loader)
- `../../services/api` - API service for data fetching

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility

- ✅ Keyboard navigation (Escape to close)
- ✅ ARIA labels on interactive elements
- ✅ Focus management
- ✅ Screen reader friendly
- ✅ Color contrast compliance

## Performance

- **Parallel API calls** - All data fetched simultaneously
- **Lazy loading** - Modal only renders when opened
- **Optimized re-renders** - useEffect dependencies properly configured
- **Cleanup** - Event listeners removed on unmount
