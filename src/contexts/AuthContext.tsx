import React, { createContext, useContext, useState, useCallback } from 'react';

interface AuthContextValue {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (token: string, username: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  username: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('dashboard_token'));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem('dashboard_user'));

  const login = useCallback((newToken: string, newUsername: string) => {
    localStorage.setItem('dashboard_token', newToken);
    localStorage.setItem('dashboard_user', newUsername);
    setToken(newToken);
    setUsername(newUsername);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('dashboard_token');
    localStorage.removeItem('dashboard_user');
    setToken(null);
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, username, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
