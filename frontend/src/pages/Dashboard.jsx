import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { Card } from "../components/ui/card";
import { Boxes, ScanLine, ArrowUpRight, Truck, FolderTree, AlertTriangle, CheckCircle2, PackageOpen, Archive, CalendarClock, CalendarDays } from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
    PieChart, Pie, Cell, CartesianGrid, Legend
} from "recharts";

const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const Metric = ({ label, value, icon: Icon, accent, testId, onClick }) => (
    <Card
        className={`p-6 border surface-card rounded-sm stagger-in ${onClick ? "cursor-pointer hover:border-primary transition-colors" : ""}`}
        data-testid={testId}
        onClick={onClick}
    >
        <div className="flex items-start justify-between">
            <div className="label-uppercase">{label}</div>
            <Icon className={`w-5 h-5 ${accent || "text-muted-foreground"}`} />
        </div>
        <div className="font-display font-black text-4xl mt-3">{value}</div>
    </Card>
);

export default function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [charts, setCharts] = useState(null);

    useEffect(() => {
        api.get("/dashboard/stats").then(({ data }) => setStats(data));
        api.get("/dashboard/charts").then(({ data }) => setCharts(data));
    }, []);

    if (!stats) return <div className="text-muted-foreground">Loading dashboard…</div>;
    const t = stats.totals;

    return (
        <div>
            <PageHeader title="Operations Overview" subtitle="Dashboard" />

            {/* Lifecycle widgets row - click to open filtered Issues list */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
                <Metric label="Total Issued" value={t.issued} icon={ArrowUpRight} accent="text-primary" testId="stat-total-issued"
                        onClick={() => navigate("/issues-returns?filter=active")} />
                <Metric label="Due Today" value={t.due_today} icon={CalendarClock} accent="text-[hsl(var(--warning))]" testId="stat-due-today"
                        onClick={() => navigate("/issues-returns?filter=due_today")} />
                <Metric label="Due This Week" value={t.due_week} icon={CalendarDays} accent="text-chart-5" testId="stat-due-week"
                        onClick={() => navigate("/issues-returns?filter=due_week")} />
                <Metric label="Overdue" value={t.overdue} icon={AlertTriangle} accent="text-accent" testId="stat-overdue"
                        onClick={() => navigate("/issues-returns?filter=overdue")} />
                <Metric label="Returned" value={t.returned} icon={PackageOpen} accent="text-chart-5" testId="stat-returned"
                        onClick={() => navigate("/issues-returns")} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-8">
                <Metric label="Total Catalogs" value={t.total_catalogs} icon={Boxes} testId="stat-total" />
                <Metric label="Available" value={t.available} icon={CheckCircle2} accent="text-[hsl(var(--success))]" testId="stat-available" />
                <Metric label="Suppliers" value={t.suppliers} icon={Truck} testId="stat-suppliers" />
                <Metric label="Categories" value={t.categories} icon={FolderTree} testId="stat-categories" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <Card className="p-6 surface-card rounded-sm">
                    <div className="label-uppercase mb-4">Monthly · Issues vs Returns</div>
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={charts?.monthly || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 4 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Line type="monotone" dataKey="issues" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="returns" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
                <Card className="p-6 surface-card rounded-sm">
                    <div className="label-uppercase mb-4">Category Distribution</div>
                    <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                            <Pie data={charts?.category_distribution || []} dataKey="value" nameKey="name" outerRadius={90} label fontSize={11}>
                                {(charts?.category_distribution || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        </PieChart>
                    </ResponsiveContainer>
                </Card>
                <Card className="p-6 surface-card rounded-sm">
                    <div className="label-uppercase mb-4">Most Issued Catalogs</div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={charts?.most_issued || []} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis type="category" dataKey="name" width={110} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                            <Bar dataKey="value" fill="hsl(var(--chart-2))" />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
                <Card className="p-6 surface-card rounded-sm">
                    <div className="label-uppercase mb-4">Supplier Distribution</div>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={charts?.supplier_distribution || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-25} textAnchor="end" height={70} />
                            <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                            <Bar dataKey="value" fill="hsl(var(--chart-3))" />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-6 surface-card rounded-sm" data-testid="recently-added-list">
                    <div className="label-uppercase mb-3">Recently Added</div>
                    {stats.recently_added.length === 0 ? <div className="text-sm text-muted-foreground">No catalogs yet.</div> :
                        stats.recently_added.map((c) => (
                            <div key={c.id} className="py-2 border-b last:border-0 border-border flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium truncate">{c.catalog_name}</div>
                                    <div className="text-xs font-mono text-muted-foreground">{c.catalog_code}</div>
                                </div>
                                <StatusBadge status={c.status} />
                            </div>
                        ))}
                </Card>
                <Card className="p-6 surface-card rounded-sm" data-testid="recently-returned-list">
                    <div className="label-uppercase mb-3">Recently Returned</div>
                    {stats.recently_returned.length === 0 ? <div className="text-sm text-muted-foreground">No returns yet.</div> :
                        stats.recently_returned.map((r) => (
                            <div key={r.id} className="py-2 border-b last:border-0 border-border text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{r.condition}</span>
                                    <span className="text-xs text-muted-foreground">{(r.return_date || "").slice(0, 10)}</span>
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{r.remarks}</div>
                            </div>
                        ))}
                </Card>
                <Card className="p-6 surface-card rounded-sm" data-testid="overdue-list">
                    <div className="label-uppercase mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-accent" /> Overdue
                    </div>
                    {stats.overdue_catalogs.length === 0 ? <div className="text-sm text-muted-foreground">All clear — nothing overdue.</div> :
                        stats.overdue_catalogs.map((o) => (
                            <div key={o.id} className="py-2 border-b last:border-0 border-border text-sm">
                                <div className="font-medium truncate">{o.catalog_name}</div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span className="font-mono">{o.catalog_code}</span>
                                    <span className="text-accent font-semibold">{o.overdue_days}d overdue</span>
                                </div>
                            </div>
                        ))}
                </Card>
            </div>
        </div>
    );
}
