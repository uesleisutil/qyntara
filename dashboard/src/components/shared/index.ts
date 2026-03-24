// ── UI primitives ──
export { KPICard } from './ui/KPICard';
export { StatusBadge, StatusBadgeLegend } from './ui/StatusBadge';
export { ProgressBar } from './ui/ProgressBar';
export { GoalProgressBar } from './ui/GoalProgressBar';
export { Sparkline } from './ui/Sparkline';
export { LazyTab } from './ui/LazyTab';
export { Modal } from './ui/Modal';
export { BaseTable } from './ui/BaseTable';
export { Breadcrumb } from './ui/Breadcrumb';
export { DraggableKPICard } from './ui/DraggableKPICard';
export { KeyboardShortcutsHelp } from './ui/KeyboardShortcutsHelp';
export { CrossFilterBar } from './ui/CrossFilterBar';
export { ZoomControls } from './ui/ZoomControls';
export { AnnotationModal } from './ui/AnnotationModal';
export { ThemeToggle } from './ui/ThemeToggle';
export { default as ExportCSV } from './ui/ExportCSV';
export {
  TemporalComparisonProvider,
  useTemporalComparison,
  TemporalComparisonToggle,
  ComparisonValue,
  TemporalKPICard,
  ChartComparisonOverlay,
} from './ui/TemporalComparison';

// ── Feedback / loading ──
export { Skeleton } from './feedback/Skeleton';
export { SkeletonTable } from './feedback/SkeletonTable';
export { SkeletonChart } from './feedback/SkeletonChart';
export { SkeletonCard } from './feedback/SkeletonCard';
export { CacheIndicator } from './feedback/CacheIndicator';
export { OfflineIndicator } from './feedback/OfflineIndicator';
export { ErrorBoundary } from './feedback/ErrorBoundary';

// ── Features ──
export { FavoriteIcon } from './features/FavoriteIcon';
export { FavoritesPanel } from './features/FavoritesPanel';
export { default as NotificationCenter } from './features/NotificationCenter';
