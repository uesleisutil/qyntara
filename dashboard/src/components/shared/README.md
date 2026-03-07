# Shared UI Components

This directory contains reusable UI components used throughout the dashboard.

## Components

### LoadingSpinner
Animated loading spinner with customizable size and text.

**Features:**
- Multiple sizes (sm, md, lg)
- Optional loading text
- Smooth CSS animations
- Centered or inline display
- Full-screen overlay option

**Props:**
- `size` (string): Spinner size - 'sm', 'md', or 'lg' (default: 'md')
- `text` (string): Optional loading text below spinner
- `centered` (boolean): Center spinner in container (default: false)
- `fullScreen` (boolean): Show as full-screen overlay (default: false)

**Example:**
```jsx
// Simple spinner
<LoadingSpinner />

// With text and centered
<LoadingSpinner size="lg" text="Loading data..." centered />

// Full-screen overlay
<LoadingSpinner fullScreen text="Processing..." />
```

### ErrorBoundary
React error boundary for graceful error handling.

**Features:**
- Catches JavaScript errors in child components
- Displays fallback UI with error details
- Optional retry functionality
- Custom fallback component support
- Error logging callback

**Props:**
- `children` (node): Child components to wrap
- `fallback` (function): Custom fallback render function
- `onError` (function): Callback when error is caught
- `onReset` (function): Callback when retry is clicked
- `title` (string): Error title (default: 'Something went wrong')
- `message` (string): Error message
- `showDetails` (boolean): Show error stack trace (default: false)
- `showReset` (boolean): Show retry button (default: true)

**Example:**
```jsx
// Basic usage
<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>

// With custom message and error handler
<ErrorBoundary
  title="Chart Error"
  message="Failed to load chart data"
  showDetails={process.env.NODE_ENV === 'development'}
  onError={(error, errorInfo) => console.error(error)}
>
  <ChartComponent />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary
  fallback={({ error, resetError }) => (
    <div>
      <h2>Custom Error UI</h2>
      <button onClick={resetError}>Retry</button>
    </div>
  )}
>
  <MyComponent />
</ErrorBoundary>
```

### Tooltip
Reusable tooltip component with auto-positioning.

**Features:**
- Multiple positions (top, bottom, left, right)
- Auto-positioning to stay in viewport
- Hover and focus triggers
- Smooth animations
- Accessible (ARIA attributes)
- Configurable delay

**Props:**
- `children` (node): Element to attach tooltip to
- `content` (node): Tooltip content
- `position` (string): Preferred position - 'top', 'bottom', 'left', 'right' (default: 'top')
- `delay` (number): Show delay in milliseconds (default: 200)
- `disabled` (boolean): Disable tooltip (default: false)

**Example:**
```jsx
<Tooltip content="This is a helpful tooltip">
  <button>Hover me</button>
</Tooltip>

<Tooltip content="More info" position="right" delay={500}>
  <span>?</span>
</Tooltip>
```

### Card
Consistent card component for dashboard panels.

**Features:**
- Consistent styling across dashboard
- Optional title, subtitle, and icon
- Optional action buttons
- Hover effects
- Loading and error states
- Collapsible content
- Configurable padding

**Props:**
- `title` (string): Card title
- `subtitle` (string): Card subtitle
- `icon` (node): Icon element
- `actions` (node): Action buttons/links
- `children` (node): Card content
- `className` (string): Additional CSS classes
- `hoverable` (boolean): Enable hover shadow effect (default: false)
- `loading` (boolean): Show loading spinner (default: false)
- `error` (string): Error message to display
- `collapsible` (boolean): Enable collapse functionality (default: false)
- `defaultCollapsed` (boolean): Start collapsed (default: false)
- `padding` (string): Padding size - 'none', 'sm', 'normal', 'lg' (default: 'normal')

**Example:**
```jsx
// Basic card
<Card title="Performance Metrics">
  <p>Content goes here</p>
</Card>

// With icon and actions
<Card
  title="Model Comparison"
  subtitle="Last 30 days"
  icon={<ChartIcon />}
  actions={
    <>
      <button>Export</button>
      <button>Refresh</button>
    </>
  }
>
  <ChartComponent />
</Card>

// With loading state
<Card title="Loading Data" loading>
  <p>This won't show while loading</p>
</Card>

// With error state
<Card title="Failed to Load" error="Network error occurred">
  <p>This won't show when error is present</p>
</Card>

// Collapsible card
<Card
  title="Advanced Settings"
  collapsible
  defaultCollapsed
>
  <SettingsForm />
</Card>
```

## Usage

Import components individually or as a group:

```jsx
import { LoadingSpinner, ErrorBoundary, Tooltip, Card } from './components/shared';
```

## Best Practices

1. **ErrorBoundary**: Wrap major sections of your app to prevent full app crashes
2. **LoadingSpinner**: Use consistent sizes across similar UI elements
3. **Tooltip**: Keep content concise and informative
4. **Card**: Use consistent padding across similar cards for visual harmony

## Styling

All components use TailwindCSS and follow the dashboard design system:
- Primary color: Blue (#3B82F6)
- Error color: Red (#DC2626)
- Success color: Green (#10B981)
- Gray scale for text and borders
- Consistent border radius and shadows
