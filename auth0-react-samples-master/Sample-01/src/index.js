import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import * as serviceWorker from "./serviceWorker";
import { Auth0Provider } from "@auth0/auth0-react";
import { getConfig } from "./config";
import { BrowserRouter, useNavigate } from "react-router-dom";

// Wrapper per usare useNavigate() dentro Auth0Provider
const Auth0ProviderWithNavigate = ({ children, config }) => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    navigate(appState?.returnTo || "/");
  };

  return (
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        ...(config.audience ? { audience: config.audience } : null),
      }}
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  );
};

const config = getConfig();

const root = createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <Auth0ProviderWithNavigate config={config}>
      <App />
    </Auth0ProviderWithNavigate>
  </BrowserRouter>
);

// serviceWorker
serviceWorker.unregister();
