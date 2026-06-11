import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { api } from "../lib/api";
import { Card } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import StatusBadge from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Eye, AlertTriangle } from "lucide-react";
import { useAuth, can } from "../lib/auth";

export default function IssuesReturns() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [issues, setIssues] = useState([]);
    const [returns, setReturns] = useState([]);
    const [filter, setFilter] = useState("active");
    const canReturn = can(user, "admin", "supervisor");

    const loadIssues = useCallback(() => {
        const params = filter && filter !== "all" ? { filter } : {};
        api.get("/issues", { params }).then(({ data }) => setIssues(data));
    }, [filter]);

    useEffect(() => { loadIssues(); }, [loadIssues]);
    useEffect(() => {
        if (!canReturn) return;
        api.get("/returns").then(({ data }) => setReturns(data));
    }, [canReturn]);

    return (
        <div>
            <PageHeader title="Issues & Returns" subtitle="Catalog · Lifecycle" />
            <Tabs defaultValue="issues">
                <TabsList>
                    <TabsTrigger value="issues" data-testid="tab-active-issues">Issues ({issues.length})</TabsTrigger>
                    {canReturn && <TabsTrigger value="returns" data-testid="tab-all-returns">Returns ({returns.length})</TabsTrigger>}
                </TabsList>
                <TabsContent value="issues">
                    <div className="mt-4 flex items-center gap-3 mb-3">
                        <span className="label-uppercase">Filter</span>
                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="w-56" data-testid="issues-filter-select"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Issues</SelectItem>
                                <SelectItem value="active">Active Issues</SelectItem>
                                <SelectItem value="due_today">Due Today</SelectItem>
                                <SelectItem value="due_week">Due This Week</SelectItem>
                                <SelectItem value="overdue">Overdue Issues</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Card className="surface-card rounded-sm overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left label-uppercase">Code</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Catalog</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Customer</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Employee</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Mobile</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Issue Date</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Due Date</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Status</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {issues.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No issues found.</td></tr>}
                                {issues.map((i) => (
                                    <tr key={i.id} className={`border-t border-border ${i.is_overdue ? "bg-accent/10" : ""}`} data-testid={`issue-row-${i.id}`}>
                                        <td className="px-4 py-3 font-mono text-xs">{i.catalog_code || "—"}</td>
                                        <td className="px-4 py-3 font-medium">{i.catalog_name || "—"}</td>
                                        <td className="px-4 py-3">{i.customer_name || "—"}</td>
                                        <td className="px-4 py-3">{i.employee_name || "—"}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{i.mobile || "—"}</td>
                                        <td className="px-4 py-3">{(i.issue_date || "").slice(0, 10)}</td>
                                        <td className="px-4 py-3">
                                            {(i.expected_return_date || "").slice(0, 10) || "—"}
                                            {i.is_overdue && (
                                                <span className="ml-2 inline-flex items-center gap-1 text-xs text-accent font-semibold">
                                                    <AlertTriangle className="w-3 h-3" /> {i.overdue_days}d overdue
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={i.is_overdue ? "Overdue" : i.status} /></td>
                                        <td className="px-4 py-3 text-right">
                                            <Button size="sm" variant="ghost" onClick={() => navigate(`/catalogs/${i.catalog_id}`)}><Eye className="w-4 h-4" /></Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </TabsContent>
                {canReturn && (
                    <TabsContent value="returns">
                        <Card className="surface-card rounded-sm overflow-x-auto mt-4">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left label-uppercase">Code</th>
                                        <th className="px-4 py-3 text-left label-uppercase">Catalog</th>
                                        <th className="px-4 py-3 text-left label-uppercase">Customer</th>
                                        <th className="px-4 py-3 text-left label-uppercase">Mobile</th>
                                        <th className="px-4 py-3 text-left label-uppercase">Returned By</th>
                                        <th className="px-4 py-3 text-left label-uppercase">Date</th>
                                        <th className="px-4 py-3 text-left label-uppercase">Condition</th>
                                        <th className="px-4 py-3 text-left label-uppercase">Remarks</th>
                                        <th className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {returns.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No returns yet.</td></tr>}
                                    {returns.map((r) => (
                                        <tr key={r.id} className="border-t border-border" data-testid={`return-row-${r.id}`}>
                                            <td className="px-4 py-3 font-mono text-xs">{r.catalog_code || "—"}</td>
                                            <td className="px-4 py-3 font-medium">{r.catalog_name || "—"}</td>
                                            <td className="px-4 py-3">{r.customer_name || "—"}</td>
                                            <td className="px-4 py-3 font-mono text-xs">{r.mobile || "—"}</td>
                                            <td className="px-4 py-3">{r.returned_by || "—"}</td>
                                            <td className="px-4 py-3">{(r.return_date || "").slice(0, 10)}</td>
                                            <td className="px-4 py-3"><StatusBadge status={r.condition} /></td>
                                            <td className="px-4 py-3 text-muted-foreground">{r.remarks || "—"}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Button size="sm" variant="ghost" onClick={() => navigate(`/catalogs/${r.catalog_id}`)}><Eye className="w-4 h-4" /></Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
