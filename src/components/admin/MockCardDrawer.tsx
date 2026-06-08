import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Download, Radio, TrendingUp, CheckCircle2 } from "lucide-react";
import {
  adminListMocks,
  adminListLiveMocks,
  adminMockBreakdowns,
  adminMockAttemptsOverview,
} from "@/lib/admin-mock.functions";

export type MockCardKey =
  | "total" | "published" | "drafts" | "scheduled" | "live" | "archived"
  | "attempts" | "completion" | "avgQuestions" | "topStatus" | "liveMocks";

const TITLES: Record<MockCardKey, { title: string; description: string }> = {
  total:         { title: "All mock tests",        description: "Every mock in the library with search and quick actions." },
  published:     { title: "Published mocks",       description: "Currently live in the catalog with publish dates." },
  drafts:        { title: "Draft mocks",           description: "In-progress mocks awaiting review or publish." },
  scheduled:     { title: "Scheduled mocks",       description: "Mocks with an upcoming start window." },
  live:          { title: "Live now",              description: "Published mocks inside their active window." },
  archived:      { title: "Archived mocks",        description: "Retired mocks — restore or audit history." },
  attempts:      { title: "Attempts overview",     description: "Real attempts pulled from quiz_sessions." },
  completion:    { title: "Completion rate",       description: "Completed vs. abandoned mock attempts." },
  avgQuestions:  { title: "Question distribution", description: "How many questions each mock carries." },
  topStatus:     { title: "Status breakdown",      description: "Library composition by publish status." },
  liveMocks:     { title: "Live mocks",            description: "Active mocks running right now." },
};

type Row = {
  id: string; title: string; status: string; level: string;
  total_questions: number; duration_seconds: number;
  starts_at: string | null; ends_at: string | null; updated_at: string;
};

function statusTone(s: string) {
  if (s === "published") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (s === "draft")     return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (s === "archived")  return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  return "bg-muted text-foreground";
}

function exportCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows]
    .map((line) => line.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function MockCardDrawer({
  cardKey, open, onClose,
}: { cardKey: MockCardKey | null; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
        {cardKey && <DrawerBody cardKey={cardKey} />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ cardKey }: { cardKey: MockCardKey }) {
  const meta = TITLES[cardKey];
  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-white/10 px-6 py-4">
        <SheetTitle className="font-display text-xl">{meta.title}</SheetTitle>
        <SheetDescription>{meta.description}</SheetDescription>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="px-6 py-4">
          {cardKey === "total"      && <MockListView preset={{}} />}
          {cardKey === "published"  && <MockListView preset={{ status: "published" }} />}
          {cardKey === "drafts"     && <MockListView preset={{ status: "draft" }} />}
          {cardKey === "scheduled"  && <MockListView preset={{ date: "upcoming" }} />}
          {cardKey === "archived"   && <MockListView preset={{ status: "archived" }} />}
          {cardKey === "live"       && <LiveMocksView />}
          {cardKey === "liveMocks"  && <LiveMocksView />}
          {cardKey === "attempts"   && <AttemptsView />}
          {cardKey === "completion" && <AttemptsView focus="completion" />}
          {cardKey === "avgQuestions" && <BreakdownView focus="questions" />}
          {cardKey === "topStatus"  && <BreakdownView focus="status" />}
        </div>
      </ScrollArea>
    </div>
  );
}

type Preset = {
  status?: "published" | "draft" | "archived";
  date?: "all" | "scheduled" | "unscheduled" | "upcoming" | "expired";
};

function MockListView({ preset }: { preset: Preset }) {
  const [search, setSearch] = useState("");
  const listFn = useServerFn(adminListMocks);
  const { data, isLoading } = useQuery({
    queryKey: ["mock-card-list", preset, search],
    queryFn: () => listFn({
      data: { ...preset, search: search || undefined, pageSize: 50, page: 1 },
    }),
  });
  const rows = (data?.rows ?? []) as Row[];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mocks..."
            className="h-9 pl-9"
          />
        </div>
        <Badge variant="secondary">{data?.count ?? 0} total</Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCsv(
            `mocks-${preset.status ?? preset.date ?? "all"}.csv`,
            ["Title", "Status", "Level", "Questions", "Duration (min)", "Starts", "Ends", "Updated"],
            rows.map((r) => [
              r.title, r.status, r.level, r.total_questions,
              Math.round(r.duration_seconds / 60),
              r.starts_at ?? "", r.ends_at ?? "", r.updated_at,
            ]),
          )}
        >
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>
      <MockTable rows={rows} isLoading={isLoading} />
    </div>
  );
}

function MockTable({ rows, isLoading }: { rows: Row[]; isLoading: boolean }) {
  if (isLoading) return <LoadingRow />;
  if (!rows.length) return <Empty message="No mocks match this view yet." />;
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Qs</TableHead>
            <TableHead className="text-right">Min</TableHead>
            <TableHead>Window</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="max-w-[220px] truncate font-medium">{r.title}</TableCell>
              <TableCell>
                <Badge variant="outline" className={statusTone(r.status)}>{r.status}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.total_questions}</TableCell>
              <TableCell className="text-right tabular-nums">{Math.round(r.duration_seconds / 60)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.starts_at ? new Date(r.starts_at).toLocaleString() : "—"}
                {r.ends_at ? ` → ${new Date(r.ends_at).toLocaleString()}` : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LiveMocksView() {
  const fn = useServerFn(adminListLiveMocks);
  const { data, isLoading } = useQuery({
    queryKey: ["mock-card-live"],
    queryFn: () => fn({ data: { limit: 100 } }),
    refetchInterval: 15_000,
  });
  const rows = (data?.rows ?? []) as Row[];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-emerald-400">
        <Radio className="h-4 w-4" /> Auto-refreshing every 15s • {rows.length} live
      </div>
      <MockTable rows={rows} isLoading={isLoading} />
    </div>
  );
}

function AttemptsView({ focus }: { focus?: "completion" } = {}) {
  const fn = useServerFn(adminMockAttemptsOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["mock-card-attempts"],
    queryFn: () => fn({ data: undefined }),
  });
  if (isLoading || !data) return <LoadingRow />;
  const max = Math.max(1, ...data.daily.map((d) => d.count));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Total attempts" value={data.totalAttempts} />
        <Stat label="Completed"      value={data.completed} accent="emerald" />
        <Stat label="Abandoned"      value={data.abandoned} accent="rose" />
      </div>
      <div className="rounded-xl border border-white/10 p-4">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Completion</p>
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500" style={{ width: `${data.completionRate}%` }} />
          </div>
          <span className="text-sm font-semibold">{data.completionRate}%</span>
        </div>
      </div>
      {focus !== "completion" && (
        <div className="rounded-xl border border-white/10 p-4">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">Last 30 days</p>
          <div className="flex h-32 items-end gap-1">
            {data.daily.length === 0 && <Empty message="No attempts yet." />}
            {data.daily.map((d) => (
              <div key={d.day} className="flex-1" title={`${d.day}: ${d.count}`}>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-[var(--neon-purple,_#8b5cf6)] to-[var(--neon-blue,_#3b82f6)]"
                  style={{ height: `${(d.count / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Top mocks by attempts</p>
        {data.topMocks.length === 0 ? <Empty message="No attempts yet." /> : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Title</TableHead><TableHead className="text-right">Attempts</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {data.topMocks.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.attempts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function BreakdownView({ focus }: { focus: "status" | "questions" }) {
  const fn = useServerFn(adminMockBreakdowns);
  const { data, isLoading } = useQuery({
    queryKey: ["mock-card-breakdowns"],
    queryFn: () => fn({ data: undefined }),
  });
  if (isLoading || !data) return <LoadingRow />;

  const blocks = focus === "status"
    ? [
        { title: "By status",     items: data.byStatus,     accent: "var(--neon-purple,_#8b5cf6)" },
        { title: "By level",      items: data.byLevel,      accent: "var(--neon-blue,_#3b82f6)" },
        { title: "By difficulty", items: data.byDifficulty, accent: "#10b981" },
      ]
    : [
        { title: "Question count buckets", items: data.questionBuckets, accent: "var(--neon-blue,_#3b82f6)" },
        { title: "By difficulty",          items: data.byDifficulty,    accent: "#10b981" },
      ];
  const max = (items: { count: number }[]) => Math.max(1, ...items.map((i) => i.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Total mocks"    value={data.totalMocks} />
        <Stat label="Total questions" value={data.totalQuestions} />
        <Stat label="Avg per mock"    value={data.avgQuestions} />
      </div>
      {blocks.map((b) => (
        <div key={b.title} className="rounded-xl border border-white/10 p-4">
          <p className="mb-3 text-xs font-semibold text-muted-foreground">{b.title}</p>
          <div className="space-y-2">
            {b.items.length === 0 && <Empty message="No data." />}
            {b.items.map((i) => (
              <div key={i.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="capitalize">{i.label}</span>
                  <span className="tabular-nums text-muted-foreground">{i.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(i.count / max(b.items)) * 100}%`, background: b.accent }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {focus === "questions" && (
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Largest mocks</p>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Questions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.largest.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[260px] truncate font-medium">{r.title}</TableCell>
                    <TableCell><Badge variant="outline" className={statusTone(r.status)}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{r.total_questions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "rose" }) {
  const tone = accent === "emerald" ? "text-emerald-400" : accent === "rose" ? "text-rose-400" : "";
  return (
    <div className="rounded-xl border border-white/10 bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl font-bold ${tone}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {message}
    </div>
  );
}

// Silence unused-icon lint warnings while keeping import set stable.
void TrendingUp;
