"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TierInfo } from "@/components/tier-info";
import type { Case, CaseTier } from "@/lib/api/types";

const TIER_VARIANT: Record<CaseTier, "default" | "secondary" | "destructive"> = {
  CONFIRMED: "default",
  PLAUSIBLE: "secondary",
  UNVERIFIED: "destructive",
};

const ROW_HEIGHT = 45;

const columns: ColumnDef<Case>[] = [
  {
    accessorKey: "case_id",
    header: "Case",
    cell: ({ getValue }) => <span className="font-mono text-xs">#{getValue<number>()}</span>,
  },
  {
    accessorKey: "complaint",
    header: "Complaint",
    cell: ({ getValue }) => getValue<string | null>() ?? "unclassified",
  },
  {
    id: "station",
    header: "Station",
    accessorFn: (row) => `${row.station.name} · ${row.station.line}`,
  },
  {
    id: "material",
    header: "Material",
    cell: ({ row }) => (
      <div>
        <div>{row.original.profile.material.name}</div>
        {row.original.material_lot && (
          <div className="text-xs text-muted-foreground">lot {row.original.material_lot}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "opened_at",
    header: "Opened",
    cell: ({ getValue }) => new Date(getValue<string>()).toLocaleString(),
  },
  {
    accessorKey: "rank_tier",
    header: "Rank",
    cell: ({ getValue }) => {
      const tier = getValue<string | null>();
      return tier ? <Badge variant="outline">{tier}</Badge> : <span className="text-muted-foreground">—</span>;
    },
  },
  {
    accessorKey: "tier",
    header: () => (
      <span className="inline-flex items-center gap-1">
        Tier <TierInfo />
      </span>
    ),
    cell: ({ getValue }) => {
      const tier = getValue<CaseTier | null>();
      if (!tier) return <span className="text-muted-foreground">open</span>;
      return <Badge variant={TIER_VARIANT[tier]}>{tier}</Badge>;
    },
  },
  {
    accessorKey: "diagnosed",
    header: "Diagnosed",
    cell: ({ getValue }) => <span className="capitalize">{getValue<string>().replaceAll("_", " ")}</span>,
  },
  {
    accessorKey: "action_count",
    header: "Checks",
  },
  {
    id: "actions",
    header: "Troubleshooting",
    cell: ({ row }) => (
      <Link
        href={`/troubleshoot/${row.original.case_id}`}
        onClick={(e) => e.stopPropagation()}
        className={buttonVariants({
          size: "sm",
          variant: "default",
          className: "h-7 gap-1 px-2.5 text-xs font-medium shadow-xs",
        })}
      >
        <Sparkles className="size-3" />
        {row.original.closed_at ? "Review / Reopen" : "Troubleshoot"}
      </Link>
    ),
  },
];

/**
 * Row-virtualized TanStack Table: only the rows scrolled into view are
 * mounted, so this stays smooth however many cases accumulate.
 */
export function CasesTable({ data }: { data: Case[] }) {
  const router = useRouter();
  const parentRef = React.useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div ref={parentRef} className="max-h-[70vh] overflow-auto rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {paddingTop > 0 && (
            <TableRow style={{ height: paddingTop }} aria-hidden>
              <TableCell colSpan={columns.length} className="p-0" />
            </TableRow>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => router.push(`/cases/${row.original.case_id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
          {paddingBottom > 0 && (
            <TableRow style={{ height: paddingBottom }} aria-hidden>
              <TableCell colSpan={columns.length} className="p-0" />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
