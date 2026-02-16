const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");
const { auth } = require("express-oauth2-jwt-bearer");

// ----------------------------
// Auth0 configuration
// ----------------------------
const authConfig = {
  domain: "identity-auth0.cic-demo-platform.auth0app.com",
  clientId: "Iwab1kMZj0fPOTZnWwtt5KI5yTBTOrLV",
  audience: "https://ciamlab.onrender.com/api",
  appOrigin: "https://ciamlab.onrender.com",
  apiOrigin: "https://ciamlab.onrender.com"
};

// ----------------------------
// App setup
// ----------------------------
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
        imgSrc: [
          "'self'",
          "data:",
          "https://*.googleusercontent.com",
          "https://*.giphy.com",
          "https://trevonix.com",
          "https://s.gravatar.com",
          "https://*.gravatar.com",
          "https://cdn.auth0.com"
        ],
        styleSrc: ["'self'", "'unsafe-inline'"]
      },
    },
  })
);
//modifica
app.use(cors({ origin: appOrigin }));

// ----------------------------
// JWT middleware
// ----------------------------
const checkApiJwt = auth({
  audience: authConfig.audience,
  issuerBaseURL: `https://${authConfig.domain}/`,
  algorithms: ["RS256"],
});

const checkMfaJwt = auth({
  audience: `https://${authConfig.domain}/mfa/`,
  issuerBaseURL: `https://${authConfig.domain}/`,
  algorithms: ["RS256"],
});

// ----------------------------
// Auth0 Management helpers
// ----------------------------
async function getManagementApiToken() {
  const clientId = process.env.AUTH0_MGMT_CLIENT_ID;
  const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET;
  const audience = process.env.AUTH0_MGMT_AUDIENCE || `https://${authConfig.domain}/api/v2/`;

  if (!clientId || !clientSecret) {
    console.error("Missing Auth0 Management API credentials", {
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      audience,
    });
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
    console.error("Failed to obtain Management API token", {
      status: response.status,
      error: data?.error,
      error_description: data?.error_description,
    });
    throw new Error(data?.error_description || "Failed to obtain Management API token.");
  }

  return data.access_token;
}

// ----------------------------
// Profile + metadata
// ----------------------------
app.patch("/api/user/phone", checkApiJwt, async (req, res) => {
  const phoneNumber = (req.body?.phoneNumber || "").trim();
  const userId = req.auth?.payload?.sub;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  if (!phoneNumber) {
    return res.status(400).json({ message: "phoneNumber is required." });
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
        message: data?.message || "Error while updating phone number.",
      });
    }

    return res.json({
      message: "Phone number updated.",
      phoneNumber: data?.user_metadata?.phone_number || phoneNumber,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

// ----------------------------
// Validation constants
// ----------------------------
const ALLOWED_USER_METADATA_FIELDS = new Set([
  "name",
  "given_name",
  "family_name",
  "email",
  "phone_number",
  "birthdate",
  "zoneinfo",
  "company",
]);

const PAYMENT_METHODS = new Set(["card", "paypal", "gpay", "applepay", "invoice"]);
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[+]?[\d\s().-]{6,}$/;
const vatRegex = /^(IT)?\d{11}$/i;
const sdiRegex = /^[A-Za-z0-9]{7}$/;
const ROOT_PHONE_PROVIDERS = new Set(["auth0", "sms"]);

// ----------------------------
// Role helpers
// ----------------------------
function getRolesFromPayload(payload) {
  if (!payload) return [];
  const roles = [];
  Object.entries(payload).forEach(([key, value]) => {
    if (!key.toLowerCase().includes("roles")) return;
    if (Array.isArray(value)) {
      roles.push(...value);
    }
  });
  return roles;
}

function isAdminPayload(payload) {
  const roles = getRolesFromPayload(payload);
  return roles.some((role) => {
    const normalized = String(role || "").toLowerCase();
    return normalized === "administrator" || normalized === "administator";
  });
}

async function hasAdminRoleForUser(userId) {
  if (!userId) return false;
  const mgmtToken = await getManagementApiToken();
  const response = await fetch(
    `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}/roles`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${mgmtToken}`,
      },
    }
  );
  const data = await response.json().catch(() => ([]));
  if (!response.ok) {
    return false;
  }
  const roles = Array.isArray(data) ? data.map((role) => role.name).filter(Boolean) : [];
  return isAdminPayload({ roles });
}

// ----------------------------
// Order validation
// ----------------------------
function validateOrder(order) {
  const errors = {};
  const billing = order.billing || {};
  const payment = order.payment || {};

  if (!billing.fullName) errors.fullName = "Full name is required.";
  if (!emailRegex.test(billing.email || "")) errors.email = "Valid email is required.";
  if (!billing.company) errors.company = "Company is required.";
  if (!phoneRegex.test(billing.phone || "")) errors.phone = "Valid phone is required.";
  if (!billing.address) errors.address = "Billing address is required.";
  if (!billing.city) errors.city = "City is required.";
  if (!billing.country) errors.country = "Country is required.";
  if (!billing.vat) errors.vat = "VAT / Tax ID is required.";

  if (!PAYMENT_METHODS.has(payment.method)) {
    errors.paymentMethod = "Invalid payment method.";
  }

  if (payment.method === "card") {
    const card = payment.card || {};
    if (!card.number) errors.cardNumber = "Card number is required.";
    if (!card.expiry) errors.cardExpiry = "Expiry is required.";
    if (!card.cvv) errors.cardCvv = "CVV is required.";
    if (!card.holder) errors.cardHolder = "Cardholder name is required.";
  }

  if (payment.method === "invoice") {
    const inv = payment.invoice || {};
    if (!emailRegex.test(inv.pecEmail || "")) errors.pecEmail = "Valid PEC email is required.";
    if (!sdiRegex.test(inv.sdiCode || "")) errors.sdiCode = "SDI code must be 7 characters.";
    if (!vatRegex.test(inv.vatNumber || "")) errors.vatNumber = "Valid VAT number is required.";
    if (!emailRegex.test(inv.billingContact || "")) errors.billingContact = "Valid billing contact email is required.";
  }

  return errors;
}

// ----------------------------
// Profile endpoints
// ----------------------------
app.patch("/api/user/profile", checkApiJwt, async (req, res) => {
  const field = (req.body?.field || "").trim();
  const valueRaw = req.body?.value ?? "";
  const userId = req.auth?.payload?.sub;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  if (!field || !ALLOWED_USER_METADATA_FIELDS.has(field)) {
    return res.status(400).json({ message: "Invalid field." });
  }

  const value = typeof valueRaw === "string" ? valueRaw.trim() : valueRaw;
  const updateValue = value === "" ? null : value;

  try {
    const mgmtToken = await getManagementApiToken();
    const provider = String(userId || "").split("|")[0];
    const isRootPhoneProvider = ROOT_PHONE_PROVIDERS.has(provider);
    const payload =
      field === "phone_number"
        ? isRootPhoneProvider
          ? { phone_number: updateValue, phone_verified: false }
          : { user_metadata: { [field]: updateValue, phone_verified: false } }
        : { user_metadata: { [field]: updateValue } };
    const response = await fetch(`https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${mgmtToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.message || "Error while updating profile.",
      });
    }

    return res.json({
      message: "Profile updated.",
      field,
      value: data?.user_metadata?.[field] ?? updateValue,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

app.post("/api/orders", checkApiJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;
  const order = req.body?.order;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  if (!order) {
    return res.status(400).json({ message: "Order payload is required." });
  }

  const errors = validateOrder(order);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Validation error.", errors });
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const existingResponse = await fetch(
      `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}?fields=user_metadata&include_fields=true`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${mgmtToken}`,
        },
      }
    );

    const existingData = await existingResponse.json().catch(() => ({}));
    if (!existingResponse.ok) {
      return res.status(existingResponse.status).json({
        message: existingData?.message || "Error while reading user metadata.",
      });
    }

    const existingOrders = existingData?.user_metadata?.orders || [];
    const normalizedOrder = {
      ...order,
      id: order.id || `ord_${Date.now()}`,
      createdAt: order.createdAt || new Date().toISOString(),
      status: order.status || "Paid",
    };

    const response = await fetch(`https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${mgmtToken}`,
      },
      body: JSON.stringify({
        user_metadata: {
          orders: [...existingOrders, normalizedOrder],
        },
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.message || "Error while saving order.",
      });
    }

    return res.json({
      message: "Order saved.",
      order: normalizedOrder,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

// ----------------------------
// User orders (self + admin)
// ----------------------------
app.patch("/api/orders/:orderId", checkApiJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;
  const orderId = req.params.orderId;
  const order = req.body?.order;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  const isAdmin = isAdminPayload(req.auth?.payload) || (await hasAdminRoleForUser(userId));
  if (!isAdmin) {
    return res.status(403).json({ message: "Admin role required." });
  }

  if (!order) {
    return res.status(400).json({ message: "Order payload is required." });
  }

  const errors = validateOrder(order);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Validation error.", errors });
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const existingResponse = await fetch(
      `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}?fields=user_metadata&include_fields=true`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${mgmtToken}`,
        },
      }
    );

    const existingData = await existingResponse.json().catch(() => ({}));
    if (!existingResponse.ok) {
      return res.status(existingResponse.status).json({
        message: existingData?.message || "Error while reading user metadata.",
      });
    }

    const existingOrders = existingData?.user_metadata?.orders || [];
    const existingOrder = existingOrders.find((item) => item.id === orderId);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    const normalizedOrder = {
      ...order,
      id: orderId,
      createdAt: order.createdAt || existingOrder.createdAt || new Date().toISOString(),
      status: order.status || existingOrder.status || "Paid",
    };

    const updatedOrders = existingOrders.map((item) =>
      item.id === orderId ? normalizedOrder : item
    );

    const response = await fetch(`https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${mgmtToken}`,
      },
      body: JSON.stringify({
        user_metadata: {
          orders: updatedOrders,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.message || "Error while updating order.",
      });
    }

    return res.json({
      message: "Order updated.",
      order: normalizedOrder,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

app.delete("/api/orders/:orderId", checkApiJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;
  const orderId = req.params.orderId;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  const isAdmin = isAdminPayload(req.auth?.payload) || (await hasAdminRoleForUser(userId));
  if (!isAdmin) {
    return res.status(403).json({ message: "Admin role required." });
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const existingResponse = await fetch(
      `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}?fields=user_metadata&include_fields=true`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${mgmtToken}`,
        },
      }
    );

    const existingData = await existingResponse.json().catch(() => ({}));
    if (!existingResponse.ok) {
      return res.status(existingResponse.status).json({
        message: existingData?.message || "Error while reading user metadata.",
      });
    }

    const existingOrders = existingData?.user_metadata?.orders || [];
    const updatedOrders = existingOrders.filter((item) => item.id !== orderId);

    if (updatedOrders.length === existingOrders.length) {
      return res.status(404).json({ message: "Order not found." });
    }

    const response = await fetch(`https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${mgmtToken}`,
      },
      body: JSON.stringify({
        user_metadata: {
          orders: updatedOrders,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.message || "Error while deleting order.",
      });
    }

    return res.json({ message: "Order deleted." });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

// ----------------------------
// User data
// ----------------------------
app.get("/api/user/profile", checkApiJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const response = await fetch(
      `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${mgmtToken}`,
        },
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.message || "Error while fetching profile metadata.",
      });
    }

    const provider = String(userId || "").split("|")[0];
    const isRootPhoneProvider = ROOT_PHONE_PROVIDERS.has(provider);
    const metadata = data?.user_metadata || {};

    if (!isRootPhoneProvider) {
      const metadataPatch = {};
      const rootValues = {
        name: data?.name,
        given_name: data?.given_name,
        family_name: data?.family_name,
        email: data?.email,
        phone_number: data?.phone_number,
        birthdate: data?.birthdate,
        zoneinfo: data?.zoneinfo,
      };

      ALLOWED_USER_METADATA_FIELDS.forEach((field) => {
        if (!rootValues[field]) return;
        if (metadata[field] !== undefined && metadata[field] !== null && metadata[field] !== "") {
          return;
        }
        metadataPatch[field] = rootValues[field];
      });

      if (Object.keys(metadataPatch).length > 0) {
        try {
          await fetch(
            `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}`,
            {
              method: "PATCH",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${mgmtToken}`,
              },
              body: JSON.stringify({
                user_metadata: metadataPatch,
              }),
            }
          );
          Object.assign(metadata, metadataPatch);
        } catch {
          // Best effort: do not block profile response if sync fails.
        }
      }
    }

    const resolvedPhoneNumber = isRootPhoneProvider
      ? data?.phone_number || metadata.phone_number || ""
      : metadata.phone_number || data?.phone_number || "";
    const resolvedPhoneVerified = isRootPhoneProvider
      ? Boolean(data?.phone_verified) || Boolean(metadata.phone_verified)
      : Boolean(metadata.phone_verified) || Boolean(data?.phone_verified);

    return res.json({
      user_metadata: metadata,
      phone_number: resolvedPhoneNumber,
      phone_verified: resolvedPhoneVerified,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

app.get("/api/user/roles", checkApiJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;

  if (!userId) {
    console.error("GET /api/user/roles missing userId", {
      authPayload: req.auth?.payload,
    });
    return res.status(400).json({ message: "User id not available." });
  }

  try {
    console.log("GET /api/user/roles start", { userId });
    const mgmtToken = await getManagementApiToken();
    console.log("GET /api/user/roles got mgmt token");
    const response = await fetch(
      `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}/roles`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${mgmtToken}`,
        },
      }
    );

    const data = await response.json().catch(() => ([]));

    if (!response.ok) {
      const requestId =
        response.headers.get("x-auth0-requestid") ||
        response.headers.get("x-request-id") ||
        response.headers.get("x-amzn-requestid");
      console.error("GET /api/user/roles failed", {
        status: response.status,
        message: data?.message,
        error: data?.error,
        requestId,
      });
      return res.status(response.status).json({
        message: data?.message || "Error while fetching user roles.",
        details: {
          status: response.status,
          error: data?.error,
          error_description: data?.error_description,
          requestId,
        },
      });
    }

    const roles = Array.isArray(data) ? data.map((role) => role.name).filter(Boolean) : [];
    console.log("GET /api/user/roles success", { userId, rolesCount: roles.length });
    return res.json({ roles });
  } catch (error) {
    console.error("GET /api/user/roles exception", {
      message: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});


// ----------------------------
// Admin overview
// ----------------------------
app.get("/api/admin/overview", checkApiJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  const isAdmin = isAdminPayload(req.auth?.payload) || (await hasAdminRoleForUser(userId));
  if (!isAdmin) {
    return res.status(403).json({ message: "Admin role required." });
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const response = await fetch(
      `https://${authConfig.domain}/api/v2/users?fields=user_id,name,email,picture,user_metadata&include_fields=true&per_page=50&page=0`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${mgmtToken}`,
        },
      }
    );

    const data = await response.json().catch(() => ([]));
    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.message || "Error while fetching users.",
      });
    }

    const users = Array.isArray(data)
      ? data.map((user) => ({
          id: user.user_id,
          name: user.name || "",
          email: user.email || "",
          picture: user.picture || "",
          metadata: user.user_metadata || {},
          orders: user.user_metadata?.orders || [],
        }))
      : [];

    const orders = users.flatMap((user) =>
      (user.orders || []).map((order) => ({
        ...order,
        userId: user.id,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          picture: user.picture,
        },
      }))
    );

    orders.sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    const totals = {
      users: users.length,
      orders: orders.length,
      revenue: orders.reduce((sum, order) => sum + Number(order.totals?.subtotal || 0), 0),
    };

    return res.json({ totals, users, orders });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

// ----------------------------
// MFA endpoints
// ----------------------------
const getBearerToken = (req) => {
  const header = String(req.headers?.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
};

const normalizeAuthenticators = (authenticators) => {
  if (Array.isArray(authenticators)) return authenticators;
  if (Array.isArray(authenticators?.authenticators)) return authenticators.authenticators;
  return [];
};

const findGuardianAuthenticator = (authenticators) => {
  const items = normalizeAuthenticators(authenticators);
  return (
    items.find((authenticator) => {
      if (!authenticator) return false;
      const channel = String(
        authenticator.oob_channel || authenticator.channel || ""
      ).toLowerCase();
      const type = String(
        authenticator.authenticator_type || authenticator.type || ""
      ).toLowerCase();
      if (channel.includes("push")) {
        return type === "oob" || type === "guardian" || type.includes("push");
      }
      return type === "guardian";
    }) || null
  );
};

app.post("/api/mfa/guardian/challenge", checkMfaJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;
  const bodyToken = (req.body?.mfaToken || "").trim();
  const mfaToken = bodyToken || getBearerToken(req);

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  if (!mfaToken) {
    return res.status(400).json({ message: "MFA token is required." });
  }

  try {
    const listResponse = await fetch(`https://${authConfig.domain}/mfa/authenticators`, {
      headers: {
        authorization: `Bearer ${mfaToken}`,
      },
    });
    const listData = await listResponse.json().catch(() => ([]));
    if (!listResponse.ok) {
      return res.status(listResponse.status).json({
        message: "Unable to load MFA authenticators.",
        details: listData,
      });
    }

    const guardianAuth = findGuardianAuthenticator(listData);
    if (!guardianAuth) {
      const debugItems = normalizeAuthenticators(listData).map((authenticator) => ({
        id: authenticator?.id,
        type: authenticator?.authenticator_type || authenticator?.type,
        channel: authenticator?.oob_channel || authenticator?.channel,
        name: authenticator?.name,
      }));
      console.error("Guardian not enrolled", {
        userId,
        authenticators: debugItems,
      });
      return res.status(409).json({
        message: "Auth0 Guardian is not enrolled.",
        code: "GUARDIAN_NOT_ENROLLED",
      });
    }

    const challengeResponse = await fetch(`https://${authConfig.domain}/mfa/challenge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${mfaToken}`,
      },
      body: JSON.stringify({
        client_id: authConfig.clientId,
        challenge_type: "oob",
        authenticator_id: guardianAuth.id,
      }),
    });

    const challengeData = await challengeResponse.json().catch(() => ({}));
    if (!challengeResponse.ok) {
      const requestId =
        challengeResponse.headers.get("x-auth0-requestid") ||
        challengeResponse.headers.get("x-request-id") ||
        challengeResponse.headers.get("x-amzn-requestid");
      console.error("Guardian challenge failed", {
        status: challengeResponse.status,
        error: challengeData?.error,
        error_description: challengeData?.error_description,
        requestId,
      });
      return res.status(challengeResponse.status).json({
        message:
          challengeData?.error_description ||
          challengeData?.message ||
          "Unable to start Guardian challenge.",
        details: {
          status: challengeResponse.status,
          error: challengeData?.error,
          error_description: challengeData?.error_description,
          requestId,
        },
      });
    }

    return res.json({
      oobCode: challengeData?.oob_code,
      authenticatorId: guardianAuth.id,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

app.get("/api/mfa/guardian/authenticators", checkMfaJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;
  const mfaToken = getBearerToken(req);

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  if (!mfaToken) {
    return res.status(400).json({ message: "MFA token is required." });
  }

  try {
    const listResponse = await fetch(`https://${authConfig.domain}/mfa/authenticators`, {
      headers: {
        authorization: `Bearer ${mfaToken}`,
      },
    });
    const listData = await listResponse.json().catch(() => ([]));
    if (!listResponse.ok) {
      return res.status(listResponse.status).json({
        message: "Unable to load MFA authenticators.",
        details: listData,
      });
    }

    const items = normalizeAuthenticators(listData).map((authenticator) => ({
      id: authenticator?.id,
      type: authenticator?.authenticator_type || authenticator?.type,
      channel: authenticator?.oob_channel || authenticator?.channel,
      name: authenticator?.name,
    }));

    return res.json({ authenticators: items, raw: listData });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

app.post("/api/mfa/guardian/verify", checkMfaJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;
  const bodyToken = (req.body?.mfaToken || "").trim();
  const mfaToken = bodyToken || getBearerToken(req);
  const oobCode = (req.body?.oobCode || "").trim();
  const authenticatorId = (req.body?.authenticatorId || "").trim();
  const phoneNumber = (req.body?.phoneNumber || "").trim();
  const updatePhone = req.body?.updatePhone !== false;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  if (!mfaToken || !oobCode) {
    return res.status(400).json({ message: "MFA verification data is required." });
  }

  if (updatePhone && !phoneNumber) {
    return res.status(400).json({ message: "phoneNumber is required." });
  }

  try {
    const params = new URLSearchParams();
    params.set("grant_type", "http://auth0.com/oauth/grant-type/mfa-oob");
    params.set("client_id", authConfig.clientId);
    if (process.env.AUTH0_CLIENT_SECRET) {
      params.set("client_secret", process.env.AUTH0_CLIENT_SECRET);
    }
    params.set("mfa_token", mfaToken);
    params.set("oob_code", oobCode);

    const response = await fetch(`https://${authConfig.domain}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const requestId =
        response.headers.get("x-auth0-requestid") ||
        response.headers.get("x-request-id") ||
        response.headers.get("x-amzn-requestid");
      const description = String(data?.error_description || data?.message || "");
      if (data?.error === "authorization_pending") {
        return res.status(409).json({
          message: "Approve the push notification in Auth0 Guardian and retry.",
          code: "AUTH_PENDING",
          details: {
            status: response.status,
            error: data?.error,
            error_description: data?.error_description,
            requestId,
          },
        });
      }
      console.error("Guardian verify failed", {
        status: response.status,
        error: data?.error,
        error_description: data?.error_description,
        requestId,
      });
      return res.status(response.status).json({
        message: description || "Guardian verification failed.",
        details: {
          status: response.status,
          error: data?.error,
          error_description: data?.error_description,
          requestId,
        },
      });
    }

    if (updatePhone) {
      const provider = String(userId || "").split("|")[0];
      const isRootPhoneProvider = ROOT_PHONE_PROVIDERS.has(provider);
      const mgmtToken = await getManagementApiToken();
      const rootPayload = {
        phone_number: phoneNumber,
        phone_verified: true,
      };
      const metadataPayload = {
        user_metadata: {
          phone_number: phoneNumber,
          phone_verified: true,
        },
      };

      const updateRootPhone = async () =>
        fetch(`https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${mgmtToken}`,
          },
          body: JSON.stringify(rootPayload),
        });

      const updateMetadataPhone = async () =>
        fetch(`https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${mgmtToken}`,
          },
          body: JSON.stringify(metadataPayload),
        });

      let updateResponse = isRootPhoneProvider
        ? await updateRootPhone()
        : await updateMetadataPhone();
      let updateData = await updateResponse.json().catch(() => ({}));

      if (!updateResponse.ok) {
        const description = String(updateData?.message || updateData?.error_description || "");
        const isDuplicatePhone =
          description.toLowerCase().includes("phone_number already exists") ||
          description.toLowerCase().includes("phone_number already exist");

        if (isRootPhoneProvider && isDuplicatePhone) {
          if (mfaToken && authenticatorId) {
            try {
              await fetch(
                `https://${authConfig.domain}/mfa/authenticators/${encodeURIComponent(
                  authenticatorId
                )}`,
                {
                  method: "DELETE",
                  headers: {
                    authorization: `Bearer ${mfaToken}`,
                  },
                }
              );
            } catch {
              // Best effort: do not block error response if cleanup fails.
            }
          }
          return res.status(409).json({
            message:
              "Numero di telefono gia in uso per un altro account. Non e possibile utilizzare lo stesso numero.",
            code: "PHONE_IN_USE",
          });
        }

        const requestId =
          updateResponse.headers.get("x-auth0-requestid") ||
          updateResponse.headers.get("x-request-id") ||
          updateResponse.headers.get("x-amzn-requestid");
        console.error("Phone update failed", {
          status: updateResponse.status,
          error: updateData?.error,
          message: updateData?.message,
          requestId,
        });
        return res.status(updateResponse.status).json({
          message:
            updateData?.message ||
            updateData?.error ||
            "Unable to update verified phone number.",
          details: {
            status: updateResponse.status,
            error: updateData?.error,
            error_description: updateData?.error_description,
            requestId,
          },
        });
      }
    }

    return res.json({
      message: updatePhone
        ? "Phone number verified."
        : "Guardian verification succeeded.",
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});


app.post("/api/mfa/enroll-email", checkApiJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const userResponse = await fetch(
      `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}?fields=email&include_fields=true`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${mgmtToken}`,
        },
      }
    );

    const userData = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok) {
      return res.status(userResponse.status).json({
        message: userData?.message || "Unable to read user email.",
      });
    }

    const email = userData?.email || "";
    if (!email) {
      return res.status(400).json({ message: "User email not available." });
    }

    const payload = {
      client_id: authConfig.clientId,
      connection: "email",
      email,
      send: "code",
    };
    if (process.env.AUTH0_CLIENT_SECRET) {
      payload.client_secret = process.env.AUTH0_CLIENT_SECRET;
    }

    const response = await fetch(`https://${authConfig.domain}/passwordless/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.error_description || data?.message || "Unable to send email code.",
        details: data,
      });
    }

    return res.json({ message: "Email code sent.", email });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

app.post("/api/mfa/verify-email", checkApiJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;
  const otp = (req.body?.otp || "").trim();

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  if (!otp) {
    return res.status(400).json({ message: "OTP code is required." });
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const userResponse = await fetch(
      `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}?fields=email&include_fields=true`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${mgmtToken}`,
        },
      }
    );

    const userData = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok) {
      return res.status(userResponse.status).json({
        message: userData?.message || "Unable to read user email.",
      });
    }

    const email = userData?.email || "";
    if (!email) {
      return res.status(400).json({ message: "User email not available." });
    }

    const params = new URLSearchParams();
    params.set("grant_type", "http://auth0.com/oauth/grant-type/passwordless/otp");
    params.set("client_id", authConfig.clientId);
    if (process.env.AUTH0_CLIENT_SECRET) {
      params.set("client_secret", process.env.AUTH0_CLIENT_SECRET);
    }
    params.set("username", email);
    params.set("otp", otp);
    params.set("realm", "email");
    params.set("scope", "openid profile email");

    const response = await fetch(`https://${authConfig.domain}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.error_description || data?.message || "Email verification failed.",
        details: data,
      });
    }

    return res.json({ message: "Email verification succeeded." });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});


// ----------------------------
// Misc API endpoints
// ----------------------------
// API protetta
app.get("/api/external", checkApiJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!"
  });
});

// ----------------------------
// Admin order management
// ----------------------------
app.patch("/api/admin/orders/:orderId", checkApiJwt, async (req, res) => {
  const adminUserId = req.auth?.payload?.sub;
  const orderId = req.params.orderId;
  const targetUserId = req.body?.userId || req.query?.userId;
  const order = req.body?.order;

  if (!adminUserId) {
    return res.status(400).json({ message: "User id not available." });
  }

  const isAdmin = isAdminPayload(req.auth?.payload) || (await hasAdminRoleForUser(adminUserId));
  if (!isAdmin) {
    return res.status(403).json({ message: "Admin role required." });
  }

  if (!targetUserId) {
    return res.status(400).json({ message: "Target user id is required." });
  }

  if (!order) {
    return res.status(400).json({ message: "Order payload is required." });
  }

  const errors = validateOrder(order);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Validation error.", errors });
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const existingResponse = await fetch(
      `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(targetUserId)}?fields=user_metadata&include_fields=true`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${mgmtToken}`,
        },
      }
    );

    const existingData = await existingResponse.json().catch(() => ({}));
    if (!existingResponse.ok) {
      return res.status(existingResponse.status).json({
        message: existingData?.message || "Error while reading user metadata.",
      });
    }

    const existingOrders = existingData?.user_metadata?.orders || [];
    const existingOrder = existingOrders.find((item) => item.id === orderId);
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found." });
    }

    const normalizedOrder = {
      ...order,
      id: orderId,
      createdAt: order.createdAt || existingOrder.createdAt || new Date().toISOString(),
      status: order.status || existingOrder.status || "Paid",
    };

    const updatedOrders = existingOrders.map((item) =>
      item.id === orderId ? normalizedOrder : item
    );

    const response = await fetch(`https://${authConfig.domain}/api/v2/users/${encodeURIComponent(targetUserId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${mgmtToken}`,
      },
      body: JSON.stringify({
        user_metadata: {
          orders: updatedOrders,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.message || "Error while updating order.",
      });
    }

    return res.json({
      message: "Order updated.",
      order: normalizedOrder,
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

app.delete("/api/admin/orders/:orderId", checkApiJwt, async (req, res) => {
  const adminUserId = req.auth?.payload?.sub;
  const orderId = req.params.orderId;
  const targetUserId = req.body?.userId || req.query?.userId;

  if (!adminUserId) {
    return res.status(400).json({ message: "User id not available." });
  }

  const isAdmin = isAdminPayload(req.auth?.payload) || (await hasAdminRoleForUser(adminUserId));
  if (!isAdmin) {
    return res.status(403).json({ message: "Admin role required." });
  }

  if (!targetUserId) {
    return res.status(400).json({ message: "Target user id is required." });
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const existingResponse = await fetch(
      `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(targetUserId)}?fields=user_metadata&include_fields=true`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${mgmtToken}`,
        },
      }
    );

    const existingData = await existingResponse.json().catch(() => ({}));
    if (!existingResponse.ok) {
      return res.status(existingResponse.status).json({
        message: existingData?.message || "Error while reading user metadata.",
      });
    }

    const existingOrders = existingData?.user_metadata?.orders || [];
    const updatedOrders = existingOrders.filter((item) => item.id !== orderId);

    if (updatedOrders.length === existingOrders.length) {
      return res.status(404).json({ message: "Order not found." });
    }

    const response = await fetch(`https://${authConfig.domain}/api/v2/users/${encodeURIComponent(targetUserId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${mgmtToken}`,
      },
      body: JSON.stringify({
        user_metadata: {
          orders: updatedOrders,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.message || "Error while deleting order.",
      });
    }

    return res.json({ message: "Order deleted." });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

// ----------------------------
// Static app hosting
// ----------------------------
// Serve i file statici di React
app.use(express.static(path.join(__dirname, "build1")));

// Fallback per SPA: tutte le richieste non API vanno a index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build1", "index.html"));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));



