import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, can } from "./lib/auth";
import { Toaster } from "./components/ui/sonner";
import AppLayout from "./components/AppLayout";

import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Catalogs from "./pages/Catalogs";
import CatalogDetail from "./pages/CatalogDetail";
import Categories from "./pages/Categories";
import Suppliers from "./pages/Suppliers";
import Employees from "./pages/Employees";
import Scanner from "./pages/Scanner";
import IssuesReturns from "./pages/IssuesReturns";
import Reports from "./pages/Reports";
import AuditLogs from "./pages/AuditLogs";
import Users from "./pages/Users";
import ChangePassword from "./pages/ChangePassword";

function Protected({ children, roles }) {
    const { user } = useAuth();
    if (user === null) {
        return <div className="min-h-screen grid place-items-center text-muted-foreground">Checking session…</div>;
    }
    if (!user) return <Navigate to="/login" replace />;
    if (roles && !can(user, ...roles)) return <Navigate to="/dashboard" replace />;
    return <AppLayout>{children}</AppLayout>;
}

function Shell() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/catalogs" element={<Protected><Catalogs /></Protected>} />
            <Route path="/catalogs/:id" element={<Protected><CatalogDetail /></Protected>} />
            <Route path="/categories" element={<Protected roles={["admin", "supervisor"]}><Categories /></Protected>} />
            <Route path="/suppliers" element={<Protected roles={["admin", "supervisor"]}><Suppliers /></Protected>} />
            <Route path="/employees" element={<Protected roles={["admin", "supervisor"]}><Employees /></Protected>} />
            <Route path="/scanner" element={<Protected><Scanner /></Protected>} />
            <Route path="/issues-returns" element={<Protected><IssuesReturns /></Protected>} />
            <Route path="/reports" element={<Protected roles={["admin", "supervisor"]}><Reports /></Protected>} />
            <Route path="/audit-logs" element={<Protected roles={["admin", "supervisor"]}><AuditLogs /></Protected>} />
            <Route path="/users" element={<Protected roles={["admin"]}><Users /></Protected>} />
            <Route path="/change-password" element={<Protected><ChangePassword /></Protected>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <div className="App">
            <BrowserRouter>
                <AuthProvider>
                    <Shell />
                    <Toaster position="top-right" richColors />
                </AuthProvider>
            </BrowserRouter>
        </div>
    );
}

export default App;
