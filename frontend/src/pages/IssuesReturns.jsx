import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { api } from "../lib/api";
import { Card } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import StatusBadge from "../components/StatusBadge";
import { Button } from "../components/ui/button";
import { Eye } from "lucide-react";

export default function IssuesReturns() {
    const navigate = useNavigate();
    const [issues, setIssues] = useState([]);
    const [returns, setReturns] = useState([]);

    useEffect(() => {
        api.get("/issues").then(({ data }) => setIssues(data));
        api.get("/returns").then(({ data }) => setReturns(data));
    }, []);

    return (
        <div>
            <PageHeader title="Issues & Returns" subtitle="Catalog · Lifecycle" />
            <Tabs defaultValue="issues">
                <TabsList>
                    <TabsTrigger value="issues" data-testid="tab-active-issues">Issues ({issues.length})</TabsTrigger>
                    <TabsTrigger value="returns" data-testid="tab-all-returns">Returns ({returns.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="issues">
                    <Card className="surface-card rounded-sm overflow-x-auto mt-4">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left label-uppercase">Code</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Catalog</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Issued To</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Dept</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Issue Date</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Expected Return</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Status</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {issues.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No issues recorded.</td></tr>}
                                {issues.map((i) => (
                                    <tr key={i.id} className="border-t border-border" data-testid={`issue-row-${i.id}`}>
                                        <td className="px-4 py-3 font-mono text-xs">{i.catalog_code || "—"}</td>
                                        <td className="px-4 py-3 font-medium">{i.catalog_name || "—"}</td>
                                        <td className="px-4 py-3">{i.customer_name || i.employee_name || "—"}</td>
                                        <td className="px-4 py-3">{i.department || "—"}</td>
                                        <td className="px-4 py-3">{(i.issue_date || "").slice(0, 10)}</td>
                                        <td className="px-4 py-3">{(i.expected_return_date || "").slice(0, 10) || "—"}</td>
                                        <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                                        <td className="px-4 py-3 text-right">
                                            <Button size="sm" variant="ghost" onClick={() => navigate(`/catalogs/${i.catalog_id}`)}><Eye className="w-4 h-4" /></Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </TabsContent>
                <TabsContent value="returns">
                    <Card className="surface-card rounded-sm overflow-x-auto mt-4">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left label-uppercase">Code</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Catalog</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Returned By</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Date</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Condition</th>
                                    <th className="px-4 py-3 text-left label-uppercase">Remarks</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {returns.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No returns yet.</td></tr>}
                                {returns.map((r) => (
                                    <tr key={r.id} className="border-t border-border" data-testid={`return-row-${r.id}`}>
                                        <td className="px-4 py-3 font-mono text-xs">{r.catalog_code || "—"}</td>
                                        <td className="px-4 py-3 font-medium">{r.catalog_name || "—"}</td>
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
            </Tabs>
        </div>
    );
}
