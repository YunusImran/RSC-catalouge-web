import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth, can } from "../lib/auth";
import {
    LayoutDashboard, Boxes, FolderTree, Truck, ScanLine,
    ArrowLeftRight, FileBarChart, ShieldCheck, Users, LogOut, Sun, Moon, KeyRound
} from "lucide-react";
import { Button } from "./ui/button";

const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "staff"] },
    { to: "/catalogs", label: "Catalogs", icon: Boxes, roles: ["admin", "manager", "staff"] },
    { to: "/categories", label: "Categories", icon: FolderTree, roles: ["admin", "manager"] },
    { to: "/suppliers", label: "Suppliers", icon: Truck, roles: ["admin", "manager"] },
    { to: "/scanner", label: "Scanner", icon: ScanLine, roles: ["admin", "manager", "staff"] },
    { to: "/issues-returns", label: "Issues / Returns", icon: ArrowLeftRight, roles: ["admin", "manager", "staff"] },
    { to: "/reports", label: "Reports", icon: FileBarChart, roles: ["admin", "manager"] },
    { to: "/audit-logs", label: "Audit Logs", icon: ShieldCheck, roles: ["admin", "manager"] },
    { to: "/users", label: "Users", icon: Users, roles: ["admin"] },
];

export default function AppLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [dark, setDark] = React.useState(() => document.documentElement.classList.contains("dark"));

    const toggleTheme = () => {
        const el = document.documentElement;
        el.classList.toggle("dark");
        setDark(el.classList.contains("dark"));
    };

    const visible = nav.filter((n) => can(user, ...n.roles));

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card">
                <div className="h-16 flex items-center px-6 border-b border-border">
                    <Link to="/" className="flex items-center gap-2" data-testid="brand-logo">
                        <div className="w-8 h-8 bg-primary text-primary-foreground grid place-items-center font-display font-black">
                            F
                        </div>
                        <div>
                            <div className="font-display font-bold text-base leading-none">FABRIC</div>
                            <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Catalog Suite</div>
                        </div>
                    </Link>
                </div>
                <nav className="flex-1 overflow-y-auto py-4">
                    {visible.map((n) => {
                        const Icon = n.icon;
                        return (
                            <NavLink
                                key={n.to}
                                to={n.to}
                                end={n.to === "/"}
                                data-testid={`nav-${n.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-6 py-2.5 text-sm border-l-4 transition-colors ${
                                        isActive
                                            ? "border-primary bg-muted/60 text-foreground font-medium"
                                            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                    }`
                                }
                            >
                                <Icon className="w-4 h-4" />
                                {n.label}
                            </NavLink>
                        );
                    })}
                </nav>
                <div className="border-t border-border p-4 space-y-2">
                    <div className="text-xs label-uppercase">Signed in as</div>
                    <div className="text-sm font-medium truncate" data-testid="current-user-email">{user?.email}</div>
                    <div className="text-[10px] uppercase tracking-wider text-accent">{user?.role}</div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0">
                <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-8">
                    <div className="text-xs label-uppercase">Enterprise · Inventory Operating System</div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="theme-toggle">
                            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate("/change-password")} data-testid="change-password-btn">
                            <KeyRound className="w-4 h-4 mr-2" /> Password
                        </Button>
                        <Button variant="ghost" size="sm" onClick={async () => { await logout(); navigate("/login"); }} data-testid="logout-btn">
                            <LogOut className="w-4 h-4 mr-2" /> Logout
                        </Button>
                    </div>
                </header>
                <div className="flex-1 p-4 md:p-8 overflow-x-auto">{children}</div>
            </main>
        </div>
    );
}
