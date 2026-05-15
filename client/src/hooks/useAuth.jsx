import { useState, useEffect, createContext, useContext } from 'react';

const AuthContext = createContext(undefined);
const API_URL = '/api';

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data._id) {
            setUser(data);
            setSession({ access_token: token });
          } else {
            localStorage.removeItem('token');
          }
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const signUp = async (email, password) => {
    try {
      const res  = await fetch(`${API_URL}/auth/signup`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.message };
      localStorage.setItem('token', data.token);
      setUser(data);
      setSession({ access_token: data.token });
      return { error: null };
    } catch (err) {
      return { error: err.message };
    }
  };

  const signIn = async (email, password) => {
    try {
      const res  = await fetch(`${API_URL}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.message };
      localStorage.setItem('token', data.token);
      setUser(data);
      setSession({ access_token: data.token });
      return { error: null };
    } catch (err) {
      return { error: err.message };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('token');
    setUser(null);
    setSession(null);
  };

  // Sends a password-reset email with a link
  const resetPassword = async (email) => {
    try {
      const res  = await fetch(`${API_URL}/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.message };
      return { error: null };
    } catch (err) {
      return { error: err.message };
    }
  };

  // Reset password using token from email link
  const resetPasswordWithToken = async (token, password) => {
    try {
      const res  = await fetch(`${API_URL}/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.message };
      return { error: null };
    } catch (err) {
      return { error: err.message };
    }
  };

  // Update password for a logged-in user
  const updatePassword = async (currentPassword, newPassword) => {
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API_URL}/auth/update-password`, {
        method:  'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.message };
      return { error: null };
    } catch (err) {
      return { error: err.message };
    }
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      signUp, signIn, signOut,
      resetPassword, resetPasswordWithToken, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
