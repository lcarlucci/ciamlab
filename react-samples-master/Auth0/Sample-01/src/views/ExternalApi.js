import React, { useEffect, useState } from "react";
import { Button, Alert } from "reactstrap";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import { getConfig } from "../config";
import Loading from "../components/Loading";
import "./css/ExternalAPI.css";

export const ExternalApiComponent = () => {
  const { apiOrigin = "https://ciamlab.onrender.com", audience } = getConfig();
  const apiBase = apiOrigin.replace(/\/+$/, "");

  const [state, setState] = useState({
    showResult: false,
    apiMessage: "",
    error: null,
  });
  const [tokenPayload, setTokenPayload] = useState(null);
  const [tokenHeader, setTokenHeader] = useState(null);
  const [tokenError, setTokenError] = useState("");
  const [jwtTooltip, setJwtTooltip] = useState({
    visible: false,
    title: "",
    description: "",
    x: 0,
    y: 0,
  });

  const { getAccessTokenSilently, loginWithPopup, getAccessTokenWithPopup } =
    useAuth0();

  const tokenFieldLibrary = {
    iss: {
      title: "Issuer (iss)",
      description: "Identifica il Security Token Service che ha emesso il JWT. Deve coincidere con il dominio Auth0 atteso; se non combacia, il token e sospetto e va rifiutato.",
    },
    sub: {
      title: "Subject (sub)",
      description: "ID univoco dell'utente presso l'issuer. Non cambia nel tempo, quindi e la chiave tecnica migliore per associare dati e permessi.",
    },
    aud: {
      title: "Audience (aud)",
      description: "Lista dei destinatari previsti (API). La tua API deve essere presente nell'audience o il token non e valido per quella risorsa.",
    },
    exp: {
      title: "Expires (exp)",
      description: "Istante di scadenza in epoch seconds. Serve a limitare la durata del token e ridurre l'impatto in caso di furto.",
    },
    iat: {
      title: "Issued At (iat)",
      description: "Momento di emissione del token. Consente di calcolare l'eta del token e fare audit sulle sessioni.",
    },
    nbf: {
      title: "Not Before (nbf)",
      description: "Il token e valido solo dopo questo istante. Utile per prevenire utilizzi anticipati e gestire differenze di clock.",
    },
    scope: {
      title: "Scope",
      description: "Permessi richiesti dal client, spesso in formato read:resource. L'API deve verificarli e concedere solo le azioni permesse.",
    },
    permissions: {
      title: "Permissions",
      description: "Permessi RBAC calcolati da Auth0 per questa audience. Sono la base per autorizzazioni granulari lato API.",
    },
    azp: {
      title: "Authorized Party (azp)",
      description: "Client che ha ottenuto il token. Aiuta a tracciare quale applicazione sta chiamando l'API e a applicare policy per client.",
    },
    kid: {
      title: "Key Id (kid)",
      description: "Identificatore della chiave di firma. L'API usa il kid per selezionare la chiave corretta dal JWKS.",
    },
    alg: {
      title: "Algorithm (alg)",
      description: "Algoritmo di firma (es. RS256). L'API deve accettare solo algoritmi consentiti per evitare downgrade o bypass.",
    },
    typ: {
      title: "Type (typ)",
      description: "Tipo di token, ad esempio JWT o at+jwt. Indica come interpretare correttamente il contenuto.",
    },
    jti: {
      title: "JWT ID (jti)",
      description: "Identificatore univoco del token. Utile per prevenire replay con blacklist/allowlist o tracking.",
    },
    auth_time: {
      title: "Auth Time",
      description: "Momento dell'ultima autenticazione interattiva dell'utente. Utile per MFA o step-up basati su freschezza.",
    },
    client_id: {
      title: "Client ID",
      description: "Identificatore dell'applicazione che ha richiesto il token. Serve per audit e policy dedicate a un client specifico.",
    },
    email: {
      title: "Email",
      description: "Email dell'utente se richiesta nello scope. E un attributo di profilo, non un identificatore stabile.",
    },
    name: {
      title: "Name",
      description: "Nome visualizzato dell'utente. Serve per UI e reportistica, non per identificare l'utente.",
    },
    roles: {
      title: "Roles",
      description: "Ruoli associati all'utente secondo RBAC. Usali insieme ai permissions per autorizzare le operazioni.",
    },
    "CIAM DEMO/roles": {
      title: "CIAM DEMO roles",
      description: "Ruoli dell'utente nel contesto CIAM DEMO. Indica il profilo funzionale assegnato.",
    },
    "https://auth.rocks/email": {
      title: "Auth.rocks email",
      description: "Email dell'utente salvata nel namespace custom auth.rocks.",
    },
    "https://auth.rocks/name": {
      title: "Auth.rocks name",
      description: "Nome dell'utente salvato nel namespace custom auth.rocks.",
    },
  };

  const getFieldMeta = (key, path) => {
    if (path.length === 0 && key === "header") {
      return {
        title: "Header",
        description: "Sezione tecnica con algoritmo, tipo e chiave di firma. Serve per validare la firma del JWT.",
      };
    }
    if (path.length === 0 && key === "payload") {
      return {
        title: "Payload",
        description: "Sezione con i claim: identita, audience, scadenze, permessi e ruoli letti dall'API.",
      };
    }
    const meta = tokenFieldLibrary[key];
    if (meta) return meta;
    return {
      title: key,
      description: "Claim personalizzato aggiunto da API, Rule o Action. Documentalo e validalo lato API.",
    };
  };

  const epochKeys = new Set(["exp", "iat", "nbf", "auth_time"]);

  const formatEpoch = (epoch) => {
    const numeric = Number(epoch);
    if (!Number.isFinite(numeric)) return null;
    const date = new Date(numeric * 1000);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("it-IT", { hour12: false });
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

  const formatValueForKey = (key, value) => {
    if (epochKeys.has(key)) {
      const human = formatEpoch(value);
      if (human) {
        return `"${human} (epoch ${Number(value)})"`;
      }
    }
    return formatPrimitive(value);
  };

  const formatPrimitive = (value) => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return `"${String(value)}"`;
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

  const JwtExperience = () => {
    const decoded = tokenError ? null : { header: tokenHeader, payload: tokenPayload };
    return (
      <section className="jwt-simple" data-testid="jwt-result">
        <div className="jwt-simple-header">
          <div>
            <span className="jwt-kicker">JWT decoded view</span>
            <h3>Struttura del JWT spiegata in modo semplice</h3>
            <p>
              Dopo il click, il token viene decodificato e mostrato come JSON leggibile.
              Passa il mouse sui campi per capire cosa significano, anche se non sei tecnico.
            </p>
          </div>
        </div>

        <div className="jwt-banner">
          <span className="jwt-banner-text">
            Cos'e un JWT? Un contenitore firmato di dati e permessi, verificabile dall'API.
          </span>
        </div>

        <div className="jwt-viewer">
          {tokenError ? (
            <div className="jwt-error">{tokenError}</div>
          ) : (
            <div
              className="jwt-json"
              role="region"
              aria-label="Decoded JWT"
              onMouseMove={updateTooltipFromEvent}
              onMouseLeave={hideTooltip}
            >
              <div className="jwt-line">
                <span className="jwt-indent" style={{ width: 0 }} />
                <span className="jwt-brace">{"{"}</span>
              </div>
              {renderObjectEntries(decoded || {}, 1, [])}
              <div className="jwt-line">
                <span className="jwt-indent" style={{ width: 0 }} />
                <span className="jwt-brace">{"}"}</span>
              </div>
            </div>
          )}

          {jwtTooltip.visible && (
            <div
              className="jwt-tooltip"
              style={{ left: jwtTooltip.x + 14, top: jwtTooltip.y + 14 }}
              role="tooltip"
            >
              <div className="jwt-tooltip-title">{jwtTooltip.title}</div>
              <div className="jwt-tooltip-body">{jwtTooltip.description}</div>
            </div>
          )}
        </div>
      </section>
    );
  };

  const handleConsent = async () => {
    try {
      await getAccessTokenWithPopup();
      setState({
        ...state,
        error: null,
      });
    } catch (error) {
      setState({
        ...state,
        error: error.error,
      });
    }

    await callApi();
  };

  const handleLoginAgain = async () => {
    try {
      await loginWithPopup();
      setState({
        ...state,
        error: null,
      });
    } catch (error) {
      setState({
        ...state,
        error: error.error,
      });
    }

    await callApi();
  };

  const decodeJwt = (jwt) => {
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      throw new Error("Token is not a JWT.");
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
    };
  };

  const callApi = async () => {
    try {
      const token = await getAccessTokenSilently({
        audience: "https://ciamlab.onrender.com/api",
        scope: "openid profile email",
      });

      try {
        const decoded = decodeJwt(token);
        setTokenHeader(decoded.header);
        setTokenPayload(decoded.payload);
        setTokenError("");
      } catch (err) {
        setTokenHeader(null);
        setTokenPayload(null);
        setTokenError(err?.message || "Unable to decode token.");
      }

      const response = await fetch(`${apiBase}/api/external`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseData = await response.json();

      setState({
        ...state,
        showResult: true,
        apiMessage: responseData,
      });
    } catch (error) {
      setState({
        ...state,
        error: error.error || error.message,
      });
    }
  };


  const handle = (e, fn) => {
    e.preventDefault();
    fn();
  };

  return (
    <div className="external-api-container">
      <div className="api-hero">
        <div className="api-hero-text">
          <span className="api-eyebrow">API Workspace</span>
          <h1>External API</h1>
          <p className="lead">
            Richiedi un access token reale, validato da Auth0, e guardalo
            trasformarsi in un racconto visivo di sicurezza e governance.
          </p>
        </div>
        <div className="api-hero-actions">
          <Button
            className="api-primary-btn"
            onClick={callApi}
            disabled={!audience}
          >
            Ping API &amp; genera token
          </Button>
          <p className="micro-copy">Demo live: nessun mock, solo il tuo JWT firmato.</p>
        </div>
      </div>

      {(state.error === "consent_required" ||
        state.error === "login_required" ||
        !audience) && (
        <div className="api-card">
          {state.error === "consent_required" && (
            <Alert color="warning" className="api-alert">
              You need to{" "}
              <a
                href="#/"
                className="alert-link"
                onClick={(e) => handle(e, handleConsent)}
              >
                consent to get access to users api
              </a>
            </Alert>
          )}

          {state.error === "login_required" && (
            <Alert color="warning" className="api-alert">
              You need to{" "}
              <a
                href="#/"
                className="alert-link"
                onClick={(e) => handle(e, handleLoginAgain)}
              >
                log in again
              </a>
            </Alert>
          )}

          {!audience && (
            <Alert color="warning" className="api-alert">
              <p>
                You can't call the API at the moment because your application does
                not have any configuration for <code>audience</code>, or it is
                using the default value of{" "}
                <code>&#123;yourApiIdentifier&#125;</code>. You might get this
                default value if you used the "Download Sample" feature of{" "}
                <a href="https://auth0.com/docs/quickstart/spa/react">
                  the quickstart guide
                </a>
                , but have not set an API up in your Auth0 Tenant. You can find
                out more information on{" "}
                <a href="https://auth0.com/docs/api">setting up APIs</a> in the
                Auth0 Docs.
              </p>
              <p>
                The audience is the identifier of the API that you want to call
                (see{" "}
                <a href="https://auth0.com/docs/get-started/dashboard/tenant-settings#api-authorization-settings">
                  API Authorization Settings
                </a>{" "}
                for more info).
              </p>
              <p>
                In this sample, you can configure the audience in a couple of
                ways:
              </p>
              <ul>
                <li>
                  in the <code>src/index.js</code> file
                </li>
                <li>
                  by specifying it in the <code>auth_config.json</code> file (see
                  the <code>auth_config.json.example</code> file for an example of
                  where it should go)
                </li>
              </ul>
              <p>
                Once you have configured the value for <code>audience</code>,
                please restart the app and try to use the "Ping API" button below.
              </p>
            </Alert>
          )}
        </div>
      )}

      <div className="result-block-container">
        {state.showResult && <JwtExperience />}
      </div>
    </div>
  );
};

export default withAuthenticationRequired(ExternalApiComponent, {
  onRedirecting: () => <Loading />,
});


