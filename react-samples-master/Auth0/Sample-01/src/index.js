import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { Auth0Provider } from "@auth0/auth0-react";
import { getConfig } from "./config";

const config = getConfig();

const root = createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      audience={config.audience}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: config.audience,
        scope: "openid profile email offline_access",
      }}
      cacheLocation="localstorage"      // Mantiene la sessione anche su refresh
      useRefreshTokens={true}           // Rinnova automaticamente i token
      onRedirectCallback={() => {
        // Dopo il login, vai sempre su /home
        window.location.replace("/home");
      }}
    >
      <App />
    </Auth0Provider>
  </BrowserRouter>
);
