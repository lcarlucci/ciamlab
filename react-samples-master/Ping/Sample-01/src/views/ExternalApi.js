import React, { useState } from "react";
import { Button, Alert } from "reactstrap";
import Highlight from "../components/Highlight";
import { getConfig } from "../config";
import { useUnifiedAuth } from "../auth/AuthContext";

export const ExternalApiComponent = () => {
  const { apiOrigin = "https://ciamlab.onrender.com", auth0, pingone } = getConfig();
  const { provider, getAccessToken, loginWithAuth0, loginWithPingOne } = useUnifiedAuth();
  const activeAudience = provider === "pingone" ? pingone.audience : auth0.audience;

  const [state, setState] = useState({
    showResult: false,
    apiMessage: "",
    error: null,
  });

  const handleLoginAgain = async () => {
    if (provider === "pingone") {
      await loginWithPingOne();
      return;
    }
    await loginWithAuth0();
  };

  const callApi = async () => {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("Access token not available.");
    }

    const response = await fetch(`${apiOrigin}/api/external`, {
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
    <>
      <div className="mb-5">
        {state.error && (
          <Alert color="warning">
            Token missing or session expired.{" "}
            <a
              href="#/"
              className="alert-link"
              onClick={(e) => handle(e, handleLoginAgain)}
            >
              log in again
            </a>
          </Alert>
        )}

        <h1>External API</h1>
        <p className="lead">
          Ping an external API by clicking the button below.
        </p>

        <p>
          This will call a local API on port 3001 that would have been started
          if you run <code>npm run dev</code>. An access token is sent as part
          of the request's `Authorization` header and the API will validate it
          using the API's audience value.
        </p>

        {!activeAudience && (
          <Alert color="warning">
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

        <Button
          color="primary"
          className="mt-5"
          onClick={callApi}
          disabled={!activeAudience}
        >
          Ping API
        </Button>
      </div>

      <div className="result-block-container">
        {state.showResult && (
          <div className="result-block" data-testid="api-result">
            <h6 className="muted">Result</h6>
            <Highlight>
              <span>{JSON.stringify(state.apiMessage, null, 2)}</span>
            </Highlight>
          </div>
        )}
      </div>
    </>
  );
};

export default ExternalApiComponent;
