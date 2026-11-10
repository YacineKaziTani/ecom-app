import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import { setSessionExpiredHandler } from "../api/client";
import { User } from "../api/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean; // true for "admin" (shop owner) OR "super_admin"
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setSessionExpiredHandler(() => qc.setQueryData(["me"], null));
    return () => setSessionExpiredHandler(null);
  }, [qc]);

  const user = data?.user ?? null;

  // Switching language while signed in also switches the language of this
  // account's emails (signing in already records it server-side).
  const { lang } = useI18n();
  const previousLang = useRef(lang);
  useEffect(() => {
    if (previousLang.current === lang) return;
    previousLang.current = lang;
    if (user) authApi.updateProfile({ locale: lang }).catch(() => undefined);
  }, [lang, user]);

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuperAdmin;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useInvalidateAuth() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}

// After login/register: drop everything cached for the previous visitor and
// seed the session directly from the response (no extra /me round-trip).
export function useSignedIn() {
  const qc = useQueryClient();
  return (data: { user: User }) => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    qc.setQueryData(["me"], data);
  };
}
