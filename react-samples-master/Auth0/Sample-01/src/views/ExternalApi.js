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

  const tokenFieldLibrary = {
    iss: {
      title: "Issuer (iss)",
      description: "Auth0 tenant that signs the token and vouches for the user.",
    },
    sub: {
      title: "Subject (sub)",
      description: "The unique user identifier. It never changes and is safe for mapping.",
    },
    aud: {
      title: "Audience (aud)",
      description: "The API this token is meant for. Protects against token replay elsewhere.",
    },
    exp: {
      title: "Expires (exp)",
      description: "UNIX time when the token stops being valid. Short-lived keeps risk low.",
    },
    iat: {
      title: "Issued At (iat)",
      description: "Moment Auth0 minted the token. Helps trace sessions and support tickets.",
    },
    scope: {
      title: "Scope",
      description: "Fine-grained permissions the calling app requested (e.g., read:orders).",
    },
    permissions: {
      title: "Permissions",
      description: "API-level grants enforced by Auth0 RBAC. Use to drive authorization checks.",
    },
    azp: {
      title: "Authorized Party (azp)",
      description: "The client that asked for the token. Guards multi-app ecosystems.",
    },
    kid: {
      title: "Key Id (kid)",
      description: "Tells the API which Auth0 signing key to trust when validating the signature.",
    },
    alg: {
      title: "Algorithm (alg)",
      description: "Cryptographic algorithm securing the JWT. Defaults to RS256 for Auth0 APIs.",
    },
    typ: {
      title: "Type (typ)",
      description: "Declares this is a JWT. Makes intent explicit for downstream services.",
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

        {state.showResult && (
          <section className="token-explainer" data-testid="jwt-result">
            <div className="token-explainer-copy">
              <p className="tagline">Token Experience</p>
              <h3>Il tuo token, spiegato come una storia di fiducia.</h3>
              <p>
                Ogni claim del JWT è una promessa firmata da Auth0: identità certa, permessi mirati,
                scadenze brevi e chiavi ruotate. Passa con il mouse per scoprire come ciascun campo
                protegge il tuo prodotto e riduce attriti di onboarding.
              </p>
              <ul className="selling-points">
                <li><strong>Vendita pronto-uso:</strong> mostra ai clienti come il token sigilla dati e permessi.</li>
                <li><strong>Zero trust:</strong> audience dedicate + scadenze corte per bloccare riuso eccessivo.</li>
                <li><strong>Dev friendly:</strong> format JSON leggibile, facile da provare e loggare.</li>
              </ul>
              <div className="token-badges">
                <span className="chip">Rotazione chiavi</span>
                <span className="chip">RBAC &amp; scope</span>
                <span className="chip">Telemetry pronta</span>
              </div>
            </div>

            <div className="token-visual">
              <div className="token-ticket">
                <div className="ticket-header">
                  <span className="pill">Auth0 Access Token</span>
                  <span className="pill ghost">exp {formatUnixTime(tokenPayload?.exp)}</span>
                  <span className="pill ghost">aud {tokenPayload?.aud || audience || "n/d"}</span>
                </div>
                <div className="ticket-body">
                  <p className="ticket-label">Raw JWT (completo)</p>
                  <Highlight>
                    <span className="raw-token-text">
                      {rawToken || "Premi \"Ping API\" per ottenere un token reale."}
                    </span>
                  </Highlight>
                </div>
              </div>

              {tokenError ? (
                <Highlight>
                  <span>{tokenError}</span>
                </Highlight>
              ) : (
                <>
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
                      <span className="section-hint">Identità, permessi e policy temporale</span>
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
        )}
      </div>
    </div>
  );
};

export default withAuthenticationRequired(ExternalApiComponent, {
  onRedirecting: () => <Loading />,
});
