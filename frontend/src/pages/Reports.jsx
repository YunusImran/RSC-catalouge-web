import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { api, API } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { FileText, FileSpreadsheet, FileDown, ScrollText, UserSquare2 } from "lucide-react";

export default function Reports() {
    const [status, setStatus] = useState("all");
    const [archived, setArchived] = useState("false");
    const [empReport, setEmpReport] = useState([]);

    useEffect(() => { api.get("/reports/employee-wise").then(({ data }) => setEmpReport(data)); }, []);

    const download = (path) => window.open(`${API}/reports/${path}`, "_blank");
    const downloadCatalogs = (fmt) => {
        const params = new URLSearchParams();
        if (status !== "all") params.set("status", status);
        params.set("include_archived", archived);
        window.open(`${API}/reports/catalogs/${fmt}?${params.toString()}`, "_blank");
    };

    return (
        <div>
            <PageHeader title="Reports & Exports" subtitle="Analytics · Operations" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Issue Report */}
                <Card className="p-6 surface-card rounded-sm">
                    <div className="flex items-center gap-2 mb-2"><ScrollText className="w-5 h-5 text-accent" />
                        <h3 className="font-display font-bold text-xl">Issue Report</h3></div>
                    <p className="text-sm text-muted-foreground mb-4">
                        Each row includes Txn ID, catalog, supplier, customer name, employee name, mobile,
                        issue date, due date, <b>is overdue</b>, <b>is available</b>, issued by, status.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => download("issues/pdf")} data-testid="export-issue-pdf"><FileText className="w-4 h-4 mr-2" /> PDF</Button>
                        <Button onClick={() => download("issues/xlsx")} variant="outline" data-testid="export-issue-xlsx"><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
                        <Button onClick={() => download("issues/csv")} variant="outline" data-testid="export-issue-csv"><FileDown className="w-4 h-4 mr-2" /> CSV</Button>
                    </div>
                </Card>

                {/* Catalog Report */}
                <Card className="p-6 surface-card rounded-sm">
                    <div className="flex items-center gap-2 mb-2"><FileText className="w-5 h-5 text-primary" />
                        <h3 className="font-display font-bold text-xl">Catalog Report</h3></div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                            <Label className="label-uppercase">Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger data-testid="report-status-select"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="Available">Available</SelectItem>
                                    <SelectItem value="Issued">Issued</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="label-uppercase">Include Archived</Label>
                            <Select value={archived} onValueChange={setArchived}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="false">No</SelectItem>
                                    <SelectItem value="true">Yes</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => downloadCatalogs("pdf")} data-testid="export-pdf-btn"><FileText className="w-4 h-4 mr-2" /> PDF</Button>
                        <Button onClick={() => downloadCatalogs("xlsx")} variant="outline" data-testid="export-xlsx-btn"><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
                        <Button onClick={() => downloadCatalogs("csv")} variant="outline" data-testid="export-csv-btn"><FileDown className="w-4 h-4 mr-2" /> CSV</Button>
                    </div>
                </Card>

                {/* Employee-wise Report */}
                <Card className="lg:col-span-2 p-6 surface-card rounded-sm">
                    <div className="flex items-center gap-2 mb-4"><UserSquare2 className="w-5 h-5 text-chart-3" />
                        <h3 className="font-display font-bold text-xl">Employee-wise Issue Summary</h3></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left label-uppercase">Employee</th>
                                    <th className="px-4 py-3 text-right label-uppercase">Total Issues</th>
                                    <th className="px-4 py-3 text-right label-uppercase">Active</th>
                                    <th className="px-4 py-3 text-right label-uppercase">Returned</th>
                                </tr>
                            </thead>
                            <tbody>
                                {empReport.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No data yet.</td></tr>}
                                {empReport.map((r, i) => (
                                    <tr key={i} className="border-t border-border" data-testid={`emp-report-${r.employee_name}`}>
                                        <td className="px-4 py-3 font-medium">{r.employee_name}</td>
                                        <td className="px-4 py-3 text-right font-display text-lg">{r.total_issues}</td>
                                        <td className="px-4 py-3 text-right">{r.active}</td>
                                        <td className="px-4 py-3 text-right">{r.returned}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
