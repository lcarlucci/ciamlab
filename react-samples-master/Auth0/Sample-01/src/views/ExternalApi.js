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
  const [tokenError, setTokenError] = useState("");

  const { getAccessTokenSilently, loginWithPopup, getAccessTokenWithPopup } =
    useAuth0();

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
      }
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
            Ping an external API by clicking the button below.
          </p>
        </div>
        <div className="api-hero-actions">
          <Button
            className="api-primary-btn"
            onClick={callApi}
            disabled={!audience}
          >
            Ping API
          </Button>
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
            <h6 className="muted">API Response</h6>
            <Highlight>
              <span>{JSON.stringify(state.apiMessage, null, 2)}</span>
            </Highlight>
          </div>
        )}
        {state.showResult && (
          <div className="result-block" data-testid="jwt-result">
            <h6 className="muted">Decoded JWT</h6>
            {tokenError ? (
              <Highlight>
                <span>{tokenError}</span>
              </Highlight>
            ) : (
              <Highlight>
                <span>{JSON.stringify({ header: tokenHeader, payload: tokenPayload }, null, 2)}</span>
              </Highlight>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default withAuthenticationRequired(ExternalApiComponent, {
  onRedirecting: () => <Loading />,
});
