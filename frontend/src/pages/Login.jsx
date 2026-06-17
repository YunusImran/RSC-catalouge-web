import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Login() {
    const { login, error } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const ok = await login(username, password);
        setLoading(false);
        if (ok) navigate("/dashboard");
    };

    return (
        <div
            className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8 bg-cover bg-center bg-no-repeat relative"
            style={{ backgroundImage: `url(/login-bg.jpg)` }}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-[hsla(215,40%,12%,0.55)] via-[hsla(15,35%,30%,0.35)] to-[hsla(220,30%,15%,0.6)]" />

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-card/95 backdrop-blur-xl border border-white/10 rounded-sm shadow-2xl p-8 sm:p-10">
                    <div className="text-center space-y-4 mb-8">
                        <div className="inline-flex items-center justify-center w-36 h-36 sm:w-40 sm:h-40 bg-white rounded-sm shadow-sm border border-border p-3 mx-auto">
                            <img src="/rsc-logo.png" alt="Royal Shades Curtains LLC Dubai"
                                 className="w-full h-full object-contain" data-testid="company-logo" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="font-display font-black text-xl sm:text-2xl tracking-tight" data-testid="company-name">
                                Royal Shades Curtains LLC
                            </h1>
                            <div className="text-[10px] sm:text-xs tracking-[0.35em] uppercase text-muted-foreground">Dubai · UAE</div>
                        </div>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-5 border-t border-border pt-6" data-testid="login-form">
                        <div>
                            <div className="label-uppercase">Catalog Suite · Sign in</div>
                            <p className="text-sm text-muted-foreground mt-1">Use your username and password to continue.</p>
                        </div>
                        <div>
                            <Label htmlFor="username" className="label-uppercase">Username</Label>
                            <Input id="username" type="text" required value={username}
                                autoComplete="username"
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g. admin"
                                data-testid="login-username-input"
                                className="mt-1.5" />
                        </div>
                        <div>
                            <Label htmlFor="password" className="label-uppercase">Password</Label>
                            <Input id="password" type="password" required value={password}
                                autoComplete="current-password"
                                onChange={(e) => setPassword(e.target.value)}
                                data-testid="login-password-input"
                                className="mt-1.5" />
                        </div>
                        {error && <div className="text-sm text-destructive" data-testid="login-error">{error}</div>}
                        <Button type="submit" disabled={loading} className="w-full" data-testid="login-submit-btn">
                            {loading ? "Signing in…" : "Sign in"}
                        </Button>
                        <div className="flex justify-between items-center text-sm">
                            <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground" data-testid="forgot-password-link">
                                Forgot password?
                            </Link>
                            <span className="text-muted-foreground font-mono text-xs">© Royal Shades</span>
                        </div>
                    </form>
                </div>
                <div className="mt-4 text-center text-white/70 text-xs tracking-[0.3em] uppercase drop-shadow">
                    Catalog · Operations · Audit · RBAC
                </div>
            </div>
        </div>
    );
}
