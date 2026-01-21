const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");
const { auth } = require("express-oauth2-jwt-bearer");

const authConfig = {
  domain: "identity-auth0.cic-demo-platform.auth0app.com",
  clientId: "7wnJfjn91fRLhs0CTzlCaMjPgUqXu7yv",
  audience: "https://identity-auth0.cic-demo-platform.auth0app.com/api/v2/",
  appOrigin: "https://ciamlab.onrender.com",
  apiOrigin: "https://ciamlab.onrender.com"
};

const app = express();

// Render imposta il PORT con la variabile d'ambiente
const PORT = process.env.PORT || 10000;
const appOrigin = authConfig.appOrigin || `https://ciamlab.onrender.com`;

if (!authConfig.domain || !authConfig.audience || authConfig.audience === "{API_IDENTIFIER}") {
  console.log(
    "Exiting: Please make sure that auth_config.json is in place and populated with valid domain and audience values"
  );
  process.exit();
}

app.use(morgan("dev"));
//app.use(helmet()); <-- Originale
//modifica
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          "https://identity-auth0.cic-demo-platform.auth0app.com"
        ],
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
const checkJwt = auth({
  audience: authConfig.audience,
  issuerBaseURL: `https://${authConfig.domain}/`,
  algorithms: ["RS256"],
});

// API protetta
app.get("/api/external", checkJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!"
  });
});

// Serve i file statici di React
app.use(express.static(path.join(__dirname, "build1")));

// Fallback per SPA: tutte le richieste non API vanno a index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build1", "index.html"));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
