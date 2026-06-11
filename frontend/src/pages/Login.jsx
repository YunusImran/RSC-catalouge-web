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
        if (ok) navigate("/dashboard");
    };

    return (
        <div className="min-h-screen grid md:grid-cols-5 bg-background">
            <div
                className="hidden md:flex md:col-span-3 relative bg-cover bg-center"
                style={{
                    backgroundImage: `linear-gradient(135deg, hsla(215, 60%, 18%, 0.92), hsla(15, 60%, 45%, 0.55)), url(https://images.unsplash.com/photo-1565183997392-2f6f122e5912?crop=entropy&cs=srgb&fm=jpg&q=85)`,
                }}
            >
                <div className="absolute inset-0 p-12 flex flex-col justify-between text-white">
                    <div className="flex items-center gap-3">
                        <img src="/rsc-logo.png" alt="Royal Shades" className="h-12 w-auto bg-white/10 backdrop-blur p-2 rounded-sm" />
                    </div>
                    <div className="space-y-4 max-w-md">
                        <div className="label-uppercase text-white/70 tracking-widest">Enterprise · Dubai</div>
                        <h2 className="font-display font-black text-4xl leading-tight">
                            Catalog operations<br />for soft furnishing excellence.
                        </h2>
                        <p className="text-white/80">
                            Track every swatch book — issue, return, audit. Built for the showroom floor and the warehouse.
                        </p>
                    </div>
                    <div className="flex items-center justify-between font-mono text-xs opacity-70">
                        <span>CODE128 · QR · AUDIT · RBAC</span>
                        <span>v2.0</span>
                    </div>
                </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-center p-6 sm:p-10">
                <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6" data-testid="login-form">
                    <div className="text-center space-y-3">
                        <img src="/rsc-logo.png" alt="Royal Shades And Curtains LLC Dubai"
                             className="h-20 mx-auto" data-testid="company-logo" />
                        <div className="space-y-0.5">
                            <h1 className="font-display font-black text-xl tracking-tight" data-testid="company-name">
                                Royal Shades And Curtains LLC
                            </h1>
                            <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground">Dubai · UAE</div>
                        </div>
                    </div>
                    <div className="border-t border-border pt-6 space-y-4">
                        <div>
                            <div className="label-uppercase">Catalog Suite · Sign in</div>
                            <p className="text-sm text-muted-foreground mt-1">Use your enterprise email to continue.</p>
                        </div>
                        <div>
                            <Label htmlFor="email" className="label-uppercase">Email</Label>
                            <Input id="email" type="email" required value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@royalshades.ae"
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
                        {error && <div className="text-sm text-destructive" data-testid="login-error">{error}</div>}
                        <Button type="submit" disabled={loading} className="w-full" data-testid="login-submit-btn">
                            {loading ? "Signing in…" : "Sign in"}
                        </Button>
                        <div className="flex justify-between text-sm">
                            <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground" data-testid="forgot-password-link">
                                Forgot password?
                            </Link>
                            <span className="text-muted-foreground font-mono text-xs">© Royal Shades</span>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
