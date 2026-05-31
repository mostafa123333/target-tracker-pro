import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, ArrowUpDown, Search } from "lucide-react";
import type { Category, DailyEntry, TrackerSettings } from "@/lib/tracker/types";
import {
  entryNet,
  entryStatus,
  entryTotalExpenses,
  formatEGP,
  makeCategoryMap,
} from "@/lib/tracker/analytics";

type Props = {
  entries: DailyEntry[];
  settings: TrackerSettings;
  categories?: Category[];
  onEdit: (e: DailyEntry) => void;
  onDelete: (id: string) => void;
};

type SortKey = "date" | "earnings" | "expenses" | "net";

export function EntriesTable({ entries, settings, categories = [], onEdit, onDelete }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "ahead" | "behind" | "ontrack">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pending, setPending] = useState<DailyEntry | null>(null);

  const catMap = useMemo(() => makeCategoryMap(categories), [categories]);

  const rows = useMemo(() => {
    let r = entries.map((e) => ({
      e,
      net: entryNet(e, catMap),
      expenses: entryTotalExpenses(e),
      status: entryStatus(e, settings.dailyTarget, catMap),
    }));
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter(
        ({ e }) =>
          e.date.includes(s) ||
          (e.notes ?? "").toLowerCase().includes(s) ||
          e.expenses.some((x) => x.category.toLowerCase().includes(s)),
      );
    }
    if (filter !== "all") r = r.filter((x) => x.status === filter);
    r.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "date") {
        av = a.e.date;
        bv = b.e.date;
      } else if (sortKey === "earnings") {
        av = a.e.earnings;
        bv = b.e.earnings;
      } else if (sortKey === "expenses") {
        av = a.expenses;
        bv = b.expenses;
      } else {
        av = a.net;
        bv = b.net;
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [entries, q, filter, sortKey, sortDir, settings.dailyTarget]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  return (
    <div className="glass-card p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search date, note, category…"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All days</SelectItem>
            <SelectItem value="ahead">Ahead</SelectItem>
            <SelectItem value="ontrack">On track</SelectItem>
            <SelectItem value="behind">Behind</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead onClick={() => toggleSort("date")} active={sortKey === "date"}>Date</SortableHead>
              <SortableHead onClick={() => toggleSort("earnings")} active={sortKey === "earnings"}>Earnings</SortableHead>
              <SortableHead onClick={() => toggleSort("expenses")} active={sortKey === "expenses"}>Expenses</SortableHead>
              <SortableHead onClick={() => toggleSort("net")} active={sortKey === "net"}>Net</SortableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No entries yet
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ e, net, expenses, status }) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.date}</TableCell>
                <TableCell className="stat-number">{formatEGP(e.earnings)}</TableCell>
                <TableCell className="stat-number text-muted-foreground">
                  {formatEGP(expenses)}
                </TableCell>
                <TableCell
                  className={
                    "stat-number " +
                    (net >= 0 ? "text-[color:var(--success)]" : "text-destructive")
                  }
                >
                  {formatEGP(net)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setPending(e)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this day?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the entry for {pending?.date}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) onDelete(pending.id);
                setPending(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableHead({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className={
          "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors " +
          (active ? "text-foreground" : "text-muted-foreground hover:text-foreground")
        }
      >
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  );
}

function StatusBadge({ status }: { status: "ahead" | "behind" | "ontrack" }) {
  if (status === "ahead")
    return (
      <Badge className="border-transparent bg-[color:var(--success)]/15 text-[color:var(--success)] hover:bg-[color:var(--success)]/20">
        Ahead
      </Badge>
    );
  if (status === "behind")
    return (
      <Badge className="border-transparent bg-destructive/15 text-destructive hover:bg-destructive/20">
        Behind
      </Badge>
    );
  return (
    <Badge className="border-transparent bg-muted text-muted-foreground">On track</Badge>
  );
}
