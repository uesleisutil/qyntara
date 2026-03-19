# FilterBar Component

## Overview

The FilterBar component provides comprehensive filtering controls for the Recommendations tab, allowing users to filter stock recommendations by sector, return range, and minimum score.

## Features

### 1. Sector Filter (Req 1.1, 1.2)
- **Type:** Dropdown select
- **Options:** All unique sectors from recommendations data
- **Behavior:** Shows only tickers from selected sector
- **Default:** "Todos os setores" (all sectors)

### 2. Return Range Filters (Req 1.1, 1.3)
- **Type:** Range sliders (min and max)
- **Range:** Dynamic based on actual data
- **Display:** Real-time value display above slider
- **Behavior:** Shows only tickers within specified range
- **Step:** 0.5%

### 3. Minimum Score Filter (Req 1.1, 1.4)
- **Type:** Range slider
- **Range:** Dynamic based on actual data
- **Display:** Real-time value display above slider
- **Behavior:** Shows only tickers at or above threshold
- **Step:** 1 point

### 4. Filtered Result Count (Req 1.8)
- **Location:** Header, right side
- **Format:** "X de Y resultados"
- **Visual:** Highlighted in blue when filters active
- **Updates:** Real-time as filters change

### 5. Clear Filters Button (Req 1.6)
- **Visibility:** Appears only when filters are active
- **Action:** Resets all filters to default
- **Visual:** Red hover effect
- **Location:** Header, next to result count

### 6. Active Filters Summary
- **Visibility:** Appears when filters are active
- **Content:** Shows all active filter values
- **Visual:** Blue background with white badges
- **Location:** Bottom of filter bar

## Usage

```jsx
import FilterBar from './components/recommendations/FilterBar';

function RecommendationsPage() {
  const [filteredCount, setFilteredCount] = useState(0);
  
  return (
    <FilterBar 
      recommendations={recommendations}
      onFilteredCountChange={setFilteredCount}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `recommendations` | `Array` | Yes | Array of recommendation objects |
| `onFilteredCountChange` | `Function` | No | Callback when filtered count changes |

## Recommendation Object Structure

```javascript
{
  ticker: string,           // Stock ticker symbol
  sector: string,           // Sector name
  expected_return: number,  // Expected return (0-1 range)
  exp_return_20: number,    // Alternative return field
  confidence_score: number, // Confidence score (0-100)
  score: number            // Alternative score field
}
```

## Filter State

Filters are managed by `FilterContext` and include:

```javascript
{
  sector: string | undefined,      // Selected sector
  minReturn: number | undefined,   // Minimum return (%)
  maxReturn: number | undefined,   // Maximum return (%)
  minScore: number | undefined     // Minimum score
}
```

## Filter Logic

All filters work together (intersection):

1. **Sector Filter:** `r.sector === filters.sector`
2. **Return Range:** `returnValue >= minReturn && returnValue <= maxReturn`
3. **Score Filter:** `score >= minScore`

Only recommendations matching ALL active filters are displayed.

## Persistence

Filters persist during the user session via:
- **SessionStorage:** Automatic save/restore
- **URL Parameters:** Shareable filter state
- **FilterContext:** Centralized state management

## Styling

### Range Sliders
- Custom styled for consistency
- Cross-browser compatible (Chrome, Safari, Firefox)
- Hover and active states
- Focus indicators for accessibility

### Color Scheme
- **Primary:** Blue (#3b82f6)
- **Background:** Light gray (#f8fafc)
- **Border:** Gray (#e2e8f0)
- **Active:** Blue background (#eff6ff)
- **Clear button hover:** Red (#ef4444)

## Accessibility

- ✅ Proper labels for all inputs
- ✅ Focus indicators on interactive elements
- ✅ Keyboard navigation support
- ✅ ARIA-compliant controls
- ✅ Color contrast meets WCAG standards

## Responsive Design

- Grid layout adapts to screen size
- Minimum 250px per filter control
- Mobile-friendly touch targets
- Wraps on smaller screens

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Memoized calculations for efficiency
- Optimized re-renders
- Efficient filtering algorithms
- Minimal DOM updates

## Examples

### Basic Usage
```jsx
<FilterBar recommendations={recommendations} />
```

### With Callback
```jsx
<FilterBar 
  recommendations={recommendations}
  onFilteredCountChange={(count) => console.log(`Filtered to ${count} items`)}
/>
```

### Integration with FilterContext
```jsx
import { FilterProvider } from '../../contexts/FilterContext';

function App() {
  return (
    <FilterProvider>
      <FilterBar recommendations={recommendations} />
    </FilterProvider>
  );
}
```

## Testing

Comprehensive test suite covers:
- Rendering all controls
- Filter functionality
- Multiple filters intersection
- Clear filters
- Result count display
- Active filters summary

Run tests:
```bash
npm test FilterBar.test.jsx
```

## Related Components

- **FilterContext:** State management
- **RecommendationsPage:** Parent container
- **RecommendationsTable:** Displays filtered results

## Requirements Traceability

| Requirement | Description | Implementation |
|-------------|-------------|----------------|
| 1.1 | Display filter controls | ✅ All controls implemented |
| 1.2 | Filter by sector | ✅ Sector dropdown |
| 1.3 | Filter by return range | ✅ Min/max sliders |
| 1.4 | Filter by minimum score | ✅ Score slider |
| 1.5 | Multiple filters (intersection) | ✅ All filters applied together |
| 1.6 | Clear filters | ✅ Clear button |
| 1.7 | Persist selections | ✅ FilterContext handles |
| 1.8 | Display filtered count | ✅ Prominent display |

## Changelog

### Version 2.0 (Current)
- Enhanced with range sliders
- Added active filters summary
- Improved visual feedback
- Better accessibility
- Comprehensive tests

### Version 1.0
- Initial implementation
- Basic number inputs
- Simple filtering
