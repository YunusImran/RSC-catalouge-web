import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { api, apiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", employee_code: "", department: "", designation: "", mobile: "", email: "", is_active: true };

export default function Employees() {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);

    const load = async () => {
        const { data } = await api.get("/employees");
        setItems(data);
    };
    useEffect(() => { load(); }, []);

    const save = async (e) => {
        e.preventDefault();
        try {
            if (editing) await api.patch(`/employees/${editing.id}`, form);
            else await api.post("/employees", form);
            toast.success("Saved"); setOpen(false); load();
        } catch (e) { toast.error(apiError(e)); }
    };

    const remove = async (emp) => {
        if (!window.confirm(`Deactivate employee "${emp.name}"?`)) return;
        try { await api.delete(`/employees/${emp.id}`); toast.success("Deactivated"); load(); }
        catch (e) { toast.error(apiError(e)); }
    };

    return (
        <div>
            <PageHeader
                title="Employees"
                subtitle="Master · People"
                actions={<Button onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} data-testid="add-employee-btn">
                    <Plus className="w-4 h-4 mr-2" /> Add Employee
                </Button>}
            />
            <Card className="surface-card rounded-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-4 py-3 text-left label-uppercase">Name</th>
                            <th className="px-4 py-3 text-left label-uppercase">Code</th>
                            <th className="px-4 py-3 text-left label-uppercase">Department</th>
                            <th className="px-4 py-3 text-left label-uppercase">Designation</th>
                            <th className="px-4 py-3 text-left label-uppercase">Mobile</th>
                            <th className="px-4 py-3 text-left label-uppercase">Email</th>
                            <th className="px-4 py-3 text-left label-uppercase">Active</th>
                            <th className="px-4 py-3 text-right label-uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No employees yet.</td></tr>}
                        {items.map((e) => (
                            <tr key={e.id} className="border-t border-border" data-testid={`employee-row-${e.name}`}>
                                <td className="px-4 py-3 font-medium">{e.name}</td>
                                <td className="px-4 py-3 font-mono text-xs">{e.employee_code || "—"}</td>
                                <td className="px-4 py-3">{e.department || "—"}</td>
                                <td className="px-4 py-3">{e.designation || "—"}</td>
                                <td className="px-4 py-3 font-mono text-xs">{e.mobile || "—"}</td>
                                <td className="px-4 py-3">{e.email || "—"}</td>
                                <td className="px-4 py-3">{e.is_active ? "Yes" : "No"}</td>
                                <td className="px-4 py-3 text-right space-x-1">
                                    <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setForm({ ...EMPTY, ...e }); setOpen(true); }} data-testid={`edit-employee-${e.name}`}><Pencil className="w-4 h-4" /></Button>
                                    <Button size="sm" variant="ghost" onClick={() => remove(e)} data-testid={`delete-employee-${e.name}`}><Trash2 className="w-4 h-4" /></Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader><DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
                    <form onSubmit={save} className="grid grid-cols-2 gap-4">
                        <div className="col-span-2"><Label className="label-uppercase">Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="employee-name-input" /></div>
                        <div><Label className="label-uppercase">Employee Code</Label><Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} /></div>
                        <div><Label className="label-uppercase">Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
                        <div><Label className="label-uppercase">Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
                        <div><Label className="label-uppercase">Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
                        <div className="col-span-2"><Label className="label-uppercase">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                        <div className="col-span-2 flex items-center gap-2">
                            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                            <Label className="label-uppercase">Active</Label>
                        </div>
                        <DialogFooter className="col-span-2">
                            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" data-testid="save-employee-btn">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
