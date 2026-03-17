import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { davinci } from "@forgerock/davinci-client";
import {
  Config,
  TokenManager,
  TokenStorage,
  UserManager,
} from "@forgerock/javascript-sdk";
import Loading from "../components/Loading";
import { getConfig } from "../config";
import { useUnifiedAuth } from "./AuthContext";

const getQueryParams = () => new URLSearchParams(window.location.search);

const buildQuery = (audience, flowId) => {
  const query = {};
  if (audience) query.resource = audience;
  if (flowId) query.flowId = flowId;
  return query;
};

const safeStringify = (value) => {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (key, val) => {
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      if (typeof val === "function") return "[Function]";
      return val;
    },
    2
  );
};

const PingOneLogin = () => {
  const navigate = useNavigate();
  const { setPingoneSession } = useUnifiedAuth();
  const { pingone } = getConfig();
  const pingoneAudience = pingone.audience || null;
  const pingoneFlowId = pingone.flowId || null;

  const [client, setClient] = useState(null);
  const [node, setNode] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);

  const sdkConfig = useMemo(() => {
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

  const handleSuccess = useCallback(async (dvClient) => {
    const info = dvClient?.getClient?.();
    const code = info?.authorization?.code;
    const state = info?.authorization?.state;
    setDebugInfo(
      safeStringify({
        stage: "handleSuccess",
        authorization: info?.authorization || null,
        client: info || null,
      })
    );
    let tokens = null;
    if (code && state) {
      tokens = await TokenManager.getTokens({ query: { code, state } });
    } else {
      try {
        tokens = await TokenStorage.get();
      } catch (err) {
        tokens = null;
      }
    }
    if (!tokens) {
      throw new Error(
        "DaVinci success without authorization code or stored tokens. Check the PingOne Authentication node configuration."
      );
    }
    const user = await UserManager.getCurrentUser();
    setPingoneSession({ tokens, user });
    navigate("/home", { replace: true });
  }, [navigate, setPingoneSession]);

  const handleNode = useCallback(async (nextNode, dvClient) => {
    if (!nextNode) return;
    setNode(nextNode);
    setDebugInfo(
      safeStringify({
        stage: "handleNode",
        nodeStatus: nextNode?.status || null,
        node: nextNode || null,
        client: dvClient?.getClient?.() || null,
      })
    );
    if (nextNode.status === "success") {
      await handleSuccess(dvClient);
    }
    if (nextNode.status === "error") {
      const dvError = dvClient?.getError?.();
      if (dvError) setError(dvError);
    }
  }, [handleSuccess]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!sdkConfig) {
        setError(new Error("Missing PingOne config (issuer/clientId)."));
        setBusy(false);
        return;
      }
      setBusy(true);
      try {
        Config.set(sdkConfig);
        const dvClient = await davinci({ config: sdkConfig });
        if (!mounted) return;
        setClient(dvClient);

        const continueToken = getQueryParams().get("continueToken");
        const query = buildQuery(pingoneAudience, pingoneFlowId);
        const hasQuery = Object.keys(query).length > 0;
        const nextNode = continueToken
          ? await dvClient.resume({ continueToken })
          : await dvClient.start(hasQuery ? { query } : undefined);
        if (!mounted) return;
        await handleNode(nextNode, dvClient);
      } catch (err) {
        if (mounted) {
          setError(err);
          setDebugInfo(
            safeStringify({
              stage: "initError",
              message: err?.message || String(err),
              stack: err?.stack || null,
            })
          );
        }
      } finally {
        if (mounted) setBusy(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [sdkConfig, pingoneAudience, pingoneFlowId, handleNode]);

  const collectors =
    client && typeof client.getCollectors === "function"
      ? client.getCollectors() || []
      : [];

  const hasSubmitCollector = collectors.some(
    (collector) => collector.type === "SubmitCollector"
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const nextNode = await client.next();
      await handleNode(nextNode, client);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const renderCollector = (collector, index) => {
    const label =
      collector?.output?.label ||
      collector?.output?.name ||
      collector?.output?.key ||
      `Field ${index + 1}`;

    if (collector.type === "TextCollector") {
      const update = client.update(collector);
      return (
        <div className="mb-3" key={`text-${index}`}>
          <label className="form-label">{label}</label>
          <input
            type="text"
            className="form-control"
            onChange={(event) => update(event.target.value)}
            autoComplete="username"
          />
        </div>
      );
    }

    if (collector.type === "PasswordCollector") {
      const update = client.update(collector);
      return (
        <div className="mb-3" key={`password-${index}`}>
          <label className="form-label">{label}</label>
          <input
            type="password"
            className="form-control"
            onChange={(event) => update(event.target.value)}
            autoComplete="current-password"
          />
        </div>
      );
    }

    if (collector.type === "SubmitCollector") {
      return (
        <button
          key={`submit-${index}`}
          type="submit"
          className="btn btn-primary me-2"
          disabled={busy}
        >
          {label || "Continue"}
        </button>
      );
    }

    return (
      <div className="alert alert-warning" key={`unsupported-${index}`}>
        Unsupported collector: {collector.type}
      </div>
    );
  };

  if (busy && !node) return <Loading />;

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <h1 className="mb-4">PingOne Login</h1>
      {error && (
        <div className="alert alert-danger">
          {error.message || String(error)}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {collectors.map(renderCollector)}
        {!hasSubmitCollector && (
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Continue
          </button>
        )}
      </form>
      {debugInfo && (
        <details className="mt-4">
          <summary>Debug info</summary>
          <pre className="mt-2">{debugInfo}</pre>
        </details>
      )}
    </div>
  );
};

export default PingOneLogin;
