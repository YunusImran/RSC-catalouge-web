import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, apiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [token, setToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [step, setStep] = useState(1);

    const sendLink = async (e) => {
        e.preventDefault();
        try {
            await api.post("/auth/forgot-password", { email });
            toast.success("If the account exists, a reset token has been generated. Check backend logs (dev).");
            setStep(2);
        } catch (e) { toast.error(apiError(e)); }
    };
    const reset = async (e) => {
        e.preventDefault();
        try {
            await api.post("/auth/reset-password", { token, new_password: newPassword });
            toast.success("Password reset. You can now log in.");
            setStep(3);
        } catch (e) { toast.error(apiError(e)); }
    };

    return (
        <div className="min-h-screen grid place-items-center bg-background p-6">
            <div className="w-full max-w-sm space-y-6">
                <div>
                    <div className="label-uppercase">Account recovery</div>
                    <h1 className="font-display font-black text-3xl">Forgot password</h1>
                </div>
                {step === 1 && (
                    <form onSubmit={sendLink} className="space-y-4" data-testid="forgot-step-1">
                        <Label className="label-uppercase">Email</Label>
                        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                            data-testid="forgot-email-input" />
                        <Button type="submit" className="w-full" data-testid="forgot-submit-btn">Send reset token</Button>
                    </form>
                )}
                {step === 2 && (
                    <form onSubmit={reset} className="space-y-4" data-testid="forgot-step-2">
                        <Label className="label-uppercase">Reset token (from backend log)</Label>
                        <Input value={token} onChange={(e) => setToken(e.target.value)} required data-testid="reset-token-input" />
                        <Label className="label-uppercase">New password</Label>
                        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required data-testid="reset-new-password-input" />
                        <Button type="submit" className="w-full" data-testid="reset-submit-btn">Reset password</Button>
                    </form>
                )}
                {step === 3 && (
                    <div className="text-sm text-muted-foreground">Password reset. <Link to="/login" className="text-primary underline">Go to login</Link></div>
                )}
                <Link to="/login" className="block text-sm text-muted-foreground hover:text-foreground">← Back to login</Link>
            </div>
        </div>
    );
}
