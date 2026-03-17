import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { davinci } from "@forgerock/davinci-client";
import { Config, TokenManager, UserManager } from "@forgerock/javascript-sdk";
import Loading from "../components/Loading";
import { getConfig } from "../config";
import { useUnifiedAuth } from "./AuthContext";

const getQueryParams = () => new URLSearchParams(window.location.search);

const buildQuery = (pingone) => {
  const query = {};
  if (pingone.audience) query.resource = pingone.audience;
  if (pingone.flowId) query.flowId = pingone.flowId;
  return query;
};

const PingOneLogin = () => {
  const navigate = useNavigate();
  const { setPingoneSession } = useUnifiedAuth();
  const { pingone } = getConfig();

  const [client, setClient] = useState(null);
  const [node, setNode] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(true);

  const sdkConfig = useMemo(() => {
    if (!pingone.clientId || !pingone.wellKnown) return null;
    return {
      clientId: pingone.clientId,
      serverConfig: { wellknown: pingone.wellKnown },
      scope: pingone.scope || "openid profile email",
      responseType: "code",
    };
  }, [pingone.clientId, pingone.wellKnown, pingone.scope]);

  const handleSuccess = async (dvClient) => {
    const info = dvClient?.getClient?.();
    const code = info?.authorization?.code;
    const state = info?.authorization?.state;
    if (!code || !state) {
      throw new Error("Missing authorization code/state from DaVinci");
    }
    const tokens = await TokenManager.getTokens({ query: { code, state } });
    const user = await UserManager.getCurrentUser();
    setPingoneSession({ tokens, user });
    navigate("/home", { replace: true });
  };

  const handleNode = async (nextNode, dvClient) => {
    if (!nextNode) return;
    setNode(nextNode);
    if (nextNode.status === "success") {
      await handleSuccess(dvClient);
    }
    if (nextNode.status === "error") {
      const dvError = dvClient?.getError?.();
      if (dvError) setError(dvError);
    }
  };

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
        const query = buildQuery(pingone);
        const hasQuery = Object.keys(query).length > 0;
        const nextNode = continueToken
          ? await dvClient.resume({ continueToken })
          : await dvClient.start(hasQuery ? { query } : undefined);
        if (!mounted) return;
        await handleNode(nextNode, dvClient);
      } catch (err) {
        if (mounted) setError(err);
      } finally {
        if (mounted) setBusy(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [sdkConfig, pingone.audience, pingone.flowId, navigate, setPingoneSession]);

  const collectors = useMemo(() => {
    if (!client) return [];
    if (typeof client.getCollectors !== "function") return [];
    return client.getCollectors() || [];
  }, [client, node]);

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
    </div>
  );
};

export default PingOneLogin;
