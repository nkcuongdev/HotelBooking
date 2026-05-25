import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";
import { disconnectSocket } from "../services/socket";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const extractAuthPayload = (res) => {
    // Backend auth returns: { success, data: { user, token } }
    const token = res?.token || res?.data?.token || null;
    const userData =
      res?.user || res?.data?.user || (res?.data && !res?.data?.token ? res.data : null);

    return { token, userData };
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api.getMe()
        .then((res) => {
          const userData = res?.data?.user || res?.data || res;
          setUser(userData);
          localStorage.setItem("user", JSON.stringify(userData));
        })
        .catch(() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        })
        .finally(() => setLoading(false));
    } else {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem("user");
        }
      }
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    if (!email || !password) {
      return { success: false, error: "Email và mật khẩu không được để trống" };
    }

    try {
      const res = await api.login(email, password);
      const { token, userData } = extractAuthPayload(res);

      if (token) {
        localStorage.setItem("token", token);
      }
      if (userData) {
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
      }
      return { success: true, user: userData };
    } catch (err) {
      return { success: false, error: err.message || "Đăng nhập thất bại" };
    }
  };

  const register = async (userData) => {
    if (!userData?.email || !userData?.password) {
      return { success: false, error: "Thiếu thông tin đăng ký" };
    }

    try {
      const res = await api.register(userData);
      const { token, userData: registeredUser } = extractAuthPayload(res);

      if (token) {
        localStorage.setItem("token", token);
      }
      if (registeredUser) {
        localStorage.setItem("user", JSON.stringify(registeredUser));
        setUser(registeredUser);
      }
      return { success: true, user: registeredUser };
    } catch (err) {
      return { success: false, error: err.message || "Đăng ký thất bại" };
    }
  };

  const logout = () => {
    disconnectSocket();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const updateUser = async (userData) => {
    try {
      const res = await api.updateProfile(userData);
      const updatedUser = res.data || { ...user, ...userData };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      return { success: true };
    } catch (err) {
      const merged = { ...user, ...userData };
      localStorage.setItem("user", JSON.stringify(merged));
      setUser(merged);
      return { success: false, error: err.message };
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
