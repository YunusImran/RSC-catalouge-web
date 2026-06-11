import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { api, apiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, Pencil, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function Categories() {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: "", description: "" });
    const [includeArchived, setIncludeArchived] = useState(false);

    const load = async () => {
        const { data } = await api.get("/categories", { params: { include_archived: includeArchived } });
        setItems(data);
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [includeArchived]);

    const openNew = () => { setEditing(null); setForm({ name: "", description: "" }); setOpen(true); };
    const openEdit = (c) => { setEditing(c); setForm({ name: c.name, description: c.description || "" }); setOpen(true); };

    const save = async (e) => {
        e.preventDefault();
        try {
            if (editing) await api.patch(`/categories/${editing.id}`, form);
            else await api.post("/categories", form);
            toast.success("Saved"); setOpen(false); load();
        } catch (e) { toast.error(apiError(e)); }
    };
    const archive = async (c) => { await api.post(`/categories/${c.id}/archive`); load(); };
    const restore = async (c) => { await api.post(`/categories/${c.id}/restore`); load(); };

    return (
        <div>
            <PageHeader
                title="Categories"
                subtitle="Fabric · Taxonomy"
                actions={
                    <>
                        <Button variant={includeArchived ? "default" : "outline"} onClick={() => setIncludeArchived((v) => !v)}>
                            {includeArchived ? "Hide archived" : "Show archived"}
                        </Button>
                        <Button onClick={openNew} data-testid="add-category-btn"><Plus className="w-4 h-4 mr-2" /> Add Category</Button>
                    </>
                }
            />
            <Card className="surface-card rounded-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-4 py-3 text-left label-uppercase">Name</th>
                            <th className="px-4 py-3 text-left label-uppercase">Description</th>
                            <th className="px-4 py-3 text-left label-uppercase">Status</th>
                            <th className="px-4 py-3 text-right label-uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No categories.</td></tr>}
                        {items.map((c) => (
                            <tr key={c.id} className="border-t border-border" data-testid={`category-row-${c.name}`}>
                                <td className="px-4 py-3 font-medium">{c.name}</td>
                                <td className="px-4 py-3 text-muted-foreground">{c.description || "—"}</td>
                                <td className="px-4 py-3">{c.is_archived ? "Archived" : "Active"}</td>
                                <td className="px-4 py-3 text-right space-x-1">
                                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                                    {c.is_archived ?
                                        <Button size="sm" variant="ghost" onClick={() => restore(c)}><RotateCcw className="w-4 h-4" /></Button> :
                                        <Button size="sm" variant="ghost" onClick={() => archive(c)}><Archive className="w-4 h-4" /></Button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
                    <form onSubmit={save} className="space-y-4">
                        <div><Label className="label-uppercase">Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="category-name-input" /></div>
                        <div><Label className="label-uppercase">Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" data-testid="save-category-btn">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
