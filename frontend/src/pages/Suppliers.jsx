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

const EMPTY = { name: "", contact_person: "", email: "", phone: "", address: "", gst_number: "", notes: "" };

export default function Suppliers() {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [includeArchived, setIncludeArchived] = useState(false);

    const load = async () => {
        const { data } = await api.get("/suppliers", { params: { include_archived: includeArchived } });
        setItems(data);
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [includeArchived]);

    const save = async (e) => {
        e.preventDefault();
        try {
            if (editing) await api.patch(`/suppliers/${editing.id}`, form);
            else await api.post("/suppliers", form);
            toast.success("Saved"); setOpen(false); load();
        } catch (e) { toast.error(apiError(e)); }
    };

    return (
        <div>
            <PageHeader
                title="Suppliers"
                subtitle="Vendor · Network"
                actions={
                    <>
                        <Button variant={includeArchived ? "default" : "outline"} onClick={() => setIncludeArchived((v) => !v)}>
                            {includeArchived ? "Hide archived" : "Show archived"}
                        </Button>
                        <Button onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} data-testid="add-supplier-btn">
                            <Plus className="w-4 h-4 mr-2" /> Add Supplier
                        </Button>
                    </>
                }
            />

            <Card className="surface-card rounded-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-4 py-3 text-left label-uppercase">Name</th>
                            <th className="px-4 py-3 text-left label-uppercase">Contact</th>
                            <th className="px-4 py-3 text-left label-uppercase">Email</th>
                            <th className="px-4 py-3 text-left label-uppercase">Phone</th>
                            <th className="px-4 py-3 text-left label-uppercase">GST</th>
                            <th className="px-4 py-3 text-right label-uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No suppliers.</td></tr>}
                        {items.map((s) => (
                            <tr key={s.id} className="border-t border-border" data-testid={`supplier-row-${s.name}`}>
                                <td className="px-4 py-3 font-medium">{s.name}</td>
                                <td className="px-4 py-3">{s.contact_person || "—"}</td>
                                <td className="px-4 py-3">{s.email || "—"}</td>
                                <td className="px-4 py-3 font-mono text-xs">{s.phone || "—"}</td>
                                <td className="px-4 py-3 font-mono text-xs">{s.gst_number || "—"}</td>
                                <td className="px-4 py-3 text-right space-x-1">
                                    <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setForm({ ...EMPTY, ...s }); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                                    {s.is_archived ?
                                        <Button size="sm" variant="ghost" onClick={async () => { await api.post(`/suppliers/${s.id}/restore`); load(); }}><RotateCcw className="w-4 h-4" /></Button> :
                                        <Button size="sm" variant="ghost" onClick={async () => { await api.post(`/suppliers/${s.id}/archive`); load(); }}><Archive className="w-4 h-4" /></Button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader><DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
                    <form onSubmit={save} className="grid grid-cols-2 gap-4">
                        <div className="col-span-2"><Label className="label-uppercase">Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="supplier-name-input" /></div>
                        <div><Label className="label-uppercase">Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
                        <div><Label className="label-uppercase">Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                        <div className="col-span-2"><Label className="label-uppercase">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                        <div className="col-span-2"><Label className="label-uppercase">Address</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                        <div><Label className="label-uppercase">GST Number</Label><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></div>
                        <div><Label className="label-uppercase">Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                        <DialogFooter className="col-span-2">
                            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" data-testid="save-supplier-btn">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
