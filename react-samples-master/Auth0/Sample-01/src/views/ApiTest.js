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
        eyebrow: "Capitolo 01",
        title: "La nascita del token",
        body:
          "Questo e il tuo JWT decodificato: una storia completa di identita, ruoli, permessi e scadenze. Scorri per mettere a fuoco ogni capitolo.",
      },
      {
        id: "header",
        eyebrow: "Capitolo 02",
        title: "Header: la chiave della fiducia",
        body:
          "Algoritmo, tipo e key id. Qui la tua API capisce come verificare la firma e quali chiavi usare.",
      },
      {
        id: "payload",
        eyebrow: "Capitolo 03",
        title: "Payload: identita e potere d'azione",
        body:
          "Il cuore del token: audience, subject, ruoli, scope e tempi. E la sezione che decide cosa puoi fare.",
      },
      {
        id: "signature",
        eyebrow: "Capitolo 04",
        title: "Signature: prova di integrita",
        body:
          "La firma sigilla tutto. Se qualcuno altera il token, la tua API lo vede subito e blocca l'accesso.",
      },
      {
        id: "use",
        eyebrow: "Capitolo 05",
        title: "Dal racconto all'azione",
        body:
          "In produzione la verifica e locale e veloce: firma, audience e scadenze. Poi autorizzazioni basate su ruoli e permessi.",
      },
    ],
    []
  );

  const tokenFieldLibrary = {
    iss: {
      title: "Issuer (iss)",
      description:
        "Emittente del token. Deve combaciare con il dominio Auth0 atteso dalla tua API, altrimenti il token non e valido.",
    },
    sub: {
      title: "Subject (sub)",
      description:
        "Identificativo univoco dell'utente rilasciato dall'emittente. E la chiave stabile per profili e mapping permessi.",
    },
    aud: {
      title: "Audience (aud)",
      description:
        "API di destinazione. Se la tua API non compare qui, il token non puo essere usato per accedervi.",
    },
    exp: {
      title: "Expires (exp)",
      description:
        "Scadenza in epoch. Dopo questo momento il token deve essere rifiutato senza eccezioni.",
    },
    iat: {
      title: "Issued At (iat)",
      description:
        "Momento di emissione in epoch. Utile per audit e per stimare l'eta del token.",
    },
    nbf: {
      title: "Not Before (nbf)",
      description:
        "Non valido prima di questo momento (epoch). Protegge da usi anticipati del token.",
    },
    scope: {
      title: "Scope",
      description:
        "Permessi richiesti dal client (es. read:orders). La tua API deve applicarli per ogni endpoint.",
    },
    permissions: {
      title: "Permissions",
      description:
        "Permessi RBAC calcolati da Auth0 per questa audience. Sono la base per autorizzare le azioni.",
    },
    azp: {
      title: "Authorized Party (azp)",
      description:
        "Applicazione client che ha richiesto il token. Ti aiuta a capire da quale app arriva la richiesta.",
    },
    kid: {
      title: "Key Id (kid)",
      description:
        "Identificativo della chiave di firma. La tua API lo usa per selezionare la chiave corretta nel JWKS Auth0.",
    },
    alg: {
      title: "Algorithm (alg)",
      description:
        "Algoritmo di firma (es. RS256). Accetta solo quelli consentiti dalla tua policy di sicurezza.",
    },
    typ: {
      title: "Type (typ)",
      description:
        "Tipo di token (spesso JWT o at+jwt). Serve per distinguere access token da altri formati.",
    },
    jti: {
      title: "JWT ID (jti)",
      description:
        "Identificativo univoco del token. Utile per prevenire replay o per tracciare eventi critici.",
    },
    auth_time: {
      title: "Auth Time",
      description:
        "Ultima autenticazione interattiva dell'utente. Fondamentale per policy di step-up.",
    },
    client_id: {
      title: "Client ID",
      description:
        "Identificativo dell'app client che ha richiesto il token. Aiuta nel controllo di fiducia tra app e API.",
    },
    "CIAM DEMO/roles": {
      title: "CIAM DEMO roles",
      description:
        "Ruoli assegnati all'utente nel contesto CIAM DEMO. Determinano cosa puo fare nell'applicazione.",
    },
    "https://auth.rocks/email": {
      title: "Auth.rocks email",
      description:
        "Email dell'utente nel namespace custom auth.rocks. Utile per contatto e identificazione.",
    },
    "https://auth.rocks/name": {
      title: "Auth.rocks name",
      description:
        "Nome completo dell'utente nel namespace custom auth.rocks. Migliora UX e riconoscibilita.",
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
      throw new Error("Token non valido.");
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
      setTokenError(error?.message || "Impossibile ottenere il token.");
    }
  };

  const getFieldMeta = (key, path) => {
    if (path.length === 0 && key === "header") {
      return {
        title: "Header",
        description: "Contiene algoritmo, tipo e chiave. Serve alla tua API per verificare la firma.",
      };
    }
    if (path.length === 0 && key === "payload") {
      return {
        title: "Payload",
        description: "Raccoglie i claim: identita, audience, ruoli, scope e scadenze.",
      };
    }
    const meta = tokenFieldLibrary[key];
    if (meta) return meta;
    return {
      title: key,
      description: "Claim custom aggiunto da API, Rule o Action. Va documentato e validato lato API.",
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
    const stepsEls = Array.from(document.querySelectorAll(".story-step"));
    if (!stepsEls.length) return undefined;

    let positions = [];
    const computePositions = () => {
      positions = stepsEls.map((el) => ({
        id: el.getAttribute("data-step"),
        top: el.getBoundingClientRect().top + window.scrollY,
      }));
    };

    let ticking = false;
    const updateActiveStep = () => {
      const trigger = window.scrollY + window.innerHeight * 0.45;
      let current = positions[0];
      positions.forEach((pos) => {
        if (pos.top <= trigger) {
          current = pos;
        }
      });
      if (current?.id) {
        setActiveStep(current.id);
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateActiveStep);
        ticking = true;
      }
    };

    computePositions();
    updateActiveStep();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      computePositions();
      onScroll();
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const renderStageContent = () => {
    if (tokenError) {
      return <div className="token-error">{tokenError}</div>;
    }
    if (!tokenHeader || !tokenPayload) {
      return (
        <div className="token-empty">
          <p>Premi il pulsante per iniziare e decodificare un JWT reale.</p>
        </div>
      );
    }

    if (activeStep === "header") {
      return (
        <div className="token-code focus-header" onMouseMove={updateTooltipFromEvent} onMouseLeave={hideTooltip}>
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
        <div className="token-code focus-payload" onMouseMove={updateTooltipFromEvent} onMouseLeave={hideTooltip}>
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
          <h4>Signature</h4>
          <p>La firma garantisce che il token non sia stato alterato.</p>
          <div className="signature-pill">
            {tokenSignature || "Signature non disponibile"}
          </div>
        </div>
      );
    }

    if (activeStep === "use") {
      return (
        <div className="usage-panel">
          <h4>Come lo usa la tua API</h4>
          <ul>
            <li>Valida la firma con Auth0 JWKS</li>
            <li>Controlla audience, scadenza e not-before</li>
            <li>Autorizza con ruoli e permessi</li>
          </ul>
        </div>
      );
    }

    return (
      <div className="token-code focus-all" onMouseMove={updateTooltipFromEvent} onMouseLeave={hideTooltip}>
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

  const currentStep = steps.find((step) => step.id === activeStep) || steps[0];

  return (
    <div className="api-test-container">
      <header className="api-test-hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">API Test Lab</span>
          <h1>Il tuo JWT raccontato come una storia</h1>
          <p>
            Un singolo token, cinque capitoli. Scopri come Auth0 rende ogni parte chiara,
            verificabile e pronta per la produzione.
          </p>
          <button className="hero-btn" onClick={callApi} disabled={!audience}>
            Inizia la storia
          </button>
        </div>
        <div className="hero-glow" aria-hidden="true" />
      </header>

      <section className="story">
        <div className="story-sticky">
          <div className={`token-stage step-${activeStep}`}>
            <div className="stage-header">
              <span className="stage-label">{currentStep.eyebrow}</span>
              <span className="stage-sub">{currentStep.title}</span>
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
            <section
              className={`story-step ${activeStep === step.id ? "active" : ""}`}
              key={step.id}
              data-step={step.id}
            >
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
