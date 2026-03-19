# FilterContext - Filter Composition and Persistence

## Overview

The FilterContext provides centralized state management for dashboard filters with automatic persistence and URL synchronization capabilities. This implementation fulfills Requirements 1.5 and 1.7 from the spec.

## Features

### 1. Filter Composition (Requirement 1.5)

Multiple filters work together through intersection logic:

```typescript
// Example: Apply multiple filters
const { setFilter } = useFilters();

setFilter('sector', 'Technology');
setFilter('minScore', 80);
setFilter('minReturn', 5.0);

// Result: Only stocks that match ALL criteria
// - Sector = Technology AND
// - Score >= 80 AND
// - Return >= 5.0%
```

**Key Implementation Details:**
- Each filter is independent and stored in the filter state object
- Filters combine via intersection (AND logic) when applied to data
- Setting a filter to `undefined` removes it from the active filters
- All filters are maintained when adding or updating individual filters

### 2. Session Storage Persistence (Requirement 1.7)

Filters automatically persist across page refreshes within the same browser session:

```typescript
// Filters are automatically saved to sessionStorage
setFilter('sector', 'Finance');

// After page refresh, filters are restored
const { filters } = useFilters();
console.log(filters.sector); // 'Finance'
```

**Key Implementation Details:**
- Filters save to `sessionStorage` on every change
- Filters load from `sessionStorage` on initialization
- Session storage is cleared when all filters are cleared
- Handles corrupted storage data gracefully

### 3. URL Synchronization (Requirement 1.7)

Filters automatically sync to URL parameters for sharing:

```typescript
// When filters are set, URL updates automatically
setFilter('sector', 'Technology');
setFilter('minScore', 80);

// URL becomes: /recommendations?sector=Technology&minScore=80
// This URL can be shared with others
```

**Key Implementation Details:**
- URL updates automatically when filters change
- URL parameters take priority over session storage on load
- Complex objects are JSON-encoded in URL
- Browser back/forward navigation updates filters
- URL is cleared when all filters are cleared

## Priority Order

When initializing filters, the following priority is used:

1. **URL Parameters** (highest priority) - for shared links
2. **Session Storage** - for persistence within session
3. **Empty State** (lowest priority) - no filters

This ensures that shared links always work correctly, while still providing persistence for regular usage.

## API Reference

### `useFilters()`

Hook to access filter state and methods.

**Returns:**
```typescript
{
  filters: FilterState;           // Current filter values
  setFilter: (key, value) => void;    // Set a single filter
  clearFilter: (key) => void;         // Clear a single filter
  clearAllFilters: () => void;        // Clear all filters
  applyFilters: () => void;           // Manual URL sync (auto by default)
}
```

### `FilterState`

```typescript
interface FilterState {
  sector?: string;
  minScore?: number;
  minReturn?: number;
  maxReturn?: number;
  dateRange?: { start: string; end: string };
  [key: string]: any;  // Extensible for future filters
}
```

## Usage Examples

### Basic Filter Usage

```typescript
import { useFilters } from '../../contexts/FilterContext';

function MyComponent() {
  const { filters, setFilter, clearAllFilters } = useFilters();

  return (
    <div>
      <select 
        value={filters.sector || ''} 
        onChange={(e) => setFilter('sector', e.target.value)}
      >
        <option value="">All Sectors</option>
        <option value="Technology">Technology</option>
        <option value="Finance">Finance</option>
      </select>

      <button onClick={clearAllFilters}>
        Clear All Filters
      </button>
    </div>
  );
}
```

### Applying Filters to Data

```typescript
import { useFilters } from '../../contexts/FilterContext';

function DataTable({ data }) {
  const { filters } = useFilters();

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply sector filter
    if (filters.sector) {
      result = result.filter(item => item.sector === filters.sector);
    }

    // Apply score filter
    if (filters.minScore !== undefined) {
      result = result.filter(item => item.score >= filters.minScore);
    }

    // Apply return range filters
    if (filters.minReturn !== undefined) {
      result = result.filter(item => item.return >= filters.minReturn);
    }
    if (filters.maxReturn !== undefined) {
      result = result.filter(item => item.return <= filters.maxReturn);
    }

    return result;
  }, [data, filters]);

  return <Table data={filteredData} />;
}
```

### Sharing Filtered Views

```typescript
import { useFilters } from '../../contexts/FilterContext';

function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // URL is already synced automatically
    const url = window.location.href;
    
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleShare}>
      {copied ? 'Copied!' : 'Share Filters'}
    </button>
  );
}
```

## Testing

Comprehensive tests are provided in `FilterContext.test.tsx`:

- Filter composition (intersection logic)
- Session storage persistence
- URL synchronization
- Priority order (URL > session storage > empty)
- Browser navigation (back/forward)
- Error handling (corrupted storage)

Run tests with:
```bash
npm test FilterContext.test.tsx
```

## Implementation Notes

### Automatic vs Manual Sync

By default, filters sync to URL automatically on every change. The `applyFilters()` method is provided for backward compatibility but is not required in normal usage.

### Performance Considerations

- Filter state updates trigger React re-renders
- Use `useMemo` when applying filters to large datasets
- Session storage writes are synchronous but fast
- URL updates use `history.replaceState` (no page reload)

### Browser Compatibility

- Session storage: All modern browsers
- URL API: All modern browsers
- Clipboard API: Requires HTTPS (except localhost)

### Future Enhancements

Potential improvements for future iterations:

1. **Debounced URL updates** - Reduce history entries for rapid filter changes
2. **Filter presets** - Save and load named filter configurations
3. **Filter validation** - Ensure filter values are valid before applying
4. **Filter analytics** - Track which filters are most commonly used
5. **Deep linking** - Support for tab + filter combinations in URL

## Related Components

- `FilterBar.jsx` - UI component that uses FilterContext
- `RecommendationsPage.jsx` - Applies filters to recommendation data
- `FilterBar.test.jsx` - Integration tests for filter UI

## Requirements Fulfilled

- ✅ **Requirement 1.5**: Multiple filters work together (intersection)
- ✅ **Requirement 1.7**: Filter persistence in session storage
- ✅ **Requirement 1.7**: Filter synchronization with URL parameters for sharing
