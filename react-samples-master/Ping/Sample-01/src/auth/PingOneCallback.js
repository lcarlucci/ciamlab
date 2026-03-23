import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import { getConfig } from "../config";
import { useUnifiedAuth } from "./AuthContext";
import {
  buildUserFromTokens,
  writePingTokens,
  writePingUser,
} from "./pingoneStorage";
import {
  clearAuthTransaction,
  fetchWellKnown,
  loadAuthTransaction,
} from "./pingoneOidc";

const normalizeTokens = (payload) => payload?.tokens || payload || null;

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch (err) {
    return null;
  }
};

const PingOneCallback = () => {
  const navigate = useNavigate();
  const { setPingoneSession } = useUnifiedAuth();
  const { pingone, apiOrigin } = getConfig();

  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    let mounted = true;
    const finishLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      const errDesc = params.get("error_description");
      if (err) {
        throw new Error(errDesc || err);
      }

      const code = params.get("code");
      const state = params.get("state");
      if (!code) {
        throw new Error("Missing authorization code.");
      }
      if (!pingone.clientId || !pingone.wellKnown) {
        throw new Error("Missing PingOne config (issuer/clientId).");
      }

      const tx = loadAuthTransaction(pingone.clientId);
      if (!tx) {
        throw new Error("Login state not found. Please retry login.");
      }
      if (state && tx.state && state !== tx.state) {
        throw new Error("State mismatch. Please retry login.");
      }

      const wellKnown = await fetchWellKnown(pingone.wellKnown);
      const tokenEndpoint = wellKnown?.token_endpoint;
      if (!tokenEndpoint) {
        throw new Error("PingOne token endpoint not available.");
      }

      const exchangeWithBackend = async () => {
        const response = await fetch(`${apiOrigin}/api/pingone/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirectUri: tx.redirectUri || pingone.redirectUri,
            codeVerifier: tx.codeVerifier || null,
          }),
        });
        const payload = await safeJson(response);
        if (!response.ok) {
          const message =
            payload?.error ||
            payload?.message ||
            "Token exchange failed on the server.";
          const err = new Error(message);
          err.details = payload;
          err.status = response.status;
          throw err;
        }
        return normalizeTokens(payload);
      };

      const exchangeDirect = async () => {
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: tx.redirectUri || pingone.redirectUri,
          client_id: pingone.clientId,
        });
        if (tx.codeVerifier) {
          body.set("code_verifier", tx.codeVerifier);
        }
        const response = await fetch(tokenEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const payload = await safeJson(response);
        if (!response.ok) {
          const message =
            payload?.error_description ||
            payload?.error ||
            "Token exchange failed at token endpoint.";
          const err = new Error(message);
          err.details = payload;
          err.status = response.status;
          throw err;
        }
        return normalizeTokens(payload);
      };

      let tokens = null;
      try {
        tokens = await exchangeWithBackend();
      } catch (err) {
        // fallback to direct exchange
      }

      if (!tokens) {
        tokens = await exchangeDirect();
      }

      const user = buildUserFromTokens(tokens);
      writePingTokens(pingone.clientId, tokens);
      writePingUser(pingone.clientId, user);
      setPingoneSession({ tokens, user });
      clearAuthTransaction(pingone.clientId);
      if (!mounted) return;
      navigate("/home", { replace: true });
    };

    finishLogin().catch((err) => {
      if (!mounted) return;
      setError(err);
      setDebugInfo(
        JSON.stringify(
          {
            message: err?.message || String(err),
            details: err?.details || null,
          },
          null,
          2
        )
      );
    });

    return () => {
      mounted = false;
    };
  }, [
    apiOrigin,
    navigate,
    pingone.clientId,
    pingone.redirectUri,
    pingone.wellKnown,
    setPingoneSession,
  ]);

  if (error) {
    return (
      <div className="container" style={{ maxWidth: 520 }}>
        <h1 className="mb-4">PingOne Callback</h1>
        <div className="alert alert-danger">
          {error.message || String(error)}
        </div>
        {debugInfo && (
          <details className="mt-4">
            <summary>Debug info</summary>
            <pre className="mt-2">{debugInfo}</pre>
          </details>
        )}
      </div>
    );
  }

  return <Loading />;
};

export default PingOneCallback;
