import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { api, API, apiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Card } from "../components/ui/card";
import { Plus, Search, Eye, Pencil, Archive, RotateCcw, Image as ImageIcon, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth, can } from "../lib/auth";

const FABRIC_TYPES = ["Cotton", "Linen", "Denim", "Silk", "Polyester", "Rayon", "Blended", "Wool", "Velvet", "Other"];

export default function Catalogs() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [q, setQ] = useState("");
    const [status, setStatus] = useState("all");
    const [categoryId, setCategoryId] = useState("all");
    const [supplierId, setSupplierId] = useState("all");
    const [includeArchived, setIncludeArchived] = useState(false);
    const [categories, setCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [importOpen, setImportOpen] = useState(false);
    const [pageSize, setPageSize] = useState(50);
    const [page, setPage] = useState(0);   // zero-indexed

    const load = useCallback(async () => {
        const params = { include_archived: includeArchived, skip: page * pageSize, limit: pageSize };
        if (q) params.q = q;
        if (status !== "all") params.status = status;
        if (categoryId !== "all") params.category_id = categoryId;
        if (supplierId !== "all") params.supplier_id = supplierId;
        const { data } = await api.get("/catalogs", { params });
        setItems(data.items); setTotal(data.total);
    }, [q, status, categoryId, supplierId, includeArchived, page, pageSize]);

    // Reset to page 0 when any filter changes (but not when page changes)
    useEffect(() => { setPage(0); }, [q, status, categoryId, supplierId, includeArchived, pageSize]);

    useEffect(() => {
        api.get("/categories").then(({ data }) => setCategories(data));
        api.get("/suppliers").then(({ data }) => setSuppliers(data));
    }, []);
    useEffect(() => { load(); }, [load]);

    const archive = async (c) => { try { await api.post(`/catalogs/${c.id}/archive`); toast.success("Archived"); load(); } catch (e) { toast.error(apiError(e)); } };
    const restore = async (c) => { try { await api.post(`/catalogs/${c.id}/restore`); toast.success("Restored"); load(); } catch (e) { toast.error(apiError(e)); } };

    const isAdmin = can(user, "admin");
    const canCreate = can(user, "admin", "supervisor");

    return (
        <div>
            <PageHeader
                title="Catalogs"
                subtitle="Inventory · Swatch Books"
                actions={
                    <>
                        {canCreate && (
                            <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="import-catalog-btn">
                                <Upload className="w-4 h-4 mr-2" /> Bulk Import
                            </Button>
                        )}
                        {canCreate && (
                            <Button data-testid="add-catalog-btn" onClick={() => { setEditing(null); setOpen(true); }}>
                                <Plus className="w-4 h-4 mr-2" /> Add Catalog
                            </Button>
                        )}
                    </>
                }
            />

            <Card className="p-4 surface-card rounded-sm mb-6">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-2 relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input placeholder="Search code, name, color, QR…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="catalog-search-input" />
                    </div>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="Available">Available</SelectItem>
                            <SelectItem value="Issued">Issued</SelectItem>
                            <SelectItem value="Returned">Returned</SelectItem>
                            <SelectItem value="Archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger data-testid="filter-category"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All categories</SelectItem>
                            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger data-testid="filter-supplier"><SelectValue placeholder="Supplier" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All suppliers</SelectItem>
                            {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => { setQ(""); setStatus("all"); setCategoryId("all"); setSupplierId("all"); }} data-testid="reset-filters">
                        Reset filters
                    </Button>
                </div>
            </Card>

            <Card className="surface-card rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr className="text-left">
                                <th className="px-4 py-3 label-uppercase">Code</th>
                                <th className="px-4 py-3 label-uppercase">Cat No</th>
                                <th className="px-4 py-3 label-uppercase">Name</th>
                                <th className="px-4 py-3 label-uppercase">Supplier</th>
                                <th className="px-4 py-3 label-uppercase">Qty</th>
                                <th className="px-4 py-3 label-uppercase">Selling</th>
                                {isAdmin && <th className="px-4 py-3 label-uppercase">Buying</th>}
                                <th className="px-4 py-3 label-uppercase">Status</th>
                                <th className="px-4 py-3 label-uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 && (
                                <tr><td colSpan={isAdmin ? 9 : 8} className="px-4 py-10 text-center text-muted-foreground">No catalogs found.</td></tr>
                            )}
                            {items.map((c) => {
                                const supName = suppliers.find((s) => s.id === c.supplier_id)?.name || "—";
                                return (
                                    <tr key={c.id} className="border-t border-border hover:bg-muted/30" data-testid={`catalog-row-${c.catalog_code}`}>
                                        <td className="px-4 py-3 font-mono text-xs">{c.catalog_code}</td>
                                        <td className="px-4 py-3 font-mono text-xs">{c.cat_no || "—"}</td>
                                        <td className="px-4 py-3 font-medium">{c.catalog_name}</td>
                                        <td className="px-4 py-3">{supName}</td>
                                        <td className="px-4 py-3">{c.quantity || 1}</td>
                                        <td className="px-4 py-3 font-mono">{c.selling_price != null ? `AED ${Number(c.selling_price).toFixed(2)}` : "—"}</td>
                                        {isAdmin && <td className="px-4 py-3 font-mono text-accent">{c.buying_price != null ? `AED ${Number(c.buying_price).toFixed(2)}` : "—"}</td>}
                                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                        <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                            <Button size="sm" variant="ghost" onClick={() => navigate(`/catalogs/${c.id}`)} data-testid={`view-catalog-${c.catalog_code}`}>
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            {isAdmin && (
                                                <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }} data-testid={`edit-catalog-${c.catalog_code}`}>
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div data-testid="pagination-info">
                        Showing <span className="font-mono">{total === 0 ? 0 : page * pageSize + 1}</span>–
                        <span className="font-mono">{Math.min((page + 1) * pageSize, total)}</span> of
                        <span className="font-mono"> {total}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="label-uppercase">Rows</span>
                        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                            <SelectTrigger className="w-20 h-8" data-testid="page-size-select"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="200">200</SelectItem>
                                <SelectItem value="500">500</SelectItem>
                                <SelectItem value="1500">All</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" disabled={page === 0}
                                onClick={() => setPage(0)} data-testid="page-first">«</Button>
                        <Button size="sm" variant="outline" disabled={page === 0}
                                onClick={() => setPage((p) => Math.max(0, p - 1))} data-testid="page-prev">‹ Prev</Button>
                        <span className="font-mono">Page {page + 1} / {Math.max(1, Math.ceil(total / pageSize))}</span>
                        <Button size="sm" variant="outline" disabled={(page + 1) * pageSize >= total}
                                onClick={() => setPage((p) => p + 1)} data-testid="page-next">Next ›</Button>
                        <Button size="sm" variant="outline" disabled={(page + 1) * pageSize >= total}
                                onClick={() => setPage(Math.max(0, Math.ceil(total / pageSize) - 1))} data-testid="page-last">»</Button>
                    </div>
                </div>
            </Card>

            <CatalogFormDialog
                open={open} onClose={() => setOpen(false)} editing={editing}
                categories={categories} suppliers={suppliers} isAdmin={isAdmin}
                onSaved={() => { setOpen(false); load(); }}
            />
            <BulkImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />
        </div>
    );
}

function CatalogFormDialog({ open, onClose, editing, categories, suppliers, isAdmin, onSaved }) {
    const empty = {
        catalog_code: "", catalog_name: "", cat_no: "", quantity: 1,
        category_id: "", supplier_id: "",
        fabric_type: "", material_composition: "", gsm: "", color: "",
        total_swatches: 0, description: "", catalog_image: "",
        qr_value: "", buying_price: "", selling_price: "",
        remarks: "", receiving_date: ""
    };
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editing) {
            setForm({
                catalog_code: editing.catalog_code || "",
                catalog_name: editing.catalog_name || "",
                cat_no: editing.cat_no || "",
                quantity: editing.quantity ?? 1,
                category_id: editing.category_id || "",
                supplier_id: editing.supplier_id || "",
                fabric_type: editing.fabric_type || "",
                material_composition: editing.material_composition || "",
                gsm: editing.gsm ?? "",
                color: editing.color || "",
                total_swatches: editing.total_swatches || 0,
                description: editing.description || "",
                catalog_image: editing.catalog_image || "",
                qr_value: editing.qr_value || "",
                buying_price: editing.buying_price ?? "",
                selling_price: editing.selling_price ?? "",
                remarks: editing.remarks || "",
                receiving_date: editing.receiving_date || "",
            });
        } else { setForm(empty); }
    }, [editing, open]);

    const onImage = (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        if (f.size > 1024 * 1024) { toast.error("Image must be < 1MB"); return; }
        const reader = new FileReader();
        reader.onload = () => setForm((p) => ({ ...p, catalog_image: reader.result }));
        reader.readAsDataURL(f);
    };

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        const payload = {
            ...form,
            gsm: form.gsm !== "" ? Number(form.gsm) : null,
            total_swatches: Number(form.total_swatches) || 0,
            quantity: Number(form.quantity) || 1,
            buying_price: form.buying_price !== "" ? Number(form.buying_price) : null,
            selling_price: form.selling_price !== "" ? Number(form.selling_price) : null,
        };
        if (!payload.category_id) delete payload.category_id;
        if (!payload.supplier_id) delete payload.supplier_id;
        try {
            if (editing) await api.patch(`/catalogs/${editing.id}`, payload);
            else await api.post("/catalogs", payload);
            toast.success(editing ? "Catalog updated" : "Catalog created");
            onSaved();
        } catch (e) { toast.error(apiError(e)); }
        finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editing ? "Edit Catalog" : "Add Catalog"}</DialogTitle></DialogHeader>
                <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label className="label-uppercase">Catalog Code *</Label>
                        <Input required value={form.catalog_code} onChange={(e) => setForm({ ...form, catalog_code: e.target.value })} data-testid="catalog-code-input" />
                    </div>
                    <div>
                        <Label className="label-uppercase">Catalog Name *</Label>
                        <Input required value={form.catalog_name} onChange={(e) => setForm({ ...form, catalog_name: e.target.value })} data-testid="catalog-name-input" />
                    </div>
                    <div>
                        <Label className="label-uppercase">Cat No</Label>
                        <Input value={form.cat_no} onChange={(e) => setForm({ ...form, cat_no: e.target.value })} data-testid="catalog-catno-input" />
                    </div>
                    <div>
                        <Label className="label-uppercase">Quantity</Label>
                        <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                    </div>
                    <div>
                        <Label className="label-uppercase">Category</Label>
                        <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                            <SelectTrigger data-testid="catalog-category-select"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">— None —</SelectItem>
                                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="label-uppercase">Supplier</Label>
                        <Select value={form.supplier_id || "none"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "none" ? "" : v })}>
                            <SelectTrigger data-testid="catalog-supplier-select"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">— None —</SelectItem>
                                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="label-uppercase">Fabric Type</Label>
                        <Select value={form.fabric_type || "none"} onValueChange={(v) => setForm({ ...form, fabric_type: v === "none" ? "" : v })}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">— None —</SelectItem>
                                {FABRIC_TYPES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="label-uppercase">GSM</Label>
                        <Input type="number" value={form.gsm} onChange={(e) => setForm({ ...form, gsm: e.target.value })} />
                    </div>
                    <div>
                        <Label className="label-uppercase">Color</Label>
                        <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                    </div>
                    <div>
                        <Label className="label-uppercase">Swatches</Label>
                        <Input type="number" value={form.total_swatches} onChange={(e) => setForm({ ...form, total_swatches: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                        <Label className="label-uppercase">QR Code Value (from spec sheet)</Label>
                        <Input value={form.qr_value} onChange={(e) => setForm({ ...form, qr_value: e.target.value })} placeholder="e.g. QR-FC-001-XYZ" data-testid="catalog-qr-input" />
                        <p className="text-xs text-muted-foreground mt-1">QR codes are NOT auto-generated — enter the value printed on the product.</p>
                    </div>
                    <div>
                        <Label className="label-uppercase">Selling Price (AED)</Label>
                        <Input type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} data-testid="catalog-selling-price-input" />
                    </div>
                    {isAdmin && (
                        <div>
                            <Label className="label-uppercase">Buying Price (AED) <span className="text-accent">(Admin)</span></Label>
                            <Input type="number" step="0.01" value={form.buying_price} onChange={(e) => setForm({ ...form, buying_price: e.target.value })} data-testid="catalog-buying-price-input" />
                        </div>
                    )}
                    <div className="md:col-span-2">
                        <Label className="label-uppercase">Material Composition</Label>
                        <Input value={form.material_composition} onChange={(e) => setForm({ ...form, material_composition: e.target.value })} placeholder="e.g. 60% Cotton, 40% Polyester" />
                    </div>
                    <div className="md:col-span-2">
                        <Label className="label-uppercase">Description</Label>
                        <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                        <Label className="label-uppercase">Catalog Image (max 1MB)</Label>
                        <input type="file" accept="image/*" onChange={onImage} className="text-sm mt-1" data-testid="catalog-image-input" />
                        {form.catalog_image && <img src={form.catalog_image} alt="" className="mt-2 w-24 h-24 object-cover border border-border rounded-sm" />}
                    </div>
                    <DialogFooter className="md:col-span-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={saving} data-testid="save-catalog-btn">{saving ? "Saving…" : "Save"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function BulkImportDialog({ open, onClose, onDone }) {
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);
    const [report, setReport] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true); setReport(null);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const { data } = await api.post("/catalogs/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
            setReport(data);
            toast.success(`Imported ${data.imported} / ${data.total}`);
        } catch (e) { toast.error(apiError(e)); }
        finally { setBusy(false); }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Bulk Import Catalogs</DialogTitle>
                    <DialogDescription>
                        Upload an Excel file (.xlsx) — one row per catalog. Required columns: <span className="font-mono">catalog_code</span>, <span className="font-mono">catalog_name</span>. Optional: category, supplier, fabric_type, material_composition, gsm, color, total_swatches, description, qr_value, buying_price, selling_price.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <Button variant="outline" type="button"
                        onClick={() => window.open(`${API}/catalogs/import/template.xlsx`, "_blank")}
                        data-testid="download-template-btn">
                        <Download className="w-4 h-4 mr-2" /> Download Template
                    </Button>
                    <form onSubmit={submit} className="space-y-3">
                        <Label className="label-uppercase">Excel file</Label>
                        <input type="file" accept=".xlsx" required onChange={(e) => setFile(e.target.files?.[0])} className="text-sm block" data-testid="import-file-input" />
                        <Button type="submit" disabled={busy || !file} data-testid="upload-import-btn">
                            <Upload className="w-4 h-4 mr-2" /> {busy ? "Importing…" : "Upload & Import"}
                        </Button>
                    </form>
                    {report && (
                        <Card className="p-4 surface-card rounded-sm" data-testid="import-report">
                            <div className="font-display font-bold mb-2">Import Report</div>
                            <div className="text-sm grid grid-cols-3 gap-2 mb-3">
                                <div><div className="label-uppercase">Total Rows</div><div className="font-display text-xl">{report.total}</div></div>
                                <div><div className="label-uppercase text-[hsl(var(--success))]">Imported</div><div className="font-display text-xl text-[hsl(var(--success))]">{report.imported}</div></div>
                                <div><div className="label-uppercase text-destructive">Failed</div><div className="font-display text-xl text-destructive">{report.failed}</div></div>
                            </div>
                            {report.errors?.length > 0 && (
                                <div className="text-xs max-h-40 overflow-y-auto">
                                    <div className="label-uppercase mb-1">Errors</div>
                                    <ul className="space-y-1">
                                        {report.errors.map((er, i) => (
                                            <li key={i} className="font-mono">Row {er.row}: {er.catalog_code ? `${er.catalog_code} — ` : ""}{er.error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div className="mt-3 text-right">
                                <Button type="button" onClick={onDone}>Done</Button>
                            </div>
                        </Card>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
