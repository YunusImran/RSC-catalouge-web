import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { api, API, apiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Printer, Download, ArrowUpRight, PackageOpen, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth, can } from "../lib/auth";

export default function CatalogDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [catalog, setCatalog] = useState(null);
    const [history, setHistory] = useState(null);
    const [issueOpen, setIssueOpen] = useState(false);
    const [returnOpen, setReturnOpen] = useState(false);
    const [barcodeSvg, setBarcodeSvg] = useState("");
    const [qrSvg, setQrSvg] = useState("");

    const reload = async () => {
        const { data } = await api.get(`/catalogs/${id}`);
        setCatalog(data);
        const h = await api.get(`/catalogs/${id}/history`);
        setHistory(h.data);
        const bc = await api.get(`/catalogs/${id}/barcode.svg`, { responseType: "text" });
        setBarcodeSvg(bc.data);
        const qr = await api.get(`/catalogs/${id}/qr.svg`, { responseType: "text" });
        setQrSvg(qr.data);
    };

    useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

    const downloadSvg = (svg, filename) => {
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };
    const printBarcode = () => {
        const w = window.open("", "_blank");
        w.document.write(`<html><head><title>Print</title><style>body{font-family:sans-serif;text-align:center;padding:40px;}h2{margin:6px;}</style></head><body>
          <h2>${catalog.catalog_name}</h2>
          <div style="font-family:monospace;font-size:14px;margin-bottom:12px;">${catalog.catalog_code}</div>
          ${barcodeSvg}
          <div style="margin-top:16px;display:inline-block;">${qrSvg}</div>
        </body></html>`);
        w.document.close(); w.focus(); w.print();
    };

    if (!catalog) return <div className="text-muted-foreground">Loading…</div>;

    return (
        <div>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4" data-testid="back-btn">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <PageHeader
                title={catalog.catalog_name}
                subtitle={<span className="font-mono">{catalog.catalog_code}</span>}
                actions={
                    <>
                        <StatusBadge status={catalog.status} />
                        {can(user, "admin", "manager", "staff") && catalog.status === "Available" && (
                            <Button onClick={() => setIssueOpen(true)} data-testid="issue-catalog-btn">
                                <ArrowUpRight className="w-4 h-4 mr-2" /> Issue
                            </Button>
                        )}
                        {can(user, "admin", "manager", "staff") && catalog.status === "Issued" && (
                            <Button onClick={() => setReturnOpen(true)} data-testid="return-catalog-btn">
                                <PackageOpen className="w-4 h-4 mr-2" /> Return
                            </Button>
                        )}
                    </>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-6 surface-card rounded-sm">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                        <Field label="Fabric Type" value={catalog.fabric_type} />
                        <Field label="GSM" value={catalog.gsm} />
                        <Field label="Color" value={catalog.color} />
                        <Field label="Swatches" value={catalog.total_swatches} />
                        <Field label="Composition" value={catalog.material_composition} />
                        <Field label="Created" value={(catalog.created_at || "").slice(0, 10)} />
                    </div>
                    {catalog.description && (
                        <div className="mt-6">
                            <div className="label-uppercase mb-1">Description</div>
                            <p className="text-sm">{catalog.description}</p>
                        </div>
                    )}
                    {catalog.catalog_image && (
                        <div className="mt-6">
                            <div className="label-uppercase mb-2">Catalog Image</div>
                            <img src={catalog.catalog_image} alt="" className="max-w-xs border border-border rounded-sm" />
                        </div>
                    )}
                </Card>

                <Card className="p-6 surface-card rounded-sm">
                    <div className="label-uppercase mb-3">Barcode · CODE128</div>
                    <div className="barcode-svg bg-white p-3 border border-border rounded-sm" dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
                    <div className="label-uppercase mb-3 mt-6">QR Code</div>
                    <div className="qr-svg bg-white p-3 border border-border rounded-sm max-w-[180px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={printBarcode} data-testid="print-barcode-btn">
                            <Printer className="w-4 h-4 mr-2" /> Print
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadSvg(barcodeSvg, `${catalog.catalog_code}-barcode.svg`)} data-testid="download-barcode-btn">
                            <Download className="w-4 h-4 mr-2" /> Barcode
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadSvg(qrSvg, `${catalog.catalog_code}-qr.svg`)} data-testid="download-qr-btn">
                            <Download className="w-4 h-4 mr-2" /> QR
                        </Button>
                    </div>
                </Card>
            </div>

            <Tabs defaultValue="issues" className="mt-8">
                <TabsList>
                    <TabsTrigger value="issues" data-testid="tab-issues">Issues</TabsTrigger>
                    <TabsTrigger value="returns" data-testid="tab-returns">Returns</TabsTrigger>
                    <TabsTrigger value="scans" data-testid="tab-scans">Scans</TabsTrigger>
                </TabsList>
                <TabsContent value="issues">
                    <HistoryTable
                        rows={history?.issues || []}
                        cols={[
                            ["Date", (r) => (r.issue_date || "").slice(0, 10)],
                            ["Issued To", (r) => r.customer_name || r.employee_name || "—"],
                            ["Department", (r) => r.department || "—"],
                            ["Expected Return", (r) => (r.expected_return_date || "").slice(0, 10) || "—"],
                            ["Status", (r) => r.status],
                            ["Issued By", (r) => r.issued_by],
                        ]}
                    />
                </TabsContent>
                <TabsContent value="returns">
                    <HistoryTable
                        rows={history?.returns || []}
                        cols={[
                            ["Date", (r) => (r.return_date || "").slice(0, 10)],
                            ["Condition", (r) => r.condition],
                            ["Returned By", (r) => r.returned_by || "—"],
                            ["Received By", (r) => r.received_by || "—"],
                            ["Remarks", (r) => r.remarks || "—"],
                        ]}
                    />
                </TabsContent>
                <TabsContent value="scans">
                    <HistoryTable
                        rows={history?.scans || []}
                        cols={[
                            ["Date", (r) => (r.created_at || "").slice(0, 16).replace("T", " ")],
                            ["Action", (r) => r.action],
                            ["Device", (r) => r.device_type],
                            ["User", (r) => r.user_email],
                            ["Remarks", (r) => r.remarks || "—"],
                        ]}
                    />
                </TabsContent>
            </Tabs>

            <IssueDialog open={issueOpen} onClose={() => setIssueOpen(false)} catalogId={id} onSaved={() => { setIssueOpen(false); reload(); }} />
            <ReturnDialog open={returnOpen} onClose={() => setReturnOpen(false)} catalogId={id} onSaved={() => { setReturnOpen(false); reload(); }} />
        </div>
    );
}

const Field = ({ label, value }) => (
    <div>
        <div className="label-uppercase">{label}</div>
        <div className="text-sm font-medium mt-1">{value || "—"}</div>
    </div>
);

function HistoryTable({ rows, cols }) {
    if (!rows.length) return <div className="text-sm text-muted-foreground p-6">No records.</div>;
    return (
        <Card className="surface-card rounded-sm overflow-hidden mt-4">
            <table className="w-full text-sm">
                <thead className="bg-muted/50">
                    <tr>{cols.map(([h]) => <th key={h} className="px-4 py-3 text-left label-uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={r.id || i} className="border-t border-border">
                            {cols.map(([h, fn]) => <td key={h} className="px-4 py-2">{fn(r)}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </Card>
    );
}

export function IssueDialog({ open, onClose, catalogId, onSaved }) {
    const [form, setForm] = useState({
        customer_name: "", employee_name: "", department: "", mobile: "", email: "",
        issue_date: new Date().toISOString().slice(0, 10), expected_return_date: "", remarks: ""
    });
    const submit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form, catalog_id: catalogId };
            await api.post("/issues", payload);
            toast.success("Issued successfully");
            onSaved();
        } catch (e) { toast.error(apiError(e)); }
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle>Issue Catalog</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="grid grid-cols-2 gap-4" data-testid="issue-form">
                    <div><Label className="label-uppercase">Customer</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} data-testid="issue-customer-input" /></div>
                    <div><Label className="label-uppercase">Employee</Label><Input value={form.employee_name} onChange={(e) => setForm({ ...form, employee_name: e.target.value })} /></div>
                    <div><Label className="label-uppercase">Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
                    <div><Label className="label-uppercase">Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
                    <div className="col-span-2"><Label className="label-uppercase">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label className="label-uppercase">Issue Date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
                    <div><Label className="label-uppercase">Expected Return</Label><Input type="date" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} data-testid="issue-expected-return-input" /></div>
                    <div className="col-span-2"><Label className="label-uppercase">Remarks</Label><Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
                    <DialogFooter className="col-span-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" data-testid="submit-issue-btn">Issue</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function ReturnDialog({ open, onClose, catalogId, onSaved }) {
    const [form, setForm] = useState({
        returned_by: "", return_date: new Date().toISOString().slice(0, 10),
        condition: "Good", remarks: ""
    });
    const submit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/returns", { ...form, catalog_id: catalogId });
            toast.success("Returned successfully");
            onSaved();
        } catch (e) { toast.error(apiError(e)); }
    };
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Return Catalog</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="space-y-4" data-testid="return-form">
                    <div><Label className="label-uppercase">Returned By</Label><Input value={form.returned_by} onChange={(e) => setForm({ ...form, returned_by: e.target.value })} data-testid="return-by-input" /></div>
                    <div><Label className="label-uppercase">Return Date</Label><Input type="date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })} /></div>
                    <div>
                        <Label className="label-uppercase">Condition</Label>
                        <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                            <SelectTrigger data-testid="return-condition-select"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Excellent">Excellent</SelectItem>
                                <SelectItem value="Good">Good</SelectItem>
                                <SelectItem value="Damaged">Damaged</SelectItem>
                                <SelectItem value="Missing Swatches">Missing Swatches</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div><Label className="label-uppercase">Remarks</Label><Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" data-testid="submit-return-btn">Return</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
