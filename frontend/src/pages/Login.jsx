import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Login() {
    const { login, error } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const ok = await login(email, password);
        setLoading(false);
        if (ok) navigate("/");
    };

    return (
        <div className="min-h-screen grid md:grid-cols-2">
            <div
                className="hidden md:block relative bg-cover bg-center"
                style={{
                    backgroundImage: `linear-gradient(135deg, hsla(215, 50%, 25%, 0.85), hsla(15, 60%, 50%, 0.55)), url(https://images.unsplash.com/photo-1588610992315-5654831ceebd?crop=entropy&cs=srgb&fm=jpg&q=85)`,
                }}
            >
                <div className="absolute inset-0 p-12 flex flex-col justify-between text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white text-primary grid place-items-center font-display font-black">F</div>
                        <div>
                            <div className="font-display font-black text-xl tracking-tight leading-none">FABRIC</div>
                            <div className="text-[11px] tracking-[0.25em] uppercase opacity-80">Catalog Suite</div>
                        </div>
                    </div>
                    <div className="space-y-4 max-w-md">
                        <div className="label-uppercase text-white/70">Enterprise · v1.0</div>
                        <h2 className="font-display font-black text-4xl leading-tight">
                            Track every swatch.<br />Issue, return, repeat.
                        </h2>
                        <p className="text-white/80">
                            Modern catalog operations for textile studios — barcoded swatches, complete history, zero data loss.
                        </p>
                    </div>
                    <div className="font-mono text-xs opacity-60">CODE128 · QR · AUDIT · RBAC</div>
                </div>
            </div>

            <div className="flex items-center justify-center p-8 bg-background">
                <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6" data-testid="login-form">
                    <div className="space-y-2">
                        <div className="label-uppercase">Sign in</div>
                        <h1 className="font-display font-black text-3xl">Welcome back</h1>
                        <p className="text-sm text-muted-foreground">Use your enterprise email to continue.</p>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="email" className="label-uppercase">Email</Label>
                            <Input id="email" type="email" required value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                data-testid="login-email-input"
                                className="mt-1.5" />
                        </div>
                        <div>
                            <Label htmlFor="password" className="label-uppercase">Password</Label>
                            <Input id="password" type="password" required value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                data-testid="login-password-input"
                                className="mt-1.5" />
                        </div>
                    </div>
                    {error && <div className="text-sm text-destructive" data-testid="login-error">{error}</div>}
                    <Button type="submit" disabled={loading} className="w-full" data-testid="login-submit-btn">
                        {loading ? "Signing in…" : "Sign in"}
                    </Button>
                    <div className="flex justify-between text-sm">
                        <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground" data-testid="forgot-password-link">
                            Forgot password?
                        </Link>
                        <span className="text-muted-foreground font-mono text-xs">v1.0.0</span>
                    </div>
                </form>
            </div>
        </div>
    );
}
