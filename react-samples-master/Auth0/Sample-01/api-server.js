const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const path = require("path");
const { auth } = require("express-oauth2-jwt-bearer");

const authConfig = {
  domain: "identity-auth0.cic-demo-platform.auth0app.com",
  clientId: "Iwab1kMZj0fPOTZnWwtt5KI5yTBTOrLV",
  audience: "https://ciamlab.onrender.com/api",
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

// Middleware per autenticazione JWT
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
    const response = await fetch(`https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${mgmtToken}`,
      },
      body: JSON.stringify({
        user_metadata: {
          [field]: updateValue,
        },
      }),
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

app.get("/api/user/profile", checkApiJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  try {
    const mgmtToken = await getManagementApiToken();
    const response = await fetch(
      `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}?fields=user_metadata&include_fields=true`,
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

    return res.json({
      user_metadata: data?.user_metadata || {},
    });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

app.get("/api/user/roles", checkApiJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  try {
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
      return res.status(response.status).json({
        message: data?.message || "Error while fetching user roles.",
      });
    }

    const roles = Array.isArray(data) ? data.map((role) => role.name).filter(Boolean) : [];
    return res.json({ roles });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

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

app.post("/api/mfa/enroll-sms", checkMfaJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;
  const phoneNumberRaw = (req.body?.phoneNumber || "").trim();
  const phoneNumber = phoneNumberRaw.replace(/[^\d+]/g, "");
  const mfaToken = req.body?.mfaToken;
  const replaceExisting = req.body?.replaceExisting !== false;

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required." });
  }

  if (!/^\+\d{6,}$/.test(phoneNumber)) {
    return res.status(400).json({
      message: "Phone number must be in E.164 format (e.g. +393331234567).",
    });
  }

  if (!mfaToken) {
    return res.status(400).json({ message: "MFA token is required." });
  }

  try {
    if (replaceExisting) {
      try {
        const mgmtToken = await getManagementApiToken();
        await fetch(
          `https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}/multifactor/sms`,
          {
            method: "DELETE",
            headers: {
              authorization: `Bearer ${mgmtToken}`,
            },
          }
        );
      } catch {
        // Best effort: continue even if no existing SMS factor
      }
    }

    const response = await fetch(`https://${authConfig.domain}/mfa/associate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${mfaToken}`,
      },
      body: JSON.stringify({
        authenticator_types: ["oob"],
        oob_channels: ["sms"],
        phone_number: phoneNumber,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        message:
          data?.error_description ||
          data?.message ||
          data?.error ||
          "Unable to enroll phone number.",
      });
    }

    return res.json({ oobCode: data?.oob_code });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

app.post("/api/mfa/verify-sms", checkMfaJwt, async (req, res) => {
  const userId = req.auth?.payload?.sub;
  const mfaToken = req.body?.mfaToken;
  const oobCode = req.body?.oobCode;
  const bindingCode = (req.body?.otp || "").trim();
  const phoneNumber = (req.body?.phoneNumber || "").trim();

  if (!userId) {
    return res.status(400).json({ message: "User id not available." });
  }

  if (!mfaToken || !oobCode || !bindingCode) {
    return res.status(400).json({ message: "OTP data is required." });
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
    params.set("binding_code", bindingCode);

    const response = await fetch(`https://${authConfig.domain}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.error_description || data?.message || "OTP verification failed.",
      });
    }

    if (phoneNumber) {
      const mgmtToken = await getManagementApiToken();
      await fetch(`https://${authConfig.domain}/api/v2/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${mgmtToken}`,
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          phone_verified: true,
        }),
      });
    }

    return res.json({ message: "Phone number verified." });
  } catch (error) {
    return res.status(500).json({ message: error?.message || "Server error." });
  }
});

// API protetta
app.get("/api/external", checkApiJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!"
  });
});

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

// Serve i file statici di React
app.use(express.static(path.join(__dirname, "build1")));

// Fallback per SPA: tutte le richieste non API vanno a index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build1", "index.html"));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

