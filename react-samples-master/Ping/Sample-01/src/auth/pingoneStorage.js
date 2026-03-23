const buildKey = (clientId, suffix) =>
  `pingone_${suffix}_${clientId || "default"}`;

const readJson = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
};

const writeJson = (key, value) => {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // ignore storage errors
  }
};

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + "=".repeat(padLength);
    const atobFn =
      typeof window !== "undefined" && typeof window.atob === "function"
        ? window.atob
        : null;
    if (!atobFn) return null;
    const json = atobFn(padded);
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
};

export const readPingTokens = (clientId) =>
  readJson(buildKey(clientId, "tokens"));

export const writePingTokens = (clientId, tokens) =>
  writeJson(buildKey(clientId, "tokens"), tokens);

export const readPingUser = (clientId) =>
  readJson(buildKey(clientId, "user"));

export const writePingUser = (clientId, user) =>
  writeJson(buildKey(clientId, "user"), user);

export const clearPingSession = (clientId) => {
  writeJson(buildKey(clientId, "tokens"), null);
  writeJson(buildKey(clientId, "user"), null);
};

export const buildUserFromTokens = (tokens) => {
  if (!tokens) return null;
  const idToken =
    tokens?.id_token ||
    tokens?.idToken?.idToken ||
    tokens?.idToken?.value ||
    tokens?.idToken ||
    null;
  return decodeJwtPayload(idToken);
};
