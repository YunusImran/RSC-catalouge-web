import React, { createContext, useContext, useEffect, useState } from "react";
import { api, apiError } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // null = checking; false = guest; obj = user
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("/auth/me")
            .then(({ data }) => setUser(data))
            .catch(() => setUser(false));
    }, []);

    const login = async (email, password) => {
        setError("");
        try {
            const { data } = await api.post("/auth/login", { email, password });
            setUser(data);
            return true;
        } catch (e) {
            setError(apiError(e));
            return false;
        }
    };

    const logout = async () => {
        try { await api.post("/auth/logout"); } catch (_) {}
        setUser(false);
    };

    const changePassword = async (oldp, newp) => {
        await api.post("/auth/change-password", { old_password: oldp, new_password: newp });
    };

    return (
        <AuthContext.Provider value={{ user, error, login, logout, changePassword, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);

export const ROLES = { ADMIN: "admin", MANAGER: "manager", STAFF: "staff" };
export const can = (user, ...roles) => user && roles.includes(user.role);
