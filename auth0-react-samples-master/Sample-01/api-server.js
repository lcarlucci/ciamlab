const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const { auth } = require("express-oauth2-jwt-bearer");

const authConfig = {
  "domain": "identity-auth0.cic-demo-platform.auth0app.com",
  "clientId": "7wnJfjn91fRLhs0CTzlCaMjPgUqXu7yv",
  "audience": "https://identity-auth0.cic-demo-platform.auth0app.com/api/v2/",
  "appOrigin": "https://ciamlab.onrender.com:3000",
  "apiOrigin": "https://ciamlab.onrender.com:3001"
}


const app = express();

const port = process.env.API_PORT || 3001;
const appPort = process.env.SERVER_PORT || 3000;
const appOrigin = authConfig.appOrigin || `https://ciamlab.onrender.com:${appPort}`;

if (
  !authConfig.domain ||
  !authConfig.audience ||
  authConfig.audience === "{API_IDENTIFIER}"
) {
  console.log(
    "Exiting: Please make sure that auth_config.json is in place and populated with valid domain and audience values"
  );

  process.exit();
}

app.use(morgan("dev"));
app.use(helmet());
app.use(cors({ origin: appOrigin }));

const checkJwt = auth({
  audience: authConfig.audience,
  issuerBaseURL: `https://${authConfig.domain}/`,
  algorithms: ["RS256"],
});

app.get("/api/external", checkJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!",
  });
});

app.listen(port, () => console.log(`API Server listening on port ${port}`));
