import React, { useState } from "react";
import { Button, Alert } from "reactstrap";
import Highlight from "../components/Highlight";
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
  const [rawToken, setRawToken] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [selectedClaim, setSelectedClaim] = useState(null);

  const { getAccessTokenSilently, loginWithPopup, getAccessTokenWithPopup } =
    useAuth0();

  const copyText = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
  };

  const tokenFieldLibrary = {
    iss: {
      title: "Issuer (iss)",
      description: "Chi emette il token. Deve combaciare con il dominio Auth0 atteso, altrimenti l'API lo rifiuta.",
    },
    sub: {
      title: "Subject (sub)",
      description: "Identificativo univoco dell'utente nell'issuer. E stabile e ideale come chiave tecnica di profilo.",
    },
    aud: {
      title: "Audience (aud)",
      description: "API destinatarie. Se la tua API non e presente, il token non e valido per quella risorsa.",
    },
    exp: {
      title: "Expires (exp)",
      description: "Istante di scadenza (epoch seconds). Dopo questo momento l'API deve rifiutare il token.",
    },
    iat: {
      title: "Issued At (iat)",
      description: "Momento di emissione. Utile per audit, debugging e correlazione con i log di login.",
    },
    nbf: {
      title: "Not Before (nbf)",
      description: "Il token e valido solo dopo questo istante. Serve a bloccare utilizzi anticipati.",
    },
    scope: {
      title: "Scope",
      description: "Permessi richiesti dal client (es. read:orders). L'API deve controllarli per autorizzare.",
    },
    permissions: {
      title: "Permissions",
      description: "Permessi RBAC calcolati da Auth0 per questa audience. Usali per i check di autorizzazione.",
    },
    azp: {
      title: "Authorized Party (azp)",
      description: "Client che ha ottenuto il token. Importante per tracciare chi sta chiamando l'API.",
    },
    kid: {
      title: "Key Id (kid)",
      description: "Identificatore della chiave di firma. L'API scarica il JWKS e usa il kid per validare.",
    },
    alg: {
      title: "Algorithm (alg)",
      description: "Algoritmo di firma (es. RS256). L'API deve accettare solo quelli previsti.",
    },
    typ: {
      title: "Type (typ)",
      description: "Tipo di token (tipicamente JWT). Aiuta i consumer a interpretarlo correttamente.",
    },
    jti: {
      title: "JWT ID (jti)",
      description: "Identificatore univoco del token. Utile per prevenire replay (deny/allow list).",
    },
    auth_time: {
      title: "Auth Time",
      description: "Momento dell'ultima autenticazione interattiva. Utile per MFA o step-up.",
    },
  };

  const formatUnixTime = (unix) => {
    if (!unix) return "n/d";
    return new Date(unix * 1000).toLocaleString();
  };

  const formatValue = (value) => {
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object" && value !== null) return JSON.stringify(value, null, 2);
    return String(value);
  };

  const truncateToken = (token, head = 48, tail = 24) => {
    if (!token) return "";
    if (token.length <= head + tail + 3) return token;
    return `${token.slice(0, head)}...${token.slice(-tail)}`;
  };

  const truncateChunk = (chunk, head = 24, tail = 10) => {
    if (!chunk) return "";
    if (chunk.length <= head + tail + 3) return chunk;
    return `${chunk.slice(0, head)}...${chunk.slice(-tail)}`;
  };

  const renderTokenGrid = (data, label) => (
    <div className="token-grid">
      {Object.entries(data || {}).map(([key, value]) => {
        const meta =
          tokenFieldLibrary[key] || {
            title: key,
            description: "Custom claim injected by your API, Rule, or Action.",
          };
        return (
          <div
            className="token-field"
            key={`${label}-${key}`}
            role="button"
            tabIndex={0}
            onClick={() =>
              setSelectedClaim({
                key,
                label,
                title: meta.title,
                description: meta.description,
                value,
              })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedClaim({
                  key,
                  label,
                  title: meta.title,
                  description: meta.description,
                  value,
                });
              }
            }}
          >
            <div className="field-key">{meta.title}</div>
            <div className="field-value">{formatValue(value)}</div>
            <div className="field-tooltip">
              <p className="tooltip-title">{meta.title}</p>
              <p className="tooltip-body">{meta.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  const JwtExperience = () => (
    <section className="token-explainer" data-testid="jwt-result">
      <div className="token-explainer-copy">
        <div className="jwt-intro">
          <p className="tagline">JWT Fundamentals</p>
          <h3>Cos'e un JSON Web Token (JWT)</h3>
          <p>
            Un JWT e un token firmato che trasporta informazioni (claim) in modo compatto e
            verificabile. Non cifra i dati: li rende tamper-proof grazie alla firma. Per questo
            va sempre usato su canali sicuri (HTTPS) e con scadenze brevi.
          </p>
          <ul className="intro-points">
            <li><strong>Integrita e autenticita:</strong> la firma dimostra che il token non e stato alterato.</li>
            <li><strong>Controllo dell'accesso:</strong> aud, exp, nbf e scope riducono il rischio di abuso.</li>
            <li><strong>Autorizzazioni chiare:</strong> permissions e scope abilitano policy granulari lato API.</li>
            <li><strong>Performance:</strong> si valida localmente senza chiamare l'IdP a ogni richiesta.</li>
          </ul>
          <div className="structure-bar">
            <span className="structure-pill">Header</span>
            <span className="dot-sep">.</span>
            <span className="structure-pill">Payload</span>
            <span className="dot-sep">.</span>
            <span className="structure-pill">Signature</span>
          </div>
        </div>

        <div className="raw-jwt-panel">
          <div className="panel-head">
            <span className="pill">JWT decodificato</span>
            <div className="panel-actions">
              <button className="ghost-btn" onClick={() => copyText(rawToken)}>Copia token</button>
              <button className="ghost-btn" onClick={() => copyText(rawToken.split(".")[0] || "")}>Copia header</button>
              <button className="ghost-btn" onClick={() => copyText(rawToken.split(".")[1] || "")}>Copia payload</button>
            </div>
          </div>
          <div className="raw-jwt-full">
            {tokenError ? (
              <Highlight>
                <span className="raw-token-text">{tokenError}</span>
              </Highlight>
            ) : (
              <Highlight>
                <span className="raw-token-text">
                  {JSON.stringify({ header: tokenHeader, payload: tokenPayload }, null, 2)}
                </span>
              </Highlight>
            )}
          </div>
          <p className="raw-label">Raw JWT (troncato)</p>
          <div className="raw-truncated">
            <span className="raw-token-text">
              {rawToken ? truncateToken(rawToken) : "Premi \"Ping API\" per ottenere un token reale."}
            </span>
          </div>
          <div className="jwt-chunks">
            <div className="chunk header-chunk" title="Header (JOSE)">
              {rawToken ? truncateChunk(rawToken.split(".")[0]) : "header"}
            </div>
            <span className="dot-sep">.</span>
            <div className="chunk payload-chunk" title="Payload (claims)">
              {rawToken ? truncateChunk(rawToken.split(".")[1]) : "payload"}
            </div>
            <span className="dot-sep">.</span>
            <div className="chunk signature-chunk" title="Signature">
              {rawToken ? truncateChunk(rawToken.split(".")[2]) : "signature"}
            </div>
          </div>
          <p className="raw-hint">
            Header e Payload sono firmati; la Signature garantisce integrita e provenienza. L'API valida col JWKS di Auth0.
          </p>
        </div>

        <div className="token-badges">
          <span className="chip">Rotazione chiavi</span>
          <span className="chip">RBAC &amp; scope</span>
          <span className="chip">Telemetry pronta</span>
        </div>
      </div>

      <div className="token-visual">
        {tokenError ? (
          <Highlight>
            <span>{tokenError}</span>
          </Highlight>
        ) : (
          <>
            <div className="token-ticket">
              <div className="ticket-header">
                <span className="pill">Auth0 Access Token</span>
                <span className="pill ghost">exp {formatUnixTime(tokenPayload?.exp)}</span>
                <span className="pill ghost">aud {tokenPayload?.aud || audience || "n/d"}</span>
              </div>
              <p className="ticket-copy">
                Questo access token e stato emesso per l'API corrente ed e pronto per i check di autorizzazione.
              </p>
              <div className="ticket-raw">
                <span className="ticket-raw-label">Raw (troncato)</span>
                <span className="ticket-raw-value">{rawToken ? truncateToken(rawToken) : "n/d"}</span>
              </div>
            </div>

            <div className="token-section">
              <div className="section-header">
                <span className="section-title">Header</span>
                <span className="section-hint">Firma + algoritmo + key id</span>
              </div>
              {renderTokenGrid(tokenHeader, "header")}
            </div>

            <div className="token-section">
              <div className="section-header">
                <span className="section-title">Payload</span>
                <span className="section-hint">Identita, permessi e policy temporale</span>
              </div>
              {renderTokenGrid(tokenPayload, "payload")}
            </div>

            {selectedClaim && (
              <div className="claim-detail" role="dialog" aria-label="Dettaglio claim">
                <div className="claim-header">
                  <div>
                    <p className="claim-kicker">{selectedClaim.label.toUpperCase()}</p>
                    <h4>{selectedClaim.title}</h4>
                  </div>
                  <button className="close-btn" onClick={() => setSelectedClaim(null)} aria-label="Chiudi dettaglio claim">
                    ×
                  </button>
                </div>
                <p className="claim-description">{selectedClaim.description}</p>
                <div className="claim-value-block">
                  <p className="claim-value-label">Valore</p>
                  <pre className="claim-value">{formatValue(selectedClaim.value)}</pre>
                </div>
                <div className="claim-actions">
                  <span className="chip">Click su un altro campo per aggiornare</span>
                  <span
                    className="chip ghost"
                    onClick={() => navigator.clipboard?.writeText(String(selectedClaim.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigator.clipboard?.writeText(String(selectedClaim.value));
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    Copia valore
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );

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

      setRawToken(token);

      try {
        const decoded = decodeJwt(token);
        setTokenHeader(decoded.header);
        setTokenPayload(decoded.payload);
        setTokenError("");
        setSelectedClaim(null);
      } catch (err) {
        setTokenHeader(null);
        setTokenPayload(null);
        setTokenError(err?.message || "Unable to decode token.");
        setSelectedClaim(null);
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

        <p>
          This will call a local API on port 3001 that would have been started
          if you run <code>npm run dev</code>. An access token is sent as part
          of the request's `Authorization` header and the API will validate it
          using the API's audience value.
        </p>

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

      <div className="result-block-container">
        {state.showResult && (
          <div className="result-block" data-testid="api-result">
            <div className="result-header">
              <h6 className="muted">API Response</h6>
              <span className="chip success">LIVE</span>
            </div>
            <Highlight>
              <span>{JSON.stringify(state.apiMessage, null, 2)}</span>
            </Highlight>
          </div>
        )}

        {state.showResult && <JwtExperience />}
      </div>
    </div>
  );
};

export default withAuthenticationRequired(ExternalApiComponent, {
  onRedirecting: () => <Loading />,
});
