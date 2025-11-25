"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// --- Type Definitions ---

export interface DataTableColumn<TData> {
  id: string;
  header: string | React.ReactNode;
  accessorKey?: keyof TData;
  cell?: (props: { row: TData; rowIndex: number }) => React.ReactNode;
  enableSorting?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface DataTableFilter {
  columnId: string;
  type: 'dropdown' | 'search';
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
  label?: string;
}

export interface KeyboardShortcut<TData> {
  key: string;
  modifiers?: ('shift' | 'ctrl' | 'alt' | 'meta')[];
  handler: (selectedRows: TData[]) => void;
  description: string;
  condition?: (selectedRows: TData[]) => boolean;
}

export interface DataTableProps<TData> {
  data: TData[];
  columns: DataTableColumn<TData>[];

  // Core Features
  enableSearch?: boolean;
  searchPlaceholder?: string;
  enablePagination?: boolean;
  itemsPerPageOptions?: number[];
  initialItemsPerPage?: number;
  enableSorting?: boolean;

  // Selection
  enableSelection?: boolean;
  selectedRows?: Set<string | number>;
  onSelectionChange?: (selected: Set<string | number>) => void;

  // Filtering
  columnFilters?: DataTableFilter[];
  activeFilters?: Record<string, any>;
  onFilterChange?: (filters: Record<string, any>) => void;
  applyExternalFilters?: (data: TData[]) => TData[];

  // Keyboard Shortcuts
  enableKeyboardShortcuts?: boolean;
  keyboardShortcuts?: KeyboardShortcut<TData>[];

  // UI Customization
  title?: string;
  description?: string;
  renderToolbarActions?: (filteredData: TData[], selectedRows: Set<string | number>) => React.ReactNode;
  renderLegend?: () => React.ReactNode;
  renderHelpText?: () => React.ReactNode;

  // Row Interaction
  onRowClick?: (row: TData) => void;
  getRowKey?: (row: TData, index: number) => string | number;
  rowClassName?: (row: TData, rowIndex: number, isSelected: boolean) => string;
  selectedRowClassName?: string;

  // Row State Tracking
  rowState?: Map<string | number, any>;
  onRowStateChange?: (rowKey: string | number, state: any) => void;

  // Misc
  className?: string;
  noResultsMessage?: string;
}

function DataTableComponent<TData>({
  data,
  columns,
  enableSearch = true,
  searchPlaceholder = "Search...",
  enablePagination = true,
  itemsPerPageOptions = [10, 20, 50, 100],
  initialItemsPerPage = 20,
  enableSorting = true,
  enableSelection = false,
  selectedRows: controlledSelectedRows,
  onSelectionChange,
  columnFilters = [],
  activeFilters: controlledActiveFilters,
  onFilterChange,
  applyExternalFilters = (d) => d,
  enableKeyboardShortcuts = false,
  keyboardShortcuts = [],
  title,
  description,
  renderToolbarActions,
  renderLegend,
  renderHelpText,
  onRowClick,
  getRowKey = (row, index) => (row as any).id || index,
  rowClassName,
  selectedRowClassName = "bg-primary/5",
  rowState,
  onRowStateChange,
  className,
  noResultsMessage = "No results found.",
}: DataTableProps<TData>) {
  // Internal State
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(initialItemsPerPage);
  const [internalSelectedRows, setInternalSelectedRows] = React.useState<Set<string | number>>(new Set());
  const [internalActiveFilters, setInternalActiveFilters] = React.useState<Record<string, any>>({});

  // Use controlled state if provided, otherwise use internal state
  const selectedRows = controlledSelectedRows ?? internalSelectedRows;
  const activeFilters = controlledActiveFilters ?? internalActiveFilters;

  const setSelectedRows = React.useCallback((newSelection: Set<string | number>) => {
    if (onSelectionChange) {
      onSelectionChange(newSelection);
    } else {
      setInternalSelectedRows(newSelection);
    }
  }, [onSelectionChange]);

  const setActiveFilters = React.useCallback((newFilters: Record<string, any>) => {
    if (onFilterChange) {
      onFilterChange(newFilters);
    } else {
      setInternalActiveFilters(newFilters);
    }
  }, [onFilterChange]);

  // --- Derived Data (Memoized for performance) ---

  // 1. Apply external filters
  const externallyFilteredData = React.useMemo(
    () => applyExternalFilters(data),
    [data, applyExternalFilters]
  );

  // 2. Apply global search
  const searchedData = React.useMemo(() => {
    if (!enableSearch || !searchTerm) return externallyFilteredData;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return externallyFilteredData.filter((row) =>
      columns.some((col) => {
        if (col.accessorKey) {
          const value = String(row[col.accessorKey]);
          return value.toLowerCase().includes(lowerSearchTerm);
        }
        return false;
      })
    );
  }, [externallyFilteredData, enableSearch, searchTerm, columns]);

  // 3. Apply column filters
  const columnFilteredData = React.useMemo(() => {
    let filtered = searchedData;

    Object.entries(activeFilters).forEach(([columnId, filterValue]) => {
      if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) {
        return;
      }

      const column = columns.find(c => c.id === columnId);
      if (!column?.accessorKey) return;

      filtered = filtered.filter((row) => {
        const cellValue = row[column.accessorKey!];
        if (Array.isArray(filterValue)) {
          return filterValue.includes(cellValue);
        }
        return cellValue === filterValue;
      });
    });

    return filtered;
  }, [searchedData, activeFilters, columns]);

  // 4. Apply sorting
  const sortedData = React.useMemo(() => {
    if (!enableSorting || !sortColumn) return columnFilteredData;

    return [...columnFilteredData].sort((a, b) => {
      const column = columns.find(c => c.id === sortColumn);
      if (!column || !column.accessorKey) return 0;

      const aRaw = a[column.accessorKey];
      const bRaw = b[column.accessorKey];

      // Handle numeric values
      if (typeof aRaw === 'number' && typeof bRaw === 'number') {
        return sortDirection === "asc" ? aRaw - bRaw : bRaw - aRaw;
      }

      // Convert to string for comparison
      const aValue = String(aRaw);
      const bValue = String(bRaw);

      const comparison = aValue.localeCompare(bValue);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [columnFilteredData, enableSorting, sortColumn, sortDirection, columns]);

  // 5. Apply pagination
  const paginatedData = React.useMemo(() => {
    if (!enablePagination) return sortedData;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, enablePagination, currentPage, itemsPerPage]);

  const totalPages = enablePagination ? Math.ceil(sortedData.length / itemsPerPage) : 1;

  // --- Selection Handlers ---

  const handleToggleSelect = React.useCallback((rowKey: string | number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowKey)) {
      newSelected.delete(rowKey);
    } else {
      newSelected.add(rowKey);
    }
    setSelectedRows(newSelected);
  }, [selectedRows, setSelectedRows]);

  const handleToggleSelectAll = React.useCallback(() => {
    if (selectedRows.size === sortedData.length && sortedData.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(sortedData.map((row, index) => getRowKey(row, index))));
    }
  }, [selectedRows.size, sortedData, setSelectedRows, getRowKey]);

  // --- Sorting Handler ---

  const handleSort = React.useCallback((columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnId);
      setSortDirection("asc");
    }
  }, [sortColumn, sortDirection]);

  // --- Filter Handler ---

  const handleFilterChange = React.useCallback((columnId: string, value: any) => {
    setActiveFilters({
      ...activeFilters,
      [columnId]: value,
    });
  }, [activeFilters, setActiveFilters]);

  // --- Keyboard Shortcuts ---

  React.useEffect(() => {
    if (!enableKeyboardShortcuts || keyboardShortcuts.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      const selectedRowsArray = sortedData.filter((row, index) =>
        selectedRows.has(getRowKey(row, index))
      );

      for (const shortcut of keyboardShortcuts) {
        // Check if modifiers match
        const shiftMatch = shortcut.modifiers?.includes('shift') ? e.shiftKey : !e.shiftKey;
        const ctrlMatch = shortcut.modifiers?.includes('ctrl') ? e.ctrlKey : !e.ctrlKey;
        const altMatch = shortcut.modifiers?.includes('alt') ? e.altKey : !e.altKey;
        const metaMatch = shortcut.modifiers?.includes('meta') ? e.metaKey : !e.metaKey;

        // For shortcuts with modifiers, we want to match them exactly
        const hasModifiers = shortcut.modifiers && shortcut.modifiers.length > 0;
        const modifiersMatch = hasModifiers
          ? (shortcut.modifiers?.includes('shift') === e.shiftKey) &&
            (shortcut.modifiers?.includes('ctrl') === e.ctrlKey) &&
            (shortcut.modifiers?.includes('alt') === e.altKey) &&
            (shortcut.modifiers?.includes('meta') === e.metaKey)
          : !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;

        if (e.key === shortcut.key && modifiersMatch) {
          // Check condition if provided
          if (shortcut.condition && !shortcut.condition(selectedRowsArray)) {
            continue;
          }

          e.preventDefault();
          shortcut.handler(selectedRowsArray);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, keyboardShortcuts, selectedRows, sortedData, getRowKey]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilters]);

  return (
    <div className={cn("data-table-container space-y-4", className)}>
      {/* Title and Description */}
      {(title || description) && (
        <div>
          {title && <h2 className="text-xl font-semibold text-foreground">{title}</h2>}
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
      )}

      {/* Legend */}
      {renderLegend && renderLegend()}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {enableSearch && (
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {renderToolbarActions && renderToolbarActions(paginatedData, selectedRows)}
        </div>
      </div>

      {/* Column Filters */}
      {columnFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {columnFilters.map((filter) => {
            if (filter.type === 'dropdown' && filter.options) {
              return (
                <div key={filter.columnId} className="flex items-center gap-2">
                  {filter.label && <span className="text-sm text-muted-foreground">{filter.label}:</span>}
                  <Select
                    value={activeFilters[filter.columnId] || "all"}
                    onValueChange={(value) => handleFilterChange(filter.columnId, value === "all" ? undefined : value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={filter.placeholder || "All"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {filter.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {/* Help Text */}
      {renderHelpText && renderHelpText()}

      {/* Table */}
      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {enableSelection && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedRows.size === sortedData.length && sortedData.length > 0}
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Select all rows"
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead key={column.id} className={cn(column.headerClassName, column.className)}>
                  {enableSorting && column.enableSorting ? (
                    <Button
                      variant="ghost"
                      onClick={() => handleSort(column.id)}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      {column.header}
                      {sortColumn === column.id && (
                        <span className="ml-1">{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </Button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => {
                const rowKey = getRowKey(row, rowIndex);
                const isSelected = selectedRows.has(rowKey);
                const computedRowClassName = rowClassName?.(row, rowIndex, isSelected);

                return (
                  <TableRow
                    key={rowKey}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      onRowClick && "cursor-pointer",
                      isSelected && selectedRowClassName,
                      computedRowClassName
                    )}
                  >
                    {enableSelection && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(rowKey)}
                          aria-label={`Select row ${rowKey}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={column.id} className={column.className}>
                        {column.cell
                          ? column.cell({ row, rowIndex })
                          : column.accessorKey
                            ? String(row[column.accessorKey])
                            : null}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length + (enableSelection ? 1 : 0)} className="h-24 text-center">
                  {noResultsMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer with pagination and row count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {paginatedData.length} of {sortedData.length} {sortedData.length !== data.length && `(filtered from ${data.length})`}
          {selectedRows.size > 0 && ` · ${selectedRows.size} selected`}
        </div>

        {enablePagination && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            {itemsPerPageOptions.length > 1 && (
              <Select
                value={String(itemsPerPage)}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {itemsPerPageOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize the DataTable component for performance
export const DataTable = React.memo(DataTableComponent) as typeof DataTableComponent;
