import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { api, apiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Card } from "../components/ui/card";
import { Plus, Search, Eye, Pencil, Archive, RotateCcw, Image as ImageIcon } from "lucide-react";
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

    const load = useCallback(async () => {
        const params = { include_archived: includeArchived };
        if (q) params.q = q;
        if (status !== "all") params.status = status;
        if (categoryId !== "all") params.category_id = categoryId;
        if (supplierId !== "all") params.supplier_id = supplierId;
        const { data } = await api.get("/catalogs", { params });
        setItems(data.items); setTotal(data.total);
    }, [q, status, categoryId, supplierId, includeArchived]);

    useEffect(() => {
        api.get("/categories").then(({ data }) => setCategories(data));
        api.get("/suppliers").then(({ data }) => setSuppliers(data));
    }, []);
    useEffect(() => { load(); }, [load]);

    const archive = async (c) => {
        try { await api.post(`/catalogs/${c.id}/archive`); toast.success("Archived"); load(); }
        catch (e) { toast.error(apiError(e)); }
    };
    const restore = async (c) => {
        try { await api.post(`/catalogs/${c.id}/restore`); toast.success("Restored"); load(); }
        catch (e) { toast.error(apiError(e)); }
    };

    return (
        <div>
            <PageHeader
                title="Catalogs"
                subtitle="Inventory · Swatch Books"
                actions={
                    can(user, "admin", "manager") && (
                        <Button data-testid="add-catalog-btn" onClick={() => { setEditing(null); setOpen(true); }}>
                            <Plus className="w-4 h-4 mr-2" /> Add Catalog
                        </Button>
                    )
                }
            />

            <Card className="p-4 surface-card rounded-sm mb-6">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-2 relative">
                        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input placeholder="Search code, name, color…" value={q} onChange={(e) => setQ(e.target.value)}
                            className="pl-9" data-testid="catalog-search-input" />
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
                    <Button variant={includeArchived ? "default" : "outline"} onClick={() => setIncludeArchived((v) => !v)}
                        data-testid="toggle-archived">
                        {includeArchived ? "Hiding nothing" : "Show archived"}
                    </Button>
                </div>
            </Card>

            <Card className="surface-card rounded-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr className="text-left">
                                <th className="px-4 py-3 label-uppercase">Image</th>
                                <th className="px-4 py-3 label-uppercase">Code</th>
                                <th className="px-4 py-3 label-uppercase">Name</th>
                                <th className="px-4 py-3 label-uppercase">Fabric</th>
                                <th className="px-4 py-3 label-uppercase">GSM</th>
                                <th className="px-4 py-3 label-uppercase">Color</th>
                                <th className="px-4 py-3 label-uppercase">Swatches</th>
                                <th className="px-4 py-3 label-uppercase">Status</th>
                                <th className="px-4 py-3 label-uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 && (
                                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                                    No catalogs found. Add your first to get started.
                                </td></tr>
                            )}
                            {items.map((c) => (
                                <tr key={c.id} className="border-t border-border hover:bg-muted/30" data-testid={`catalog-row-${c.catalog_code}`}>
                                    <td className="px-4 py-3">
                                        {c.catalog_image ?
                                            <img src={c.catalog_image} alt="" className="w-10 h-10 object-cover rounded-sm border border-border" /> :
                                            <div className="w-10 h-10 grid place-items-center bg-muted text-muted-foreground rounded-sm"><ImageIcon className="w-4 h-4" /></div>}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">{c.catalog_code}</td>
                                    <td className="px-4 py-3 font-medium">{c.catalog_name}</td>
                                    <td className="px-4 py-3">{c.fabric_type || "—"}</td>
                                    <td className="px-4 py-3">{c.gsm || "—"}</td>
                                    <td className="px-4 py-3">{c.color || "—"}</td>
                                    <td className="px-4 py-3">{c.total_swatches || 0}</td>
                                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                    <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                        <Button size="sm" variant="ghost" onClick={() => navigate(`/catalogs/${c.id}`)} data-testid={`view-catalog-${c.catalog_code}`}>
                                            <Eye className="w-4 h-4" />
                                        </Button>
                                        {can(user, "admin", "manager") && (
                                            <>
                                                <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }} data-testid={`edit-catalog-${c.catalog_code}`}>
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                {c.is_archived ?
                                                    <Button size="sm" variant="ghost" onClick={() => restore(c)} data-testid={`restore-catalog-${c.catalog_code}`}>
                                                        <RotateCcw className="w-4 h-4" />
                                                    </Button> :
                                                    <Button size="sm" variant="ghost" onClick={() => archive(c)} data-testid={`archive-catalog-${c.catalog_code}`}>
                                                        <Archive className="w-4 h-4" />
                                                    </Button>}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
                    Showing {items.length} of {total}
                </div>
            </Card>

            <CatalogFormDialog
                open={open} onClose={() => setOpen(false)} editing={editing}
                categories={categories} suppliers={suppliers}
                onSaved={() => { setOpen(false); load(); }}
            />
        </div>
    );
}

function CatalogFormDialog({ open, onClose, editing, categories, suppliers, onSaved }) {
    const empty = {
        catalog_code: "", catalog_name: "", category_id: "", supplier_id: "",
        fabric_type: "", material_composition: "", gsm: "", color: "",
        total_swatches: 0, description: "", catalog_image: ""
    };
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editing) {
            setForm({
                catalog_code: editing.catalog_code || "",
                catalog_name: editing.catalog_name || "",
                category_id: editing.category_id || "",
                supplier_id: editing.supplier_id || "",
                fabric_type: editing.fabric_type || "",
                material_composition: editing.material_composition || "",
                gsm: editing.gsm || "",
                color: editing.color || "",
                total_swatches: editing.total_swatches || 0,
                description: editing.description || "",
                catalog_image: editing.catalog_image || "",
            });
        } else {
            setForm(empty);
        }
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
        const payload = { ...form, gsm: form.gsm ? Number(form.gsm) : null, total_swatches: Number(form.total_swatches) || 0 };
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
                        <Input required value={form.catalog_code} onChange={(e) => setForm({ ...form, catalog_code: e.target.value })}
                            data-testid="catalog-code-input" />
                    </div>
                    <div>
                        <Label className="label-uppercase">Catalog Name *</Label>
                        <Input required value={form.catalog_name} onChange={(e) => setForm({ ...form, catalog_name: e.target.value })}
                            data-testid="catalog-name-input" />
                    </div>
                    <div>
                        <Label className="label-uppercase">Category</Label>
                        <Select value={form.category_id || "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? "" : v })}>
                            <SelectTrigger data-testid="catalog-category-select"><SelectValue placeholder="Select category" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">— None —</SelectItem>
                                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="label-uppercase">Supplier</Label>
                        <Select value={form.supplier_id || "none"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "none" ? "" : v })}>
                            <SelectTrigger data-testid="catalog-supplier-select"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">— None —</SelectItem>
                                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="label-uppercase">Fabric Type</Label>
                        <Select value={form.fabric_type || "none"} onValueChange={(v) => setForm({ ...form, fabric_type: v === "none" ? "" : v })}>
                            <SelectTrigger data-testid="catalog-fabric-select"><SelectValue placeholder="Select" /></SelectTrigger>
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
                        <Label className="label-uppercase">Material Composition</Label>
                        <Input value={form.material_composition} onChange={(e) => setForm({ ...form, material_composition: e.target.value })}
                            placeholder="e.g. 60% Cotton, 40% Polyester" />
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
