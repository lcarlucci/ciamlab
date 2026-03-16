import configJson from "./auth_config.json";

const sanitize = (value) => {
  if (!value) return null;
  return value.startsWith("{") ? null : value;
};

export function getConfig() {
  const auth0 = {
    domain: sanitize(configJson.auth0?.domain),
    clientId: sanitize(configJson.auth0?.clientId),
    audience: sanitize(configJson.auth0?.audience),
    redirectUri:
      configJson.auth0?.redirectUri ||
      `${window.location.origin}/callback/auth0`,
    postLogoutRedirectUri:
      configJson.auth0?.postLogoutRedirectUri || window.location.origin,
    scope: configJson.auth0?.scope || "openid profile email",
  };

  const pingone = {
    issuer: sanitize(configJson.pingone?.issuer),
    clientId: sanitize(configJson.pingone?.clientId),
    audience: sanitize(configJson.pingone?.audience),
    redirectUri:
      configJson.pingone?.redirectUri ||
      `${window.location.origin}/callback/pingone`,
    postLogoutRedirectUri:
      configJson.pingone?.postLogoutRedirectUri || window.location.origin,
    scope: configJson.pingone?.scope || "openid profile email",
  };

  return {
    appOrigin: configJson.appOrigin || window.location.origin,
    apiOrigin: configJson.apiOrigin || window.location.origin,
    auth0,
    pingone,
  };
}
