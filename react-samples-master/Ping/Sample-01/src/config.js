import configJson from "./auth_config.json";

const sanitize = (value) => {
  if (!value) return null;
  return value.startsWith("{") ? null : value;
};

const toWellKnown = (issuer) => {
  if (!issuer) return null;
  const trimmed = issuer.endsWith("/") ? issuer.slice(0, -1) : issuer;
  return `${trimmed}/.well-known/openid-configuration`;
};

const resolveSameOriginUrl = (value, fallbackPath) => {
  const origin = window.location.origin;
  if (!value) return `${origin}${fallbackPath}`;
  try {
    const url = new URL(value);
    if (url.origin !== origin) {
      return `${origin}${fallbackPath}`;
    }
    return value;
  } catch (err) {
    return `${origin}${fallbackPath}`;
  }
};

export function getConfig() {
  const auth0 = {
    domain: sanitize(configJson.auth0?.domain),
    clientId: sanitize(configJson.auth0?.clientId),
    audience: sanitize(configJson.auth0?.audience),
    redirectUri: resolveSameOriginUrl(
      configJson.auth0?.redirectUri,
      "/callback/auth0"
    ),
    postLogoutRedirectUri: resolveSameOriginUrl(
      configJson.auth0?.postLogoutRedirectUri,
      "/"
    ),
    scope: configJson.auth0?.scope || "openid profile email",
  };

  const pingoneIssuer = sanitize(configJson.pingone?.issuer);
  const pingone = {
    issuer: pingoneIssuer,
    wellKnown: toWellKnown(pingoneIssuer),
    clientId: sanitize(configJson.pingone?.clientId),
    audience: sanitize(configJson.pingone?.audience),
    flowId: sanitize(configJson.pingone?.flowId),
    redirectUri: resolveSameOriginUrl(
      configJson.pingone?.redirectUri,
      "/callback/pingone"
    ),
    postLogoutRedirectUri: resolveSameOriginUrl(
      configJson.pingone?.postLogoutRedirectUri,
      "/"
    ),
    scope: configJson.pingone?.scope || "openid profile email",
  };

  return {
    appOrigin: configJson.appOrigin || window.location.origin,
    apiOrigin: configJson.apiOrigin || window.location.origin,
    auth0,
    pingone,
  };
}
