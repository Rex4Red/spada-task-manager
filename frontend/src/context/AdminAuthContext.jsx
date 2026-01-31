import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('adminToken'));
    const [loading, setLoading] = useState(true);

    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7860';

    // Verify token on mount
    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const res = await fetch(`${API_URL}/admin/auth/verify`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();

                if (data.success) {
                    setAdmin(data.data);
                } else {
                    logout();
                }
            } catch (err) {
                console.error('Admin token verification failed:', err);
                logout();
            } finally {
                setLoading(false);
            }
        };

        verifyToken();
    }, [token]);

    const login = async (username, password) => {
        try {
            const res = await fetch(`${API_URL}/admin/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                localStorage.setItem('adminToken', data.data.token);
                setToken(data.data.token);
                setAdmin(data.data.admin);
                return { success: true };
            } else {
                return { success: false, error: data.message };
            }
        } catch (err) {
            console.error('Admin login error:', err);
            return { success: false, error: 'Connection error' };
        }
    };

    const logout = useCallback(() => {
        localStorage.removeItem('adminToken');
        setToken(null);
        setAdmin(null);
    }, []);

    return (
        <AdminAuthContext.Provider value={{ admin, token, loading, login, logout }}>
            {children}
        </AdminAuthContext.Provider>
    );
};

export const useAdminAuth = () => {
    const context = useContext(AdminAuthContext);
    if (!context) {
        throw new Error('useAdminAuth must be used within AdminAuthProvider');
    }
    return context;
};
