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
import {
  Loader2, Search, Download, Radio, CheckCircle2, ArrowLeft, ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, RadialBarChart, RadialBar,
} from "recharts";
import {
  adminListMocks,
  adminListLiveMocks,
  adminMockBreakdowns,
  adminMockAttemptsOverview,
  adminMockDetail,
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
  attempts:      { title: "Attempts overview",     description: "Real attempts pulled from exam_attempts." },
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

const CHART_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#f43f5e", "#06b6d4"];

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

function fmtMins(seconds: number) {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export function MockCardDrawer({
  cardKey, open, onClose,
}: { cardKey: MockCardKey | null; open: boolean; onClose: () => void }) {
  const [drilledMockId, setDrilledMockId] = useState<string | null>(null);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && (setDrilledMockId(null), onClose())}>
      <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
        {cardKey && (
          drilledMockId
            ? <MockDetailView quizId={drilledMockId} onBack={() => setDrilledMockId(null)} />
            : <DrawerBody cardKey={cardKey} onDrillMock={setDrilledMockId} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ cardKey, onDrillMock }: { cardKey: MockCardKey; onDrillMock: (id: string) => void }) {
  const meta = TITLES[cardKey];
  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-white/10 px-6 py-4">
        <SheetTitle className="font-display text-xl">{meta.title}</SheetTitle>
        <SheetDescription>{meta.description}</SheetDescription>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="px-6 py-4">
          {cardKey === "total"      && <MockListView preset={{}}                          onDrillMock={onDrillMock} />}
          {cardKey === "published"  && <MockListView preset={{ status: "published" }}     onDrillMock={onDrillMock} />}
          {cardKey === "drafts"     && <MockListView preset={{ status: "draft" }}         onDrillMock={onDrillMock} />}
          {cardKey === "scheduled"  && <MockListView preset={{ date: "upcoming" }}        onDrillMock={onDrillMock} />}
          {cardKey === "archived"   && <MockListView preset={{ status: "archived" }}      onDrillMock={onDrillMock} />}
          {cardKey === "live"       && <LiveMocksView onDrillMock={onDrillMock} />}
          {cardKey === "liveMocks"  && <LiveMocksView onDrillMock={onDrillMock} />}
          {cardKey === "attempts"   && <AttemptsView onDrillMock={onDrillMock} />}
          {cardKey === "completion" && <AttemptsView focus="completion" onDrillMock={onDrillMock} />}
          {cardKey === "avgQuestions" && <BreakdownView focus="questions" onDrillMock={onDrillMock} />}
          {cardKey === "topStatus"  && <BreakdownView focus="status"    onDrillMock={onDrillMock} />}
        </div>
      </ScrollArea>
    </div>
  );
}

type Preset = {
  status?: "published" | "draft" | "archived";
  date?: "all" | "scheduled" | "unscheduled" | "upcoming" | "expired";
};

function MockListView({ preset, onDrillMock }: { preset: Preset; onDrillMock: (id: string) => void }) {
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
      <MockTable rows={rows} isLoading={isLoading} onRowClick={onDrillMock} />
    </div>
  );
}

function MockTable({ rows, isLoading, onRowClick }: {
  rows: Row[]; isLoading: boolean; onRowClick?: (id: string) => void;
}) {
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
            <TableRow
              key={r.id}
              onClick={() => onRowClick?.(r.id)}
              className={onRowClick ? "cursor-pointer hover:bg-white/[0.03]" : undefined}
            >
              <TableCell className="max-w-[220px] truncate font-medium">
                <div className="flex items-center gap-2">{r.title}
                  {onRowClick && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                </div>
              </TableCell>
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

function LiveMocksView({ onDrillMock }: { onDrillMock: (id: string) => void }) {
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
      <MockTable rows={rows} isLoading={isLoading} onRowClick={onDrillMock} />
    </div>
  );
}

function RangeTabs({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-background/40 p-0.5 text-xs">
      {[7, 30, 90].map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`px-3 py-1 rounded-lg transition ${value === d ? "bg-[var(--neon-purple)]/20 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

function AttemptsView({ focus, onDrillMock }: { focus?: "completion"; onDrillMock: (id: string) => void }) {
  const [rangeDays, setRangeDays] = useState(30);
  const fn = useServerFn(adminMockAttemptsOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["mock-card-attempts", rangeDays],
    queryFn: () => fn({ data: { rangeDays } }),
  });
  if (isLoading || !data) return <LoadingRow />;

  const completionPieData = [
    { name: "Completed", value: data.completed },
    { name: "Abandoned", value: data.abandoned },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <RangeTabs value={rangeDays} onChange={setRangeDays} />
        <Button variant="outline" size="sm" onClick={() => exportCsv(
          `mock-attempts-${rangeDays}d.csv`,
          ["Day", "Attempts", "Completed", "Avg Score"],
          data.daily.map((d) => [d.day, d.count, d.completed, d.avgScore]),
        )}><Download className="h-4 w-4" /> CSV</Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total attempts" value={data.totalAttempts} />
        <Stat label="Completed" value={data.completed} accent="emerald" />
        <Stat label="Avg score" value={data.avgScore} suffix="%" />
        <Stat label="Avg time" value={Math.round(data.avgDurationSeconds / 60)} suffix="m" />
      </div>

      {focus !== "completion" ? (
        <ChartCard title={`Attempts — last ${rangeDays} days`}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.daily}>
              <defs>
                <linearGradient id="atGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} hide={data.daily.length > 30} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #ffffff20", borderRadius: 8 }} />
              <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="url(#atGrad)" />
              <Area type="monotone" dataKey="completed" stroke="#10b981" fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <ChartCard title="Completion split">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={completionPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {completionPieData.map((_e, i) => <Cell key={i} fill={i === 0 ? "#10b981" : "#f43f5e"} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #ffffff20", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <ChartCard title="Score distribution">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.scoreHistogram}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #ffffff20", borderRadius: 8 }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Top mocks by attempts — click to drill in</p>
        {data.topMocks.length === 0 ? <Empty message="No attempts yet." /> : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead className="text-right">Avg score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topMocks.map((m, i) => (
                  <TableRow
                    key={(m.id ?? "noid") + i}
                    onClick={() => m.id && onDrillMock(m.id)}
                    className={m.id ? "cursor-pointer hover:bg-white/[0.03]" : "opacity-60"}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">{m.title}
                        {m.id && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.attempts}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.avgScore}%</TableCell>
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

function BreakdownView({ focus, onDrillMock }: { focus: "status" | "questions"; onDrillMock: (id: string) => void }) {
  const fn = useServerFn(adminMockBreakdowns);
  const { data, isLoading } = useQuery({
    queryKey: ["mock-card-breakdowns"],
    queryFn: () => fn({ data: undefined }),
  });
  if (isLoading || !data) return <LoadingRow />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Total mocks" value={data.totalMocks} />
        <Stat label="Total questions" value={data.totalQuestions} />
        <Stat label="Avg per mock" value={data.avgQuestions} />
      </div>

      {focus === "status" ? (
        <>
          <ChartCard title="By status">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.byStatus} dataKey="count" nameKey="label" innerRadius={48} outerRadius={80}>
                  {data.byStatus.map((_e, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #ffffff20", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="By level">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.byLevel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} width={100} />
                <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #ffffff20", borderRadius: 8 }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="By difficulty">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.byDifficulty}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #ffffff20", borderRadius: 8 }} />
                <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      ) : (
        <>
          <ChartCard title="Questions per mock — bucket distribution">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.questionBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #ffffff20", borderRadius: 8 }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="By difficulty">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.byDifficulty} dataKey="count" nameKey="label" innerRadius={42} outerRadius={72}>
                  {data.byDifficulty.map((_e, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #ffffff20", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Largest mocks — click to open</p>
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
                    <TableRow key={r.id} onClick={() => onDrillMock(r.id)} className="cursor-pointer hover:bg-white/[0.03]">
                      <TableCell className="max-w-[260px] truncate font-medium">
                        <div className="flex items-center gap-2">{r.title}
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className={statusTone(r.status)}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{r.total_questions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
 * Per-mock detail view (used by drill-in from any list/chart)
 * ============================================================ */

function MockDetailView({ quizId, onBack }: { quizId: string; onBack: () => void }) {
  const [rangeDays, setRangeDays] = useState(30);
  const fn = useServerFn(adminMockDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["mock-detail", quizId, rangeDays],
    queryFn: () => fn({ data: { quizId, rangeDays } }),
  });

  const mock = data?.mock as Row | undefined;
  const completionGauge = useMemo(() => {
    if (!data) return [];
    return [{ name: "completion", value: data.stats.completionRate, fill: "#10b981" }];
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <SheetTitle className="font-display text-xl flex-1 truncate">
            {mock?.title ?? "Mock detail"}
          </SheetTitle>
          {mock && <Badge variant="outline" className={statusTone(mock.status)}>{mock.status}</Badge>}
        </div>
        <SheetDescription>Real-time analytics for this mock from exam_attempts.</SheetDescription>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="space-y-4 px-6 py-4">
          {isLoading || !data ? <LoadingRow /> : (
            <>
              <div className="flex items-center justify-between">
                <RangeTabs value={rangeDays} onChange={setRangeDays} />
                <Button variant="outline" size="sm" onClick={() => exportCsv(
                  `mock-${quizId}-attempts-${rangeDays}d.csv`,
                  ["Day", "Attempts", "Completed", "Avg Score"],
                  data.daily.map((d) => [d.day, d.count, d.completed, d.avgScore]),
                )}><Download className="h-4 w-4" /> CSV</Button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Attempts" value={data.stats.totalAttempts} />
                <Stat label="Completed" value={data.stats.completed} accent="emerald" />
                <Stat label="Avg score" value={data.stats.avgScore} suffix="%" />
                <Stat label="Avg time" value={Math.round(data.stats.avgDurationSeconds / 60)} suffix="m" />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <ChartCard title="Completion rate">
                  <ResponsiveContainer width="100%" height={180}>
                    <RadialBarChart innerRadius="60%" outerRadius="100%" data={completionGauge} startAngle={90} endAngle={-270}>
                      <RadialBar background dataKey="value" cornerRadius={10} />
                      <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #ffffff20", borderRadius: 8 }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <p className="text-center font-display text-xl font-bold -mt-10">{data.stats.completionRate}%</p>
                </ChartCard>
                <ChartCard title="Score distribution">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.scoreHistogram}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #ffffff20", borderRadius: 8 }} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <ChartCard title={`Attempts & completions — last ${rangeDays} days`}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} hide={data.daily.length > 30} />
                    <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ background: "#0b1020", border: "1px solid #ffffff20", borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line yAxisId="l" type="monotone" dataKey="count" stroke="#8b5cf6" name="Attempts" strokeWidth={2} dot={false} />
                    <Line yAxisId="l" type="monotone" dataKey="completed" stroke="#10b981" name="Completed" strokeWidth={2} dot={false} />
                    <Line yAxisId="r" type="monotone" dataKey="avgScore" stroke="#f59e0b" name="Avg score" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Top scorers</p>
                {data.topScorers.length === 0 ? <Empty message="No scorers yet." /> : (
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead className="text-right">Best %</TableHead>
                          <TableHead className="text-right">Attempts</TableHead>
                          <TableHead>Last</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topScorers.map((u) => (
                          <TableRow key={u.user_id}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{u.score}%</TableCell>
                            <TableCell className="text-right tabular-nums">{u.attempts}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {u.lastAt ? new Date(u.lastAt).toLocaleString() : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Recent attempts</p>
                {data.recent.length === 0 ? <Empty message="No attempts yet." /> : (
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                          <TableHead className="text-right">Time</TableHead>
                          <TableHead>Started</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recent.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.userName}</TableCell>
                            <TableCell><Badge variant="outline" className={statusTone(r.status === "completed" ? "published" : "draft")}>{r.status}</Badge></TableCell>
                            <TableCell className="text-right tabular-nums">{r.score ?? "—"}{r.score != null ? "%" : ""}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtMins(r.duration_seconds)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {r.started_at ? new Date(r.started_at).toLocaleString() : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/40 p-4">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Stat({ label, value, accent, suffix }: { label: string; value: number; accent?: "emerald" | "rose"; suffix?: string }) {
  const tone = accent === "emerald" ? "text-emerald-400" : accent === "rose" ? "text-rose-400" : "";
  return (
    <div className="rounded-xl border border-white/10 bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl font-bold ${tone}`}>{value.toLocaleString()}{suffix ?? ""}</p>
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
