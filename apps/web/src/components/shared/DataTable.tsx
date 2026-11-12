'use client'

import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type TableOptions,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const selectClass = cn(
  'h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm',
  'transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50'
)

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  options?: Partial<TableOptions<TData>>
  /** Tamaño de página inicial. Default 25. */
  pageSize?: number
  /** Muestra el buscador de texto libre sobre la tabla. Default true. */
  searchable?: boolean
  searchPlaceholder?: string
  /**
   * Debajo de `md`, tarjetas apiladas en vez de la tabla (T-076). Se arman solas a partir
   * de las columnas: la primera (que no sea `actions`) es el título de la tarjeta, el resto
   * va como pares etiqueta/valor, y la columna `id: 'actions'` al pie. Poner en `false` para
   * tablas muy densas de solo lectura (auditoría) — ahí se deja la tabla con scroll
   * horizontal propio en vez de volverla tarjetas.
   */
  mobileCards?: boolean
}

function MobileRowCard<TData>({ row }: { row: Row<TData> }) {
  const cells = row.getVisibleCells()
  const actionsCell = cells.find((c) => c.column.id === 'actions')
  const [titleCell, ...restCells] = cells.filter((c) => c.column.id !== 'actions')

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 text-sm">
      {titleCell && (
        <div className="font-medium">
          {flexRender(titleCell.column.columnDef.cell, titleCell.getContext())}
        </div>
      )}
      {restCells.length > 0 && (
        <div className="space-y-1">
          {restCells.map((cell) => {
            const header = cell.column.columnDef.header
            const label = typeof header === 'string' && header ? header : null
            return (
              <div key={cell.id} className="flex items-center justify-between gap-3">
                {label && <span className="text-xs text-muted-foreground shrink-0">{label}</span>}
                <span className={cn('min-w-0 text-right', !label && 'ml-auto')}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {actionsCell && (
        <div className="flex items-center justify-end gap-1 border-t pt-2">
          {flexRender(actionsCell.column.columnDef.cell, actionsCell.getContext())}
        </div>
      )}
    </div>
  )
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  options = {},
  pageSize = 25,
  searchable = true,
  searchPlaceholder = 'Buscar...',
  mobileCards = true,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    ...options,
  })

  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination
  const filteredRowCount = table.getFilteredRowModel().rows.length
  const pageCount = table.getPageCount()
  const rangeStart = filteredRowCount === 0 ? 0 : pageIndex * currentPageSize + 1
  const rangeEnd = Math.min(filteredRowCount, (pageIndex + 1) * currentPageSize)

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value)
              table.setPageIndex(0)
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-8"
          />
        </div>
      )}

      {mobileCards && (
        <div className="space-y-2 md:hidden">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => <MobileRowCard key={row.id} row={row} />)
          ) : (
            <p className="rounded-lg border bg-card py-8 text-center text-sm text-muted-foreground">
              {globalFilter ? 'Sin resultados para la búsqueda.' : 'Sin resultados.'}
            </p>
          )}
        </div>
      )}

      <div className={cn('rounded-lg border bg-card overflow-x-auto', mobileCards && 'hidden md:block')}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-semibold text-foreground">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {globalFilter ? 'Sin resultados para la búsqueda.' : 'Sin resultados.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {filteredRowCount === 0
                ? 'Sin resultados'
                : `Mostrando ${rangeStart}–${rangeEnd} de ${filteredRowCount}`}
            </span>
            <select
              value={currentPageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              aria-label="Filas por página"
              className={selectClass}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} por página
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Página {pageCount === 0 ? 0 : pageIndex + 1} de {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Página anterior"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Página siguiente"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
