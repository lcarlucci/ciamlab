import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { Auth0Provider } from "@auth0/auth0-react";
import { getConfig } from "./config";
import { AuthProvider } from "./auth/AuthContext";

const config = getConfig();
const auth0Config = config.auth0;

const root = createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      audience={auth0Config.audience || undefined}
      authorizationParams={{ redirect_uri: auth0Config.redirectUri }}
      cacheLocation="localstorage"
      useRefreshTokens={false}
      onRedirectCallback={(appState) => {
        window.localStorage.setItem("active_provider", "auth0");
        window.location.replace(appState?.returnTo || "/home");
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </Auth0Provider>
  </BrowserRouter>
);
