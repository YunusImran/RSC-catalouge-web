import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { api } from "../lib/api";
import { Card } from "../components/ui/card";

export default function AuditLogs() {
    const [rows, setRows] = useState([]);
    useEffect(() => { api.get("/audit-logs").then(({ data }) => setRows(data)); }, []);
    return (
        <div>
            <PageHeader title="Audit Logs" subtitle="Compliance · Activity" />
            <Card className="surface-card rounded-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-4 py-3 text-left label-uppercase">Time</th>
                            <th className="px-4 py-3 text-left label-uppercase">User</th>
                            <th className="px-4 py-3 text-left label-uppercase">Action</th>
                            <th className="px-4 py-3 text-left label-uppercase">Description</th>
                            <th className="px-4 py-3 text-left label-uppercase">IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No activity yet.</td></tr>}
                        {rows.map((r) => (
                            <tr key={r.id} className="border-t border-border" data-testid={`audit-row-${r.id}`}>
                                <td className="px-4 py-3 font-mono text-xs">{(r.created_at || "").slice(0, 19).replace("T", " ")}</td>
                                <td className="px-4 py-3">{r.user_email}</td>
                                <td className="px-4 py-3"><span className="font-mono text-xs px-2 py-0.5 bg-muted rounded-sm">{r.action}</span></td>
                                <td className="px-4 py-3">{r.description}</td>
                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.ip_address}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
