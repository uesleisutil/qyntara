import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  PaginationState,
} from '@tanstack/react-table';

interface BaseTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  loading?: boolean;
  error?: Error;
  pagination?: boolean;
  pageSize?: number;
  sorting?: boolean;
  filtering?: boolean;
  selection?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function BaseTable<T>({
  data,
  columns,
  loading,
  error,
  pagination = true,
  pageSize = 50,
  sorting = true,
  filtering = false,
  onRowClick,
  className = '',
}: BaseTableProps<T>) {
  const [sortingState, setSortingState] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [paginationState, setPaginationState] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [jumpToPage, setJumpToPage] = React.useState<string>('');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: sortingState,
      columnFilters,
      pagination: paginationState,
    },
    onSortingChange: setSortingState,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPaginationState,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: sorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: filtering ? getFilteredRowModel() : undefined,
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    manualPagination: false,
  });

  // Keyboard navigation for pagination
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if no input is focused
      if (document.activeElement?.tagName === 'INPUT') return;

      if (e.key === 'ArrowLeft' && table.getCanPreviousPage()) {
        e.preventDefault();
        table.previousPage();
      } else if (e.key === 'ArrowRight' && table.getCanNextPage()) {
        e.preventDefault();
        table.nextPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [table]);

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNumber = parseInt(jumpToPage, 10);
    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= table.getPageCount()) {
      table.setPageIndex(pageNumber - 1);
      setJumpToPage('');
    }
  };

  // Auto-enable pagination for tables with > 50 rows
  const shouldPaginate = pagination && data.length > 50;

  if (loading) {
    return (
      <div className="table-skeleton">
        <div className="skeleton-header" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="table-error">
        <p>Failed to load table data</p>
        <p className="error-details">{error.message}</p>
      </div>
    );
  }

  return (
    <div className={`table-container ${className}`}>
      <div className="table-wrapper">
        <table className="base-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={header.column.getCanSort() ? 'sortable' : ''}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className="header-content"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() && (
                          <span className="sort-indicator">
                            {header.column.getIsSorted() === 'asc' ? ' ↑' : ' ↓'}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={onRowClick ? 'clickable' : ''}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shouldPaginate && (
        <div className="table-pagination">
          <div className="pagination-info">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{' '}
            of {table.getFilteredRowModel().rows.length} results
          </div>
          <div className="pagination-controls">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="pagination-button"
              title="First page"
              aria-label="Go to first page"
            >
              {'<<'}
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="pagination-button"
              title="Previous page (←)"
              aria-label="Go to previous page"
            >
              {'<'}
            </button>
            <span className="page-indicator">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="pagination-button"
              title="Next page (→)"
              aria-label="Go to next page"
            >
              {'>'}
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="pagination-button"
              title="Last page"
              aria-label="Go to last page"
            >
              {'>>'}
            </button>
            <form onSubmit={handleJumpToPage} style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '1rem' }}>
              <label htmlFor="jump-to-page" style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>
                Jump to:
              </label>
              <input
                id="jump-to-page"
                type="number"
                min="1"
                max={table.getPageCount()}
                value={jumpToPage}
                onChange={(e) => setJumpToPage(e.target.value)}
                placeholder="Page"
                style={{
                  width: '60px',
                  padding: '0.25rem 0.5rem',
                  border: '1px solid #b0c8bc',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
                aria-label="Jump to page number"
              />
            </form>
          </div>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="page-size-select"
            aria-label="Select page size"
          >
            {[25, 50, 100, 200].map((size) => (
              <option key={size} value={size}>
                Show {size}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
