import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  loginWithCollegeId,
  logoutUser,
  subscribeToAuthState
} from "../services/campusService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((profile) => {
      setUser(profile);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUserProfile(nextProfile) {
        setUser(nextProfile);
      },
      async login(credentials) {
        try {
          setLoading(true);
          const profile = await loginWithCollegeId(credentials);
          setUser(profile);
          toast.success("Login successful.");
        } catch (error) {
          toast.error(error.message);
          throw error;
        } finally {
          setLoading(false);
        }
      },
      async logout() {
        try {
          await logoutUser();
          setUser(null);
          toast.success("Logged out.");
        } catch (error) {
          toast.error(error.message);
        }
      }
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
