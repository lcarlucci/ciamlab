import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { Auth0Provider } from "@auth0/auth0-react";
import { getConfig } from "./config";

// Config Auth0
const config = getConfig();

const root = createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      authorizationParams={{ redirect_uri: window.location.origin }}
      onRedirectCallback={(appState) => {
        window.location.replace(appState?.returnTo || "/");
      }}
    >
      <App />
    </Auth0Provider>
  </BrowserRouter>
);
