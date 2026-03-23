import React, { useEffect, useState } from "react";
import Loading from "../components/Loading";
import { getConfig } from "../config";
import {
  createCodeChallenge,
  createCodeVerifier,
  createNonce,
  createState,
  fetchWellKnown,
  saveAuthTransaction,
} from "./pingoneOidc";

const PingOneLogin = () => {
  const { pingone } = getConfig();
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let mounted = true;
    const startLogin = async () => {
      try {
        if (!pingone.clientId || !pingone.wellKnown) {
          throw new Error("Missing PingOne config (issuer/clientId).");
        }
        const wellKnown = await fetchWellKnown(pingone.wellKnown);
        const authorizeEndpoint = wellKnown?.authorization_endpoint;
        if (!authorizeEndpoint) {
          throw new Error("PingOne authorization endpoint not available.");
        }
        const codeVerifier = createCodeVerifier();
        const codeChallenge = await createCodeChallenge(codeVerifier);
        const state = createState();
        const nonce = createNonce();

        saveAuthTransaction(pingone.clientId, {
          codeVerifier,
          state,
          nonce,
          redirectUri: pingone.redirectUri,
          createdAt: Date.now(),
        });

        const params = new URLSearchParams({
          response_type: "code",
          client_id: pingone.clientId,
          redirect_uri: pingone.redirectUri,
          scope: pingone.scope || "openid profile email",
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state,
          nonce,
        });

        if (pingone.audience) {
          params.set("resource", pingone.audience);
        }

        if (!mounted) return;
        setStarted(true);
        window.location.assign(`${authorizeEndpoint}?${params.toString()}`);
      } catch (err) {
        if (mounted) setError(err);
      }
    };
    startLogin();
    return () => {
      mounted = false;
    };
  }, [
    pingone.audience,
    pingone.clientId,
    pingone.redirectUri,
    pingone.scope,
    pingone.wellKnown,
  ]);

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <h1 className="mb-4">PingOne Login</h1>
      {error && (
        <div className="alert alert-danger">
          {error.message || String(error)}
        </div>
      )}
      {!error && (
        <>
          <p className="mb-4">
            Redirecting to PingOne...
          </p>
          {!started && <Loading />}
        </>
      )}
    </div>
  );
};

export default PingOneLogin;
