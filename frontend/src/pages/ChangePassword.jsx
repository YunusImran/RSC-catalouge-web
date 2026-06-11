import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../lib/auth";
import { api, apiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

export default function ChangePassword() {
    const { changePassword } = useAuth();
    const navigate = useNavigate();
    const [oldp, setOldp] = useState("");
    const [newp, setNewp] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await changePassword(oldp, newp);
            toast.success("Password changed");
            navigate("/");
        } catch (e) { toast.error(apiError(e)); }
        finally { setLoading(false); }
    };

    return (
        <div>
            <PageHeader title="Change Password" subtitle="Security · Account" />
            <Card className="max-w-md p-6 surface-card rounded-sm">
                <form onSubmit={submit} className="space-y-4">
                    <div><Label className="label-uppercase">Current Password</Label><Input type="password" required value={oldp} onChange={(e) => setOldp(e.target.value)} data-testid="old-password-input" /></div>
                    <div><Label className="label-uppercase">New Password</Label><Input type="password" required value={newp} onChange={(e) => setNewp(e.target.value)} data-testid="new-password-input" /></div>
                    <Button type="submit" disabled={loading} data-testid="change-password-submit-btn">{loading ? "Saving…" : "Update"}</Button>
                </form>
            </Card>
        </div>
    );
}
