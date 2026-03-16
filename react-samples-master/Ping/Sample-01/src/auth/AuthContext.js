import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { getConfig } from "../config";
import { getPingOneManager } from "./pingoneClient";

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

export const AuthProvider = ({ children }) => {
  const auth0 = useAuth0();
  const { auth0: auth0Config, pingone } = getConfig();
  const pingManager = useMemo(() => getPingOneManager(pingone), [
    pingone.issuer,
    pingone.clientId,
    pingone.redirectUri,
    pingone.postLogoutRedirectUri,
    pingone.scope,
    pingone.audience,
  ]);

  const [pingUser, setPingUser] = useState(null);
  const [pingLoading, setPingLoading] = useState(true);
  const [pingError, setPingError] = useState(null);
  const [activeProvider, setActiveProvider] = useState(
    () => window.localStorage.getItem(ACTIVE_PROVIDER_KEY)
  );

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
    pingManager
      .getUser()
      .then((user) => {
        if (!mounted) return;
        setPingUser(user);
        setPingLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setPingError(err);
        setPingLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [pingManager]);

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
    return pingManager.signinRedirect();
  };

  const completePingOneLogin = async () => {
    try {
      const user = await pingManager.signinRedirectCallback();
      setPingUser(user);
      setPingError(null);
      setActiveProviderLocal("pingone");
      return user;
    } catch (err) {
      setPingError(err);
      throw err;
    }
  };

  const logout = async () => {
    const target = auth0Config.postLogoutRedirectUri || window.location.origin;
    setActiveProviderLocal(null);
    if (provider === "pingone") {
      setPingUser(null);
      return pingManager.signoutRedirect();
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
      const user = pingUser || (await pingManager.getUser());
      return user?.access_token || "";
    }
    return "";
  };

  const user =
    provider === "auth0"
      ? auth0.user
      : normalizePingOneUser(pingUser?.profile);

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
    completePingOneLogin,
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
