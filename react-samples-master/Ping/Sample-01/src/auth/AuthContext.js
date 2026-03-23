import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { getConfig } from "../config";
import {
  buildUserFromTokens,
  clearPingSession,
  readPingTokens,
  readPingUser,
  writePingTokens,
  writePingUser,
} from "./pingoneStorage";

const ACTIVE_PROVIDER_KEY = "active_provider";

const AuthContext = createContext(null);

const normalizePingOneUser = (profile) => {
  if (!profile) return null;
  if (profile.name) return profile;
  const name = [profile.given_name, profile.family_name].filter(Boolean).join(" ");
  return {
    ...profile,
    name: name || profile.preferred_username || profile.email || "User",
  };
};

const resolveProvider = ({ activeProvider, auth0Authenticated, pingUser }) => {
  if (activeProvider === "pingone" && pingUser) return "pingone";
  if (activeProvider === "auth0" && auth0Authenticated) return "auth0";
  if (pingUser) return "pingone";
  if (auth0Authenticated) return "auth0";
  return null;
};

const extractAccessToken = (tokens) => {
  if (!tokens) return "";
  return (
    tokens?.accessToken?.accessToken ||
    tokens?.accessToken?.value ||
    tokens?.accessToken ||
    tokens?.access_token ||
    ""
  );
};

export const AuthProvider = ({ children }) => {
  const auth0 = useAuth0();
  const { auth0: auth0Config, pingone } = getConfig();

  const [pingUser, setPingUser] = useState(null);
  const [pingTokens, setPingTokens] = useState(null);
  const [pingLoading, setPingLoading] = useState(true);
  const [pingError, setPingError] = useState(null);
  const [activeProvider, setActiveProvider] = useState(
    () => window.localStorage.getItem(ACTIVE_PROVIDER_KEY)
  );

  const pingoneReady = Boolean(pingone.clientId);

  const setActiveProviderLocal = (provider) => {
    setActiveProvider(provider);
    if (provider) {
      window.localStorage.setItem(ACTIVE_PROVIDER_KEY, provider);
    } else {
      window.localStorage.removeItem(ACTIVE_PROVIDER_KEY);
    }
  };

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      if (!pingoneReady) {
        if (mounted) setPingLoading(false);
        return;
      }
      setPingLoading(true);
      try {
        const storedTokens = readPingTokens(pingone.clientId);
        if (storedTokens && mounted) {
          const storedUser =
            readPingUser(pingone.clientId) || buildUserFromTokens(storedTokens);
          setPingTokens(storedTokens);
          setPingUser(storedUser);
          setPingError(null);
        }
      } catch (err) {
        if (mounted) {
          setPingError(err);
        }
      } finally {
        if (mounted) setPingLoading(false);
      }
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, [pingone.clientId, pingoneReady]);

  useEffect(() => {
    if (!activeProvider) {
      if (pingUser) setActiveProviderLocal("pingone");
      else if (auth0.isAuthenticated) setActiveProviderLocal("auth0");
    }
  }, [activeProvider, pingUser, auth0.isAuthenticated]);

  const provider = resolveProvider({
    activeProvider,
    auth0Authenticated: auth0.isAuthenticated,
    pingUser,
  });

  const loginWithAuth0 = () => {
    setActiveProviderLocal("auth0");
    return auth0.loginWithRedirect({ appState: { returnTo: "/home" } });
  };

  const loginWithPingOne = () => {
    setActiveProviderLocal("pingone");
    window.location.assign("/login/pingone");
  };

  const setPingoneSession = ({ tokens, user }) => {
    const resolvedTokens = tokens || null;
    const resolvedUser =
      user || buildUserFromTokens(resolvedTokens) || null;
    setPingTokens(resolvedTokens);
    setPingUser(resolvedUser);
    setPingError(null);
    setActiveProviderLocal("pingone");
    writePingTokens(pingone.clientId, resolvedTokens);
    writePingUser(pingone.clientId, resolvedUser);
  };

  const logout = async () => {
    const target = auth0Config.postLogoutRedirectUri || window.location.origin;
    setActiveProviderLocal(null);
    if (provider === "pingone") {
      setPingUser(null);
      setPingTokens(null);
      clearPingSession(pingone.clientId);
      window.location.assign(target);
      return null;
    }
    if (provider === "auth0") {
      return auth0.logout({ logoutParams: { returnTo: target } });
    }
    return null;
  };

  const getAccessToken = async () => {
    if (provider === "auth0") {
      return auth0.getAccessTokenSilently({
        audience: auth0Config.audience || undefined,
        scope: auth0Config.scope,
      });
    }
    if (provider === "pingone") {
      if (!pingTokens) {
        const storedTokens = readPingTokens(pingone.clientId);
        if (storedTokens) {
          setPingTokens(storedTokens);
          return extractAccessToken(storedTokens);
        }
        return "";
      }
      return extractAccessToken(pingTokens);
    }
    return "";
  };

  const user =
    provider === "auth0"
      ? auth0.user
      : normalizePingOneUser(pingUser);

  const value = {
    provider,
    user,
    isAuthenticated: Boolean(provider),
    isLoading: auth0.isLoading || pingLoading,
    error: auth0.error || pingError,
    loginWithAuth0,
    loginWithPingOne,
    logout,
    getAccessToken,
    setPingoneSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useUnifiedAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useUnifiedAuth must be used inside AuthProvider");
  }
  return ctx;
};
