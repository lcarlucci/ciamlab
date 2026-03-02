import React, { useEffect, useMemo, useState } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import { getConfig } from "../config";
import Loading from "../components/Loading";
import "./css/ApiTest.css";

const ApiTestComponent = () => {
  const { getAccessTokenSilently } = useAuth0();
  const { apiOrigin = "https://ciamlab.onrender.com", audience } = getConfig();
  const apiBase = apiOrigin.replace(/\/+$/, "");

  const [tokenHeader, setTokenHeader] = useState(null);
  const [tokenPayload, setTokenPayload] = useState(null);
  const [tokenSignature, setTokenSignature] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [activeStep, setActiveStep] = useState("intro");
  const [jwtTooltip, setJwtTooltip] = useState({
    visible: false,
    title: "",
    description: "",
    x: 0,
    y: 0,
  });

  const steps = useMemo(
    () => [
      {
        id: "intro",
        eyebrow: "Step 01",
        title: "Decoded overview",
        body:
          "This is the decoded JWT. It is a readable snapshot of identity and access facts. Scroll to focus on each part.",
      },
      {
        id: "header",
        eyebrow: "Step 02",
        title: "Header: how the token is signed",
        body:
          "The header tells your API which algorithm and key were used to sign the token. It is the trust anchor.",
      },
      {
        id: "payload",
        eyebrow: "Step 03",
        title: "Payload: who and what is allowed",
        body:
          "Claims live here: identity, audience, scopes, roles and expirations. This is what your API authorizes.",
      },
      {
        id: "signature",
        eyebrow: "Step 04",
        title: "Signature: proof of integrity",
        body:
          "The signature prevents tampering. Your API validates it with Auth0 JWKS before trusting any claim.",
      },
      {
        id: "use",
        eyebrow: "Step 05",
        title: "Operational view",
        body:
          "Use this to explain to stakeholders why a JWT is safe, fast, and portable across services.",
      },
    ],
    []
  );

  const tokenFieldLibrary = {
    iss: {
      title: "Issuer (iss)",
      description: "Authority that issued the token. Must match the Auth0 domain expected by your API.",
    },
    sub: {
      title: "Subject (sub)",
      description: "Unique user id from the issuer. Stable key for profiles and permissions mapping.",
    },
    aud: {
      title: "Audience (aud)",
      description: "Target API list. If your API is not here, the token is not valid for it.",
    },
    exp: {
      title: "Expires (exp)",
      description: "Epoch expiry time. After this moment the token must be rejected.",
    },
    iat: {
      title: "Issued At (iat)",
      description: "Epoch issued time. Useful for audit and token age checks.",
    },
    nbf: {
      title: "Not Before (nbf)",
      description: "Epoch time before which the token must not be accepted.",
    },
    scope: {
      title: "Scope",
      description: "Client requested permissions (e.g. read:orders). Your API should enforce them.",
    },
    permissions: {
      title: "Permissions",
      description: "RBAC permissions calculated by Auth0 for this audience.",
    },
    azp: {
      title: "Authorized Party (azp)",
      description: "Client application that requested the token.",
    },
    kid: {
      title: "Key Id (kid)",
      description: "Signing key id used to verify the signature against Auth0 JWKS.",
    },
    alg: {
      title: "Algorithm (alg)",
      description: "Signature algorithm (e.g. RS256). Accept only allowed algorithms.",
    },
    typ: {
      title: "Type (typ)",
      description: "Token type (often JWT or at+jwt).",
    },
    jti: {
      title: "JWT ID (jti)",
      description: "Unique token id. Useful for replay prevention or tracking.",
    },
    auth_time: {
      title: "Auth Time",
      description: "When the user last authenticated interactively. Useful for step-up policies.",
    },
    client_id: {
      title: "Client ID",
      description: "Identifier of the client app that requested the token.",
    },
    "CIAM DEMO/roles": {
      title: "CIAM DEMO roles",
      description: "Roles assigned to the user in the CIAM DEMO context.",
    },
    "https://auth.rocks/email": {
      title: "Auth.rocks email",
      description: "User email stored in the auth.rocks custom namespace.",
    },
    "https://auth.rocks/name": {
      title: "Auth.rocks name",
      description: "User name stored in the auth.rocks custom namespace.",
    },
  };

  const epochKeys = new Set(["exp", "iat", "nbf", "auth_time"]);

  const formatEpoch = (epoch) => {
    const numeric = Number(epoch);
    if (!Number.isFinite(numeric)) return null;
    const date = new Date(numeric * 1000);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("it-IT", { hour12: false });
  };

  const decodeJwt = (jwt) => {
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      throw new Error("Token is not a valid JWT.");
    }

    const decodePart = (part) => {
      const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
      const json = atob(padded);
      return JSON.parse(json);
    };

    return {
      header: decodePart(parts[0]),
      payload: decodePart(parts[1]),
      signature: parts[2],
    };
  };

  const callApi = async () => {
    try {
      const token = await getAccessTokenSilently({
        audience: "https://ciamlab.onrender.com/api",
        scope: "openid profile email",
      });

      const decoded = decodeJwt(token);
      setTokenHeader(decoded.header);
      setTokenPayload(decoded.payload);
      setTokenSignature(decoded.signature || "");
      setTokenError("");

      // Optional ping (best effort)
      try {
        await fetch(`${apiBase}/api/external`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore ping errors in this view.
      }
    } catch (error) {
      setTokenHeader(null);
      setTokenPayload(null);
      setTokenSignature("");
      setTokenError(error?.message || "Unable to fetch token.");
    }
  };

  const getFieldMeta = (key, path) => {
    if (path.length === 0 && key === "header") {
      return {
        title: "Header",
        description: "Technical header used to validate signature and algorithm.",
      };
    }
    if (path.length === 0 && key === "payload") {
      return {
        title: "Payload",
        description: "Claims that describe identity, permissions and constraints.",
      };
    }
    const meta = tokenFieldLibrary[key];
    if (meta) return meta;
    return {
      title: key,
      description: "Custom claim added by API, Rule or Action. Document and validate it on the API.",
    };
  };

  const hideTooltip = () => {
    setJwtTooltip((prev) => ({ ...prev, visible: false }));
  };

  const updateTooltipFromEvent = (event) => {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const keyEl = el && el.closest ? el.closest(".jwt-key") : null;
    if (!keyEl) {
      hideTooltip();
      return;
    }
    setJwtTooltip({
      visible: true,
      title: keyEl.getAttribute("data-title") || "",
      description: keyEl.getAttribute("data-desc") || "",
      x: event.clientX,
      y: event.clientY,
    });
  };

  const renderKey = (key, path) => {
    const meta = getFieldMeta(key, path);
    return (
      <span
        className={`jwt-key ${path.length === 0 ? "root" : ""}`}
        data-title={meta.title}
        data-desc={meta.description}
      >
        "{key}"
      </span>
    );
  };

  const formatPrimitive = (value) => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return `"${String(value)}"`;
  };

  const formatValueForKey = (key, value) => {
    if (epochKeys.has(key)) {
      const human = formatEpoch(value);
      if (human) {
        return `"${human} (epoch ${Number(value)})"`;
      }
    }
    return formatPrimitive(value);
  };

  const isPlainObject = (value) =>
    value && typeof value === "object" && !Array.isArray(value);

  function renderArrayEntries(arr, indent, path) {
    const lines = [];
    arr.forEach((value, index) => {
      const isLast = index === arr.length - 1;
      const comma = !isLast ? <span className="jwt-comma">,</span> : null;
      if (isPlainObject(value)) {
        lines.push(
          <div className="jwt-line" key={`${path.join(".")}-obj-${index}-open`}>
            <span className="jwt-indent" style={{ width: indent * 16 }} />
            <span className="jwt-brace">{"{"}</span>
          </div>
        );
        lines.push(...renderObjectEntries(value, indent + 1, path));
        lines.push(
          <div className="jwt-line" key={`${path.join(".")}-obj-${index}-close`}>
            <span className="jwt-indent" style={{ width: indent * 16 }} />
            <span className="jwt-brace">{"}"}</span>
            {comma}
          </div>
        );
        return;
      }
      if (Array.isArray(value)) {
        lines.push(
          <div className="jwt-line" key={`${path.join(".")}-arr-${index}-open`}>
            <span className="jwt-indent" style={{ width: indent * 16 }} />
            <span className="jwt-brace">[</span>
          </div>
        );
        lines.push(...renderArrayEntries(value, indent + 1, path));
        lines.push(
          <div className="jwt-line" key={`${path.join(".")}-arr-${index}-close`}>
            <span className="jwt-indent" style={{ width: indent * 16 }} />
            <span className="jwt-brace">]</span>
            {comma}
          </div>
        );
        return;
      }
      lines.push(
        <div className="jwt-line" key={`${path.join(".")}-value-${index}`}>
          <span className="jwt-indent" style={{ width: indent * 16 }} />
          <span className="jwt-value">{formatPrimitive(value)}</span>
          {comma}
        </div>
      );
    });
    return lines;
  }

  function renderObjectEntries(obj, indent, path) {
    const entries = Object.entries(obj || {});
    const lines = [];
    entries.forEach(([key, value], index) => {
      const isLast = index === entries.length - 1;
      const comma = !isLast ? <span className="jwt-comma">,</span> : null;
      if (isPlainObject(value)) {
        lines.push(
          <div className="jwt-line" key={`${path.join(".")}.${key}-open`}>
            <span className="jwt-indent" style={{ width: indent * 16 }} />
            {renderKey(key, path)}
            <span className="jwt-colon">: </span>
            <span className="jwt-brace">{"{"}</span>
          </div>
        );
        lines.push(...renderObjectEntries(value, indent + 1, [...path, key]));
        lines.push(
          <div className="jwt-line" key={`${path.join(".")}.${key}-close`}>
            <span className="jwt-indent" style={{ width: indent * 16 }} />
            <span className="jwt-brace">{"}"}</span>
            {comma}
          </div>
        );
        return;
      }
      if (Array.isArray(value)) {
        lines.push(
          <div className="jwt-line" key={`${path.join(".")}.${key}-arr-open`}>
            <span className="jwt-indent" style={{ width: indent * 16 }} />
            {renderKey(key, path)}
            <span className="jwt-colon">: </span>
            <span className="jwt-brace">[</span>
          </div>
        );
        lines.push(...renderArrayEntries(value, indent + 1, [...path, key]));
        lines.push(
          <div className="jwt-line" key={`${path.join(".")}.${key}-arr-close`}>
            <span className="jwt-indent" style={{ width: indent * 16 }} />
            <span className="jwt-brace">]</span>
            {comma}
          </div>
        );
        return;
      }
      lines.push(
        <div className="jwt-line" key={`${path.join(".")}.${key}-value`}>
          <span className="jwt-indent" style={{ width: indent * 16 }} />
          {renderKey(key, path)}
          <span className="jwt-colon">: </span>
          <span className="jwt-value">{formatValueForKey(key, value)}</span>
          {comma}
        </div>
      );
    });
    return lines;
  }

  useEffect(() => {
    const handleScroll = () => hideTooltip();
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll(".story-step"));
    if (!elements.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (!visible.length) return;
        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const best = visible[0];
        const stepId = best.target.getAttribute("data-step");
        if (stepId) setActiveStep(stepId);
      },
      { threshold: [0.2, 0.4, 0.6, 0.8] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const renderStageContent = () => {
    if (tokenError) {
      return <div className="token-error">{tokenError}</div>;
    }
    if (!tokenHeader || !tokenPayload) {
      return (
        <div className="token-empty">
          <p>Press "Ping token" to decode a real JWT.</p>
        </div>
      );
    }

    if (activeStep === "header") {
      return (
        <div className="token-code" onMouseMove={updateTooltipFromEvent} onMouseLeave={hideTooltip}>
          <div className="jwt-line">
            <span className="jwt-brace">{"{"}</span>
          </div>
          {renderObjectEntries({ header: tokenHeader }, 1, [])}
          <div className="jwt-line">
            <span className="jwt-brace">{"}"}</span>
          </div>
        </div>
      );
    }

    if (activeStep === "payload") {
      return (
        <div className="token-code" onMouseMove={updateTooltipFromEvent} onMouseLeave={hideTooltip}>
          <div className="jwt-line">
            <span className="jwt-brace">{"{"}</span>
          </div>
          {renderObjectEntries({ payload: tokenPayload }, 1, [])}
          <div className="jwt-line">
            <span className="jwt-brace">{"}"}</span>
          </div>
        </div>
      );
    }

    if (activeStep === "signature") {
      return (
        <div className="signature-panel">
          <h4>Signature segment</h4>
          <p>
            This is the signature part of the token. It is used by your API to verify integrity.
          </p>
          <div className="signature-pill">
            {tokenSignature || "Signature not available"}
          </div>
        </div>
      );
    }

    if (activeStep === "use") {
      return (
        <div className="usage-panel">
          <h4>What your API does with it</h4>
          <ul>
            <li>Validate signature with Auth0 JWKS</li>
            <li>Check audience, expiry, and not-before</li>
            <li>Authorize based on permissions and roles</li>
          </ul>
        </div>
      );
    }

    return (
      <div className="token-code" onMouseMove={updateTooltipFromEvent} onMouseLeave={hideTooltip}>
        <div className="jwt-line">
          <span className="jwt-brace">{"{"}</span>
        </div>
        {renderObjectEntries({ header: tokenHeader, payload: tokenPayload }, 1, [])}
        <div className="jwt-line">
          <span className="jwt-brace">{"}"}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="api-test-container">
      <header className="api-test-hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">API Test Lab</span>
          <h1>Scroll-driven JWT story</h1>
          <p>
            Ping a real token and let the page guide you through header, payload, and signature with a
            cinematic scroll.
          </p>
          <button className="hero-btn" onClick={callApi} disabled={!audience}>
            Ping token
          </button>
        </div>
        <div className="hero-glow" aria-hidden="true" />
      </header>

      <section className="story">
        <div className="story-sticky">
          <div className={`token-stage step-${activeStep}`}>
            <div className="stage-header">
              <span className="stage-label">{activeStep.toUpperCase()}</span>
              <span className="stage-sub">Decoded JWT view</span>
            </div>
            {renderStageContent()}
            {jwtTooltip.visible && (
              <div
                className="jwt-tooltip"
                style={{ left: jwtTooltip.x + 16, top: jwtTooltip.y + 16 }}
                role="tooltip"
              >
                <div className="jwt-tooltip-title">{jwtTooltip.title}</div>
                <div className="jwt-tooltip-body">{jwtTooltip.description}</div>
              </div>
            )}
          </div>
        </div>
        <div className="story-steps">
          {steps.map((step) => (
            <section className="story-step" key={step.id} data-step={step.id}>
              <span className="step-eyebrow">{step.eyebrow}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
};

export default withAuthenticationRequired(ApiTestComponent, {
  onRedirecting: () => <Loading />,
});
