import configJson from "./auth_config.json";

export function getConfig() {
  const audience = "https://ciamlab.onrender.com/api";

  return {
    domain: configJson.domain,
    clientId: configJson.clientId,
    ...(audience ? { audience } : null),
    apiOrigin: configJson.apiOrigin,
  };
}
