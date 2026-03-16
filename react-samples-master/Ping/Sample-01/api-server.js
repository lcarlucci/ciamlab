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
