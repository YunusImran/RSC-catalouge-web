import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { api, apiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Switch } from "../components/ui/switch";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function Users() {
    const [users, setUsers] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ email: "", name: "", password: "", role: "staff" });

    const load = async () => {
        const { data } = await api.get("/users");
        setUsers(data);
    };
    useEffect(() => { load(); }, []);

    const create = async (e) => {
        e.preventDefault();
        try {
            await api.post("/auth/register", form);
            toast.success("User created"); setOpen(false); load();
            setForm({ email: "", name: "", password: "", role: "staff" });
        } catch (e) { toast.error(apiError(e)); }
    };

    const toggleActive = async (u) => {
        try {
            await api.patch(`/users/${u.id}`, { is_active: !u.is_active });
            load();
        } catch (e) { toast.error(apiError(e)); }
    };

    return (
        <div>
            <PageHeader
                title="Users"
                subtitle="Access · Control"
                actions={<Button onClick={() => setOpen(true)} data-testid="add-user-btn"><Plus className="w-4 h-4 mr-2" />Add User</Button>}
            />
            <Card className="surface-card rounded-sm overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-4 py-3 text-left label-uppercase">Name</th>
                            <th className="px-4 py-3 text-left label-uppercase">Email</th>
                            <th className="px-4 py-3 text-left label-uppercase">Role</th>
                            <th className="px-4 py-3 text-left label-uppercase">Active</th>
                            <th className="px-4 py-3 text-left label-uppercase">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} className="border-t border-border" data-testid={`user-row-${u.email}`}>
                                <td className="px-4 py-3 font-medium">{u.name}</td>
                                <td className="px-4 py-3">{u.email}</td>
                                <td className="px-4 py-3 uppercase text-xs tracking-wider">{u.role}</td>
                                <td className="px-4 py-3"><Switch checked={u.is_active} onCheckedChange={() => toggleActive(u)} /></td>
                                <td className="px-4 py-3 text-muted-foreground">{(u.created_at || "").slice(0, 10)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
                    <form onSubmit={create} className="space-y-4">
                        <div><Label className="label-uppercase">Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name-input" /></div>
                        <div><Label className="label-uppercase">Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email-input" /></div>
                        <div><Label className="label-uppercase">Password</Label><Input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-password-input" /></div>
                        <div>
                            <Label className="label-uppercase">Role</Label>
                            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                                <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="staff">Staff</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" data-testid="save-user-btn">Create</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
