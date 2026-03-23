const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");
const { auth } = require("express-oauth2-jwt-bearer");
const authConfig = require("./src/auth_config.json");

const auth0Config = authConfig.auth0 || {};
const pingoneConfig = authConfig.pingone || {};

const auth0Issuer = auth0Config.domain
  ? `https://${auth0Config.domain}/`
  : null;
const pingoneIssuer = pingoneConfig.issuer || null;

const app = express();

// Render imposta il PORT con la variabile d'ambiente
const PORT = process.env.PORT || 10000;
const appOrigin = authConfig.appOrigin || "http://localhost:3000";
const apiOrigin = authConfig.apiOrigin || "http://localhost:3001";
const pingoneClientId =
  process.env.PINGONE_CLIENT_ID || pingoneConfig.clientId || null;
const pingoneClientSecret = process.env.PINGONE_CLIENT_SECRET || null;

if (
  (!auth0Issuer || !auth0Config.audience || auth0Config.audience === "{API_IDENTIFIER}") &&
  (!pingoneIssuer || !pingoneConfig.audience || pingoneConfig.audience === "{PINGONE_API_RESOURCE}")
) {
  console.log(
    "Exiting: Please make sure that auth_config.json has valid issuer and audience values for Auth0 or PingOne"
  );
  process.exit();
}

app.use(morgan("dev"));
app.use(express.json());
//app.use(helmet()); <-- Originale
//modifica
const safeOrigin = (url) => {
  try {
    return new URL(url).origin;
  } catch (err) {
    return null;
  }
};

const connectSrc = [
  "'self'",
  safeOrigin(auth0Issuer),
  safeOrigin(pingoneIssuer),
  `${apiOrigin}/*`,
].filter(Boolean);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc,
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://*.googleusercontent.com", "https://*.giphy.com", "https://trevonix.com"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      },
    },
  })
);
//modifica
app.use(cors({ origin: appOrigin }));

let pingoneWellKnown = null;
let pingoneWellKnownPromise = null;

const getPingOneWellKnown = async () => {
  if (!pingoneIssuer) {
    throw new Error("PingOne issuer missing in auth_config.json.");
  }
  if (pingoneWellKnown) return pingoneWellKnown;
  if (!pingoneWellKnownPromise) {
    const wellKnownUrl = pingoneIssuer.endsWith("/")
      ? `${pingoneIssuer}.well-known/openid-configuration`
      : `${pingoneIssuer}/.well-known/openid-configuration`;
    pingoneWellKnownPromise = fetch(wellKnownUrl)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `PingOne well-known fetch failed: ${res.status} ${text}`
          );
        }
        return res.json();
      })
      .then((json) => {
        pingoneWellKnown = json;
        return json;
      })
      .finally(() => {
        pingoneWellKnownPromise = null;
      });
  }
  return pingoneWellKnownPromise;
};

// Middleware per autenticazione JWT
const checks = [];

if (auth0Issuer && auth0Config.audience) {
  checks.push(
    auth({
      audience: auth0Config.audience,
      issuerBaseURL: auth0Issuer,
      algorithms: ["RS256"],
    })
  );
}

if (pingoneIssuer && pingoneConfig.audience) {
  checks.push(
    auth({
      audience: pingoneConfig.audience,
      issuerBaseURL: pingoneIssuer,
      algorithms: ["RS256"],
    })
  );
}

const checkJwt = (req, res, next) => {
  if (checks.length === 0) {
    return res.status(500).send({ msg: "JWT validation not configured." });
  }

  let index = 0;
  const run = (err) => {
    if (!err) return next();
    index += 1;
    if (index >= checks.length) return next(err);
    return checks[index](req, res, run);
  };

  return checks[0](req, res, run);
};

// Token exchange (PingOne confidential client)
app.post("/api/pingone/token", async (req, res) => {
  try {
    const { code, redirectUri, codeVerifier } = req.body || {};
    if (!code || !redirectUri) {
      return res.status(400).json({
        error: "Missing code or redirectUri.",
      });
    }
    if (!pingoneClientId || !pingoneClientSecret) {
      return res.status(500).json({
        error:
          "PingOne confidential client not configured. Set PINGONE_CLIENT_ID and PINGONE_CLIENT_SECRET.",
      });
    }

    const wellKnown = await getPingOneWellKnown();
    const tokenEndpoint = wellKnown?.token_endpoint;
    if (!tokenEndpoint) {
      return res.status(500).json({
        error: "PingOne token endpoint not available.",
      });
    }

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: pingoneClientId,
      client_secret: pingoneClientSecret,
    });
    if (codeVerifier) {
      body.set("code_verifier", codeVerifier);
    }

    const tokenRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const tokenText = await tokenRes.text();
    let tokenJson = null;
    try {
      tokenJson = JSON.parse(tokenText);
    } catch (err) {
      tokenJson = null;
    }
    if (!tokenRes.ok) {
      return res.status(tokenRes.status).json({
        error:
          tokenJson?.error_description ||
          tokenJson?.error ||
          "Token exchange failed.",
        details: tokenJson || tokenText,
      });
    }
    res.set("Cache-Control", "no-store");
    return res.json({ tokens: tokenJson });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Token exchange failed.",
    });
  }
});

// API protetta
app.get("/api/external", checkJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!"
  });
});

// Serve i file statici di React
app.use(express.static(path.join(__dirname, "build")));

// Fallback per SPA: tutte le richieste non API vanno a index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
