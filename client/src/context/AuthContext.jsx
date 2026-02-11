import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Axios interceptor to add token
  useEffect(() => {
    // Response interceptor for handling 401/403
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
      
      // Fetch user if not already set (e.g. on refresh)
      if (!user) {
          axios.get('http://localhost:3000/api/auth/me')
            .then(res => {
                setUser(res.data.user);
                setLoading(false);
            })
            .catch(err => {
                console.error("Token invalid or user fetch failed", err);
                logout();
                setLoading(false);
            });
      } else {
          setLoading(false);
      }
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
      setLoading(false);
    }

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await axios.post('http://localhost:3000/api/login', { email, password });
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Login failed' };
    }
  };

  const register = async (username, email, password) => {
    try {
      const res = await axios.post('http://localhost:3000/api/register', { username, email, password });
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Registration failed' };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
