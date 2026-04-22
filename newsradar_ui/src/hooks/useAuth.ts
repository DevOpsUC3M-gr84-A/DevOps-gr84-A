import { useEffect, useState } from "react";

const AUTH_STATE_CHANGED_EVENT = "newsradar-auth-state-changed";

const getStoredToken = (): string | null => globalThis.localStorage.getItem("token");

const notifyAuthStateChanged = () => {
  globalThis.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
};

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  useEffect(() => {
    const syncAuthState = () => {
      setToken(getStoredToken());
    };

    globalThis.addEventListener("storage", syncAuthState);
    globalThis.addEventListener(AUTH_STATE_CHANGED_EVENT, syncAuthState);

    return () => {
      globalThis.removeEventListener("storage", syncAuthState);
      globalThis.removeEventListener(AUTH_STATE_CHANGED_EVENT, syncAuthState);
    };
  }, []);

  const login = (data: { access_token: string; user_id: number; role_ids: number[] }) => {
    globalThis.localStorage.setItem("token", data.access_token);
    globalThis.localStorage.setItem("userId", data.user_id.toString());
    globalThis.localStorage.setItem("userRoles", JSON.stringify(data.role_ids));
    setToken(data.access_token);
    notifyAuthStateChanged();
  };

  const logout = () => {
    globalThis.localStorage.removeItem("token");
    globalThis.localStorage.removeItem("userId");
    globalThis.localStorage.removeItem("userRoles");
    globalThis.localStorage.removeItem("userEmail");
    setToken(null);
    notifyAuthStateChanged();
  };

  return {
    login,
    logout,
    token,
    isAuthenticated: Boolean(token),
  };
};
