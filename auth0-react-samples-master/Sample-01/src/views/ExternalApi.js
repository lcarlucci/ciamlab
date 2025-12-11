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
    try {
      await getAccessTokenWithPopup();
      setState({ ...state, error: null });
    } catch (error) {
      setState({ ...state, error: error.error });
    }
    await callApi();
  };

  const handleLoginAgain = async () => {
    try {
      await loginWithPopup();
      setState({ ...state, error: null });
    } catch (error) {
      setState({ ...state, error: error.error });
    }
    await callApi();
  };

const callApi = async () => {
  console.log("callApi fired");

  try {
    const token = await getAccessTokenSilently();

    const response = await fetch(`${apiOrigin}/api/external?cacheBust=${Date.now()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("Status:", response.status);

    if (response.status === 304) {
      console.warn("La risposta è 304 (Not Modified) e non contiene JSON.");
      return;
    }

    const responseData = await response.json();

    setState({
      ...state,
      showResult: true,
      apiMessage: responseData
    });

  } catch (error) {
    console.error("Error in callApi:", error);
    setState({ ...state, error: error.message });
  }
};


  const handle = (e, fn) => { e.preventDefault(); fn(); };

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
