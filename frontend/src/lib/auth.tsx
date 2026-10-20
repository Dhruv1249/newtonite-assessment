"use client";

/**
 * Authentication context and session management provider.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { User } from "@/types";

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component supplying authenticated user context across the application tree.
 *
 * @param props - Component properties wrapping child nodes
 * @returns JSX Element
 */
export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async (): Promise<void> => {
    try {
      const token = localStorage.getItem("opflow_access_token");
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const profile = await apiFetch<User>("/api/v1/auth/me");
      setUser(profile);
    } catch {
      localStorage.removeItem("opflow_access_token");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const data = await apiFetch<{ access_token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("opflow_access_token", data.access_token);
    await fetchProfile();
  };

  const register = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<void> => {
    await apiFetch<User>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        display_name: displayName,
      }),
    });
    await login(email, password);
  };

  const logout = (): void => {
    localStorage.removeItem("opflow_access_token");
    setUser(null);
  };

  const refreshUser = async (): Promise<void> => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to consume active authentication context.
 *
 * @returns AuthContextType
 * @throws {Error} If called outside AuthProvider scope
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be invoked within an AuthProvider");
  }
  return context;
}
