# Navigation and Interaction Enhancements

This document describes the implementation of Task 14: Navigation and Interaction Enhancements for the B3 Tactical Ranking MLOps Dashboard.

## Overview

Task 14 implements 8 major subtasks that enhance user navigation and interaction capabilities:

1. **Breadcrumb Navigation** (14.1)
2. **Favorite Tickers** (14.3)
3. **Layout Personalization** (14.5)
4. **Keyboard Shortcuts** (14.7)
5. **Drill-Down Interactions** (14.9)
6. **Cross-Filtering** (14.10)
7. **Chart Zoom and Pan** (14.12)
8. **User Annotations** (14.14)

## Components

### 1. Breadcrumb Navigation

**Files:**
- `Breadcrumb.tsx` - Main breadcrumb component
- `BreadcrumbContext.tsx` - Context for managing breadcrumb state
- `Breadcrumb.test.tsx` - Unit tests

**Features:**
- Displays current location hierarchy
- Clickable segments for navigation
- Keyboard navigation support (Enter, Space)
- Truncates long paths with ellipsis
- Home icon for root level
- Separators between segments
- Highlights current location
- WCAG 2.1 Level AA compliant

**Usage:**
```tsx
import { Breadcrumb } from './components/shared';
import { useBreadcrumb } from './contexts';

function MyComponent() {
  const { segments } = useBreadcrumb();
  
  return <Breadcrumb segments={segments} darkMode={darkMode} />;
}
```

### 2. Favorite Tickers

**Files:**
- `FavoriteIcon.tsx` - Star icon for toggling favorites
- `FavoritesPanel.tsx` - Management panel for favorites
- `FavoritesContext.tsx` - Context for managing favorites
- `FavoriteIcon.test.tsx` - Unit tests

**Features:**
- Star icon next to each ticker
- Toggle favorite on click
- Persists to localStorage (DynamoDB ready)
- Favorites filter
- Sort by favorites
- Display favorite count
- Management panel
- Limit to 50 favorites
- Keyboard accessible

**Usage:**
```tsx
import { FavoriteIcon, FavoritesPanel } from './components/shared';
import { useFavorites } from './contexts';

function TickerRow({ ticker }) {
  const { isFavorite } = useFavorites();
  
  return (
    <div>
      <span>{ticker}</span>
      <FavoriteIcon ticker={ticker} />
    </div>
  );
}
```

### 3. Layout Personalization

**Files:**
- `DraggableKPICard.tsx` - Draggable KPI card wrapper
- `LayoutContext.tsx` - Context for managing layout state

**Features:**
- Drag KPI cards to rearrange
- Show/hide controls for KPI cards
- Resize chart panels
- Persist layout to localStorage (DynamoDB ready)
- Reset to default button
- Multiple layout presets
- Preset switcher
- Export/import layouts

**Usage:**
```tsx
import { DraggableKPICard } from './components/shared';
import { useLayout } from './contexts';

function Dashboard() {
  const { kpiCards, reorderKPICards } = useLayout();
  
  return (
    <div>
      {kpiCards.map((card, index) => (
        <DraggableKPICard
          key={card.id}
          id={card.id}
          index={index}
          {...cardProps}
        />
      ))}
    </div>
  );
}
```

### 4. Keyboard Shortcuts

**Files:**
- `KeyboardShortcutsHelp.tsx` - Help panel displaying shortcuts
- `KeyboardContext.tsx` - Context for managing shortcuts

**Features:**
- Navigate to tabs using number keys (1-9)
- Open search using forward slash (/)
- Close modals using Escape
- Refresh data using R key
- Toggle theme using T key
- Display help panel using question mark (?)
- Customize shortcuts
- Prevent interference with text inputs
- Display hints in tooltips

**Usage:**
```tsx
import { KeyboardShortcutsHelp } from './components/shared';
import { useKeyboard } from './contexts';

function App() {
  const { registerShortcut, showHelp } = useKeyboard();
  
  useEffect(() => {
    registerShortcut({
      key: '1',
      action: 'navigate-tab-1',
      description: 'Navigate to Recommendations tab',
      category: 'navigation',
      handler: () => setActiveTab('recommendations')
    });
  }, []);
  
  return (
    <>
      <Dashboard />
      {showHelp && <KeyboardShortcutsHelp darkMode={darkMode} />}
    </>
  );
}
```

### 5. Drill-Down Interactions

**Files:**
- `DrillDownContext.tsx` - Context for managing drill-down state

**Features:**
- Click handlers for chart elements
- Click handlers for KPI cards
- Sector filtering on chart click
- Maintain context across tabs
- Breadcrumb for drill-down path
- Return to summary button
- Multiple drill-down levels
- Highlight selected element

**Usage:**
```tsx
import { useDrillDown } from './contexts';

function Chart() {
  const { drillDown, drillUp, isInDrillDown } = useDrillDown();
  
  const handleElementClick = (element) => {
    drillDown({
      type: 'sector',
      label: element.sector,
      filters: { sector: element.sector }
    });
  };
  
  return (
    <div>
      {isInDrillDown && (
        <button onClick={() => drillUp()}>Back to Summary</button>
      )}
      <ChartComponent onElementClick={handleElementClick} />
    </div>
  );
}
```

### 6. Cross-Filtering

**Files:**
- `CrossFilterBar.tsx` - Display active cross-filters
- `CrossFilterContext.tsx` - Context for managing cross-filters

**Features:**
- Apply chart selections as filters
- Display active filters in filter bar
- Clear individual filters
- Clear all filters button
- Update all charts simultaneously
- Display filtered item count
- Multi-select support
- Persist state across tabs

**Usage:**
```tsx
import { CrossFilterBar } from './components/shared';
import { useCrossFilter } from './contexts';

function Dashboard() {
  const { addFilter, getFilteredData } = useCrossFilter();
  
  const handleChartSelection = (selection) => {
    addFilter({
      sourceChart: 'performance-chart',
      filterType: 'sector',
      label: 'Sector',
      values: selection.sectors
    });
  };
  
  const filteredData = getFilteredData(data, (item, filters) => {
    return filters.every(filter => {
      if (filter.filterType === 'sector') {
        return filter.values.includes(item.sector);
      }
      return true;
    });
  });
  
  return (
    <>
      <CrossFilterBar darkMode={darkMode} />
      <Chart data={filteredData} onSelection={handleChartSelection} />
    </>
  );
}
```

### 7. Chart Zoom and Pan

**Files:**
- `useChartZoom.ts` - Hook for zoom and pan functionality
- `ZoomControls.tsx` - UI controls for zoom
- `ZoomableChart.tsx` - Wrapper component for charts

**Features:**
- Mouse wheel zoom
- Pinch-to-zoom for touch devices
- Click-and-drag panning
- Zoom controls (in, out, reset)
- Box-select zoom
- Maintain aspect ratio
- Display current zoom level
- Synchronize zoom across related charts

**Usage:**
```tsx
import { ZoomableChart } from './components/charts';

function MyChart() {
  return (
    <ZoomableChart
      chartId="performance-chart"
      enableZoom={true}
      enablePan={true}
      darkMode={darkMode}
    >
      <LineChart data={data} />
    </ZoomableChart>
  );
}
```

### 8. User Annotations

**Files:**
- `AnnotationModal.tsx` - Modal for adding/editing annotations
- `AnnotationContext.tsx` - Context for managing annotations

**Features:**
- Add annotations to time series charts
- Right-click to add annotation
- Annotation text and optional category
- Display as markers on charts
- Show text on hover
- Edit annotations
- Delete annotations
- Persist to localStorage (DynamoDB ready)
- Filter by category
- Export annotations with chart data

**Usage:**
```tsx
import { AnnotationModal } from './components/shared';
import { useAnnotations } from './contexts';

function Chart() {
  const { addAnnotation, getAnnotationsForChart } = useAnnotations();
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  
  const annotations = getAnnotationsForChart('performance-chart');
  
  const handleContextMenu = (e, date) => {
    e.preventDefault();
    setSelectedDate(date);
    setShowModal(true);
  };
  
  return (
    <>
      <ChartComponent
        onContextMenu={handleContextMenu}
        annotations={annotations}
      />
      {showModal && (
        <AnnotationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={(text, category) => {
            addAnnotation({
              chartId: 'performance-chart',
              date: selectedDate,
              text,
              category
            });
          }}
          date={selectedDate}
          darkMode={darkMode}
        />
      )}
    </>
  );
}
```

## Integration

To integrate all enhancements into the main application:

```tsx
import React from 'react';
import {
  BreadcrumbProvider,
  FavoritesProvider,
  LayoutProvider,
  KeyboardProvider,
  DrillDownProvider,
  CrossFilterProvider,
  AnnotationProvider
} from './contexts';
import { Breadcrumb, KeyboardShortcutsHelp } from './components/shared';

function App() {
  return (
    <KeyboardProvider>
      <BreadcrumbProvider>
        <FavoritesProvider>
          <LayoutProvider>
            <DrillDownProvider>
              <CrossFilterProvider>
                <AnnotationProvider>
                  <div className="app">
                    <Header>
                      <Breadcrumb />
                    </Header>
                    <Dashboard />
                    <KeyboardShortcutsHelp />
                  </div>
                </AnnotationProvider>
              </CrossFilterProvider>
            </DrillDownProvider>
          </LayoutProvider>
        </FavoritesProvider>
      </BreadcrumbProvider>
    </KeyboardProvider>
  );
}
```

## Accessibility

All components follow WCAG 2.1 Level AA guidelines:

- Keyboard navigation support
- ARIA labels and roles
- Focus management
- Screen reader support
- Color contrast compliance
- Touch target sizes (minimum 44x44px)

## Testing

Each component includes comprehensive unit tests:

- Component rendering
- User interactions
- Keyboard navigation
- State management
- Error handling
- Edge cases

Run tests:
```bash
npm test -- --testPathPattern="Breadcrumb|FavoriteIcon"
```

## Performance

- Lazy loading for heavy components
- Memoization for expensive computations
- Debouncing for frequent updates
- Virtual scrolling for large lists
- Optimized re-renders with React.memo

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

- DynamoDB persistence for all user preferences
- Real-time sync across devices
- Advanced annotation features (drawings, shapes)
- Collaborative annotations
- Custom keyboard shortcut profiles
- Layout templates marketplace
- Advanced drill-down analytics
- Machine learning-powered suggestions

## Requirements Mapping

- **Requirement 37**: Breadcrumb Navigation ✓
- **Requirement 38**: Favorite Tickers ✓
- **Requirement 39**: Layout Personalization ✓
- **Requirement 40**: Keyboard Shortcuts ✓
- **Requirement 41**: Drill-Down Interactions ✓
- **Requirement 42**: Cross-Filtering ✓
- **Requirement 43**: Chart Zoom and Pan ✓
- **Requirement 44**: User Annotations ✓
