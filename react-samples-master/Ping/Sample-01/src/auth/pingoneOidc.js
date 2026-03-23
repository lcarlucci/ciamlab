const wellKnownCache = new Map();

const base64UrlEncode = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const randomBytes = (length) => {
  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error("Web Crypto is not available in this browser.");
  }
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bytes;
};

export const createCodeVerifier = () => base64UrlEncode(randomBytes(64));
export const createState = () => base64UrlEncode(randomBytes(16));
export const createNonce = () => base64UrlEncode(randomBytes(16));

export const createCodeChallenge = async (verifier) => {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error("Web Crypto subtle is not available in this browser.");
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await window.crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(hash);
};

export const fetchWellKnown = async (wellKnownUrl) => {
  if (!wellKnownUrl) {
    throw new Error("Missing PingOne well-known URL.");
  }
  if (wellKnownCache.has(wellKnownUrl)) {
    return wellKnownCache.get(wellKnownUrl);
  }
  const res = await fetch(wellKnownUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch PingOne well-known: ${res.status} ${text}`
    );
  }
  const json = await res.json();
  wellKnownCache.set(wellKnownUrl, json);
  return json;
};

const storageKey = (clientId) => `pingone_oidc_tx_${clientId || "default"}`;

export const saveAuthTransaction = (clientId, data) => {
  try {
    window.sessionStorage.setItem(
      storageKey(clientId),
      JSON.stringify(data)
    );
  } catch (err) {
    // ignore
  }
};

export const loadAuthTransaction = (clientId) => {
  try {
    const raw = window.sessionStorage.getItem(storageKey(clientId));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
};

export const clearAuthTransaction = (clientId) => {
  try {
    window.sessionStorage.removeItem(storageKey(clientId));
  } catch (err) {
    // ignore
  }
};
