const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");
const { auth } = require("express-oauth2-jwt-bearer");

const authConfig = {
  domain: "identity-auth0.cic-demo-platform.auth0app.com",
  clientId: "Iwab1kMZj0fPOTZnWwtt5KI5yTBTOrLV",
  audience: "https://ciamlab.onrender.com/audience",
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
app.use(express.json());
//app.use(helmet()); <-- Originale
//modifica
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: [
          "'self'",
          "https://identity-auth0.cic-demo-platform.auth0app.com",
          "https://ciamlab.onrender.com/*"
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

async function getManagementApiToken() {
  const clientId = process.env.AUTH0_MGMT_CLIENT_ID;
  const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET;
  const audience = process.env.AUTH0_MGMT_AUDIENCE || `https://${authConfig.domain}/api/v2/`;

  if (!clientId || !clientSecret) {
    throw new Error("Missing AUTH0_MGMT_CLIENT_ID or AUTH0_MGMT_CLIENT_SECRET.");
  }

  const response = await fetch(`https://${authConfig.domain}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error_description || "Failed to obtain Management API token.");
  }

  return data.access_token;
}

app.patch("/api/user/phone", checkJwt, async (req, res) => {
  const phoneNumber = (req.body?.phoneNumber || "").trim();
  const userId = req.auth?.payload?.sub;

  if (!userId) {
    return res.status(400).json({ message: "User id non disponibile." });
  }

  if (!phoneNumber) {
    return res.status(400).json({ message: "phoneNumber � obbligatorio." });
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const response = await fetch(`https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${mgmtToken}`,
      },
      body: JSON.stringify({
        user_metadata: {
          phone_number: phoneNumber,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.message || "Errore durante l'aggiornamento del numero di telefono.",
      });
    }

    return res.json({
      message: "Numero di telefono aggiornato.",
      phoneNumber: data?.user_metadata?.phone_number || phoneNumber,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Errore server." });
  }
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
