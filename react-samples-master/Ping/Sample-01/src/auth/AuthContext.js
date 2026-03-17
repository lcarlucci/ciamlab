import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Config,
  TokenManager,
  TokenStorage,
  UserManager,
} from "@forgerock/javascript-sdk";
import { getConfig } from "../config";

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

  const pingoneSdkConfig = useMemo(() => {
    if (!pingone.clientId || !pingone.wellKnown) return null;
    return {
      clientId: pingone.clientId,
      serverConfig: {
        wellknown: pingone.wellKnown,
        baseUrl: pingone.davinciBaseUrl || undefined,
      },
      scope: pingone.scope || "openid profile email",
      responseType: "code",
      redirectUri: pingone.redirectUri,
    };
  }, [
    pingone.clientId,
    pingone.davinciBaseUrl,
    pingone.redirectUri,
    pingone.scope,
    pingone.wellKnown,
  ]);

  const setActiveProviderLocal = (provider) => {
    setActiveProvider(provider);
    if (provider) {
      window.localStorage.setItem(ACTIVE_PROVIDER_KEY, provider);
    } else {
      window.localStorage.removeItem(ACTIVE_PROVIDER_KEY);
    }
  };

  const ensurePingoneConfig = useCallback(() => {
    if (!pingoneSdkConfig) return false;
    try {
      Config.set(pingoneSdkConfig);
      return true;
    } catch (err) {
      setPingError(err);
      return false;
    }
  }, [pingoneSdkConfig]);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      if (!pingoneSdkConfig) {
        if (mounted) setPingLoading(false);
        return;
      }
      setPingLoading(true);
      try {
        if (!ensurePingoneConfig()) {
          if (mounted) setPingLoading(false);
          return;
        }
        const storedTokens = await TokenStorage.get();
        if (storedTokens && mounted) {
          setPingTokens(storedTokens);
          const currentUser = await UserManager.getCurrentUser();
          if (mounted) {
            setPingUser(currentUser);
            setPingError(null);
          }
        }
      } catch (err) {
        if (mounted) {
          if (err?.message === "Server configuration has not been set") {
            setPingLoading(false);
            return;
          }
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
  }, [pingoneSdkConfig, ensurePingoneConfig]);

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
    setPingTokens(tokens || null);
    setPingUser(user || null);
    setPingError(null);
    setActiveProviderLocal("pingone");
  };

  const logout = async () => {
    const target = auth0Config.postLogoutRedirectUri || window.location.origin;
    setActiveProviderLocal(null);
    if (provider === "pingone") {
      setPingUser(null);
      setPingTokens(null);
      try {
        if (typeof TokenManager.deleteTokens === "function") {
          await TokenManager.deleteTokens();
        } else if (typeof TokenStorage.remove === "function") {
          await TokenStorage.remove(pingone.clientId);
        }
      } catch (err) {
        // ignore
      }
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
        try {
          const storedTokens = await TokenStorage.get();
          if (storedTokens) {
            setPingTokens(storedTokens);
            return extractAccessToken(storedTokens);
          }
        } catch (err) {
          return "";
        }
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
