import React, { useState } from "react";
import PageHeader from "../components/PageHeader";
import { API } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { FileText, FileSpreadsheet, FileDown } from "lucide-react";

export default function Reports() {
    const [status, setStatus] = useState("all");
    const [archived, setArchived] = useState("false");

    const download = (fmt) => {
        const params = new URLSearchParams();
        if (status !== "all") params.set("status", status);
        params.set("include_archived", archived);
        const url = `${API}/reports/catalogs/${fmt}?${params.toString()}`;
        // open in new tab with credentials via cookies (same site)
        window.open(url, "_blank");
    };

    return (
        <div>
            <PageHeader title="Reports & Exports" subtitle="Catalog · Analytics" />
            <Card className="p-6 surface-card rounded-sm max-w-3xl">
                <h3 className="font-display font-bold text-xl mb-4">Catalog Report</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <Label className="label-uppercase">Filter by Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger data-testid="report-status-select"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="Available">Available</SelectItem>
                                <SelectItem value="Issued">Issued</SelectItem>
                                <SelectItem value="Returned">Returned</SelectItem>
                                <SelectItem value="Archived">Archived</SelectItem>
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
                <div className="flex flex-wrap gap-3">
                    <Button onClick={() => download("pdf")} data-testid="export-pdf-btn"><FileText className="w-4 h-4 mr-2" /> Export PDF</Button>
                    <Button onClick={() => download("xlsx")} variant="outline" data-testid="export-xlsx-btn"><FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel</Button>
                    <Button onClick={() => download("csv")} variant="outline" data-testid="export-csv-btn"><FileDown className="w-4 h-4 mr-2" /> Export CSV</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-6">
                    Reports include code, name, status, fabric type, GSM, color, swatches and creation date.
                    Files are generated on demand from live data.
                </p>
            </Card>
        </div>
    );
}
