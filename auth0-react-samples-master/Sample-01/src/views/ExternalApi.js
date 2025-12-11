import React, { useState } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import { getConfig } from "../config";
import Loading from "../components/Loading";
import Highlight from "../components/Highlight";
import "./css/ExternalAPI.css";


export const ExternalApiComponent = () => {
  const { apiOrigin = "https://ciamlab.onrender.com/", audience } = getConfig();

  const [state, setState] = useState({
    showResult: false,
    apiMessage: "",
    error: null,
  });

  const { getAccessTokenSilently, loginWithPopup, getAccessTokenWithPopup } =
    useAuth0();

  const handleConsent = async () => {
    console.log("handleConsent fired");
    try {
      await getAccessTokenWithPopup();
      setState({ ...state, error: null });
      console.log("Consent granted via popup");
    } catch (error) {
      console.error("Error in handleConsent:", error);
      setState({ ...state, error: error.error || error.message });
    }
    await callApi();
  };

  const handleLoginAgain = async () => {
    console.log("handleLoginAgain fired");
    try {
      await loginWithPopup();
      setState({ ...state, error: null });
      console.log("Logged in again via popup");
    } catch (error) {
      console.error("Error in handleLoginAgain:", error);
      setState({ ...state, error: error.error || error.message });
    }
    await callApi();
  };

const callApi = async () => {
  console.log("callApi fired");

  try {
    // Ottieni token in modo sicuro tramite Auth0 SPA SDK
    const token = await getAccessTokenSilently({
      audience: audience     // l'audience della tua API
    });
    console.log("Access Token:", token.slice(0, 20) + "..."); // log solo i primi 20 caratteri per sicurezza

    const url = `${apiOrigin}/api/external?cacheBust=${Date.now()}`;
    console.log("Calling API at:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    console.log("HTTP Status:", response.status);

    const raw = await response.text();
    console.log("Raw response:", raw);

    if (!response.ok) {
      console.error("Non-OK HTTP response:", response.status, raw);
      setState({ ...state, error: `HTTP ${response.status}: ${raw}` });
      return;
    }

    if (!raw.startsWith("{") && !raw.startsWith("[")) {
      console.error("La risposta non è JSON:", raw);
      setState({ ...state, error: "La risposta API non è JSON" });
      return;
    }

    const responseData = JSON.parse(raw);
    console.log("Parsed JSON response:", responseData);

    setState({
      ...state,
      showResult: true,
      apiMessage: responseData
    });
  } catch (error) {
    console.error("Error in callApi:", error);
    setState({ ...state, error: error.message || error.error });
  }
};


  const handle = (e, fn) => {
    e.preventDefault();
    fn();
  };

  return (
    <div className="external-api-container">
      {state.error === "consent_required" && (
        <div className="alert alert-warning">
          You need to{" "}
          <a href="#/" onClick={(e) => handle(e, handleConsent)}>
            consent to get access to users api
          </a>
        </div>
      )}

      {state.error === "login_required" && (
        <div className="alert alert-warning">
          You need to{" "}
          <a href="#/" onClick={(e) => handle(e, handleLoginAgain)}>
            log in again
          </a>
        </div>
      )}

      {state.error && state.error !== "consent_required" && state.error !== "login_required" && (
        <div className="alert alert-danger">
          Error: {state.error}
        </div>
      )}

      <h1>External API</h1>
      <p>Ping an external API by clicking the button below.</p>

      <button className="btn" onClick={callApi} disabled={!audience}>
        Ping API
      </button>

      {state.showResult && (
        <div className="result-block">
          <h6>Result</h6>
          <Highlight>
            <span>{JSON.stringify(state.apiMessage, null, 2)}</span>
          </Highlight>
        </div>
      )}
    </div>
  );
};

export default withAuthenticationRequired(ExternalApiComponent, {
  onRedirecting: () => <Loading />,
});
