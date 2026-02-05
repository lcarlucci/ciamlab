import React, { useEffect, useMemo, useState } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import Loading from "../components/Loading";
import { getConfig } from "../config";
import { getAvatarColor, getInitial } from "../utils/avatar";
import "./css/Profile.css";

const DEBUG_BYPASS_AUTH = false;
const PASSWORD_RESET_CONNECTION = "Username-Password-Authentication";

export const ProfileComponent = () => {
  const { user, getAccessTokenSilently, getAccessTokenWithPopup } = useAuth0();
  const [resetState, setResetState] = useState({ status: "idle", message: "" });
  const [editingField, setEditingField] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [fieldStatus, setFieldStatus] = useState({});
  const [orders, setOrders] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [orderDrafts, setOrderDrafts] = useState({});
  const [orderActionStatus, setOrderActionStatus] = useState({});
  const [phoneFlow, setPhoneFlow] = useState({
    status: "idle",
    message: "",
    mfaToken: "",
    oobCode: "",
    authenticatorId: "",
    otp: "",
  });
  const config = getConfig();

  const buildErrorMessage = (data, fallback) => {
    const base = data?.message || fallback;
    const details = data?.details || {};
    const parts = [];
    if (details.error_description) {
      parts.push(details.error_description);
    } else if (details.error) {
      parts.push(details.error);
    }
    if (details.requestId) {
      parts.push(`requestId: ${details.requestId}`);
    }
    return parts.length ? `${base} (${parts.join(" | ")})` : base;
  };

  const decodeJwtPayload = (token) => {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    try {
      const decoded = atob(padded);
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  };

  const hasAdminRole = (payload) => {
    if (!payload) return false;
    const roles = [];
    Object.entries(payload).forEach(([key, value]) => {
      if (!key.toLowerCase().includes("roles")) return;
      if (Array.isArray(value)) {
        roles.push(...value);
      }
    });
    return roles.some((role) => {
      const normalized = String(role || "").toLowerCase();
      return normalized === "administrator" || normalized === "administator";
    });
  };

  const mockUser = {
    picture: process.env.PUBLIC_URL + "/assets/placeholder.png",
    name: "Test User",
    email: "test@domain.com",
    sub: "auth0|test-user",
    user_metadata: {
      phone_number: "+390000000000",
      company: "Deloitte",
    },
  };

  const currentUser = DEBUG_BYPASS_AUTH ? mockUser : user;
  const email = currentUser?.email;
  const provider = currentUser?.sub?.split("|")[0];
  const isDbUser = provider === "auth0";
  const avatarSeed = currentUser?.name || currentUser?.email || "";
  const avatarInitial = getInitial(currentUser?.name, currentUser?.email);
  const avatarColor = getAvatarColor(avatarSeed);

  const editableFields = useMemo(
    () => [
      { key: "name", label: "Full name", placeholder: "Mario Rossi" },
      { key: "given_name", label: "First name", placeholder: "Mario" },
      { key: "family_name", label: "Last name", placeholder: "Rossi" },
      { key: "birthdate", label: "Birthdate", placeholder: "1990-01-01" },
      {
        key: "email",
        label: "Profile email",
        placeholder: "mario.rossi@company.com",
        note: "Does not change login email.",
      },
      { key: "phone_number", label: "Phone number", placeholder: "+39 333 123 4567" },
      { key: "zoneinfo", label: "Time zone", placeholder: "Europe/Rome" },
      { key: "company", label: "Company", placeholder: "Company name" },
    ],
    []
  );

  const columnOneKeys = ["name", "given_name", "family_name", "birthdate"];
  const columnOneFields = editableFields.filter((field) =>
    columnOneKeys.includes(field.key)
  );
  const columnTwoFields = editableFields.filter(
    (field) => !columnOneKeys.includes(field.key)
  );

  useEffect(() => {
    if (!currentUser) return;
    const nextValues = {};
    editableFields.forEach((field) => {
      const metaValue = currentUser?.user_metadata?.[field.key];
      const rootValue = currentUser?.[field.key];
      if (field.key === "phone_number") {
        nextValues[field.key] = rootValue ?? metaValue ?? "";
      } else {
        nextValues[field.key] = metaValue ?? rootValue ?? "";
      }
    });
    setFieldValues(nextValues);
  }, [currentUser, editableFields]);

  useEffect(() => {
    if (!currentUser) return;

    const loadMetadata = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: config.audience },
        });
        const payload = decodeJwtPayload(token);
        const tokenAdmin = hasAdminRole(payload);
        setIsAdmin(tokenAdmin);

        const apiBase = config.apiOrigin || window.location.origin;
        const response = await fetch(`${apiBase}/api/user/profile`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || "Error while fetching profile metadata.");
        }

        const metadata = data?.user_metadata || {};
        const rootPhoneNumber = data?.phone_number;
        setPhoneVerified(Boolean(data?.phone_verified));
        setOrders(metadata.orders || []);
        setFieldValues((prev) => {
          const next = { ...prev };
          editableFields.forEach((field) => {
            if (field.key === "phone_number") {
              if (rootPhoneNumber) {
                next[field.key] = rootPhoneNumber;
              }
              return;
            }
            if (metadata[field.key] !== undefined && metadata[field.key] !== null) {
              next[field.key] = metadata[field.key];
            }
          });
          return next;
        });

        if (!tokenAdmin) {
          const rolesResponse = await fetch(`${apiBase}/api/user/roles`, {
            headers: {
              authorization: `Bearer ${token}`,
            },
          });
          const rolesData = await rolesResponse.json().catch(() => ({}));
          if (rolesResponse.ok && Array.isArray(rolesData.roles)) {
            setIsAdmin(hasAdminRole({ roles: rolesData.roles }));
          }
        }
      } catch (err) {
        setFieldStatus((prev) => ({
          ...prev,
          metadata: {
            status: "error",
            message: err?.message || "Unable to load profile metadata.",
          },
        }));
        setIsAdmin(false);
      }
    };

    loadMetadata();
  }, [currentUser, editableFields, getAccessTokenSilently, config.audience, config.apiOrigin]);

  const providerMessage = !isDbUser
    ? provider === "google-oauth2"
      ? "To change your password, go to your Google account settings."
      : provider === "facebook"
        ? "To change your password, go to your Facebook account settings."
        : "To change your password, use your login provider settings."
    : "";

  const handlePasswordReset = async () => {
    if (!email) {
      setResetState({ status: "error", message: "User email not available." });
      return;
    }

    setResetState({ status: "loading", message: "" });

    try {
      const response = await fetch(
        `https://${config.domain}/dbconnections/change_password`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client_id: config.clientId,
            email,
            connection: PASSWORD_RESET_CONNECTION,
          }),
        }
      );

      const text = await response.text();

      if (!response.ok) {
        throw new Error(text || "Error while requesting password reset.");
      }

      setResetState({
        status: "success",
        message: text || "Password reset email sent.",
      });
    } catch (err) {
      setResetState({
        status: "error",
        message: err?.message || "Error while requesting password reset.",
      });
    }
  };

  const handleFieldSave = async (fieldKey) => {
    const value = (fieldValues[fieldKey] || "").trim();
    setFieldStatus((prev) => ({
      ...prev,
      [fieldKey]: { status: "loading", message: "" },
    }));

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: config.audience },
      });

      const apiBase = config.apiOrigin || window.location.origin;
      const response = await fetch(`${apiBase}/api/user/profile`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ field: fieldKey, value }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "Error while saving profile.");
      }

      setFieldStatus((prev) => ({
        ...prev,
        [fieldKey]: { status: "success", message: "Updated." },
      }));
      setEditingField(null);
    } catch (err) {
      setFieldStatus((prev) => ({
        ...prev,
        [fieldKey]: {
          status: "error",
          message: err?.message || "Error while saving profile.",
        },
      }));
    }
  };

  const handleCancelEdit = (fieldKey) => {
    const metaValue = currentUser?.user_metadata?.[fieldKey];
    const rootValue = currentUser?.[fieldKey];
    const fallbackValue = metaValue ?? rootValue ?? "";
    setFieldValues((prev) => ({ ...prev, [fieldKey]: fallbackValue }));
    setEditingField(null);
    if (fieldKey === "phone_number") {
      setPhoneFlow({
        status: "idle",
        message: "",
        mfaToken: "",
        oobCode: "",
        authenticatorId: "",
        otp: "",
      });
    }
  };

  const startPhoneVerification = async () => {
    const rawInput = (fieldValues.phone_number || "").trim();
    const normalizedInput = rawInput.replace(/\s+/g, "");
    const phoneNumber = normalizedInput.startsWith("+")
      ? normalizedInput
      : `+39${normalizedInput}`;
    if (!phoneNumber) {
      setPhoneFlow({
        status: "error",
        message: "Phone number is required.",
        mfaToken: "",
        oobCode: "",
        otp: "",
      });
      return;
    }

    setPhoneFlow((prev) => ({ ...prev, status: "loading", message: "" }));

    try {
      if (phoneNumber !== fieldValues.phone_number) {
        setFieldValues((prev) => ({ ...prev, phone_number: phoneNumber }));
      }
      let mfaToken = "";
      try {
        mfaToken = await getAccessTokenSilently({
          authorizationParams: {
            audience: `https://${config.domain}/mfa/`,
            scope: "enroll read:authenticators remove:authenticators",
          },
        });
      } catch {
        mfaToken = await getAccessTokenWithPopup({
          authorizationParams: {
            audience: `https://${config.domain}/mfa/`,
            scope: "enroll read:authenticators remove:authenticators",
          },
        });
      }

      const apiBase = config.apiOrigin || window.location.origin;
      const response = await fetch(`${apiBase}/api/mfa/enroll-sms`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${mfaToken}`,
        },
        body: JSON.stringify({ phoneNumber, mfaToken, replaceExisting: true }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(buildErrorMessage(data, "Unable to send OTP."));
      }

      setPhoneFlow({
        status: "code_sent",
        message: "OTP sent to your phone.",
        mfaToken,
        oobCode: data?.oobCode || "",
        authenticatorId: data?.authenticatorId || "",
        otp: "",
      });
    } catch (err) {
      setPhoneFlow((prev) => ({
        ...prev,
        status: "error",
        message: err?.message || "Unable to send OTP.",
      }));
    }
  };

  const verifyPhoneOtp = async () => {
    const otp = (phoneFlow.otp || "").trim();
    if (!otp) {
      setPhoneFlow((prev) => ({
        ...prev,
        status: "error",
        message: "OTP code is required.",
      }));
      return;
    }

    setPhoneFlow((prev) => ({ ...prev, status: "verifying", message: "" }));

    try {
      const apiBase = config.apiOrigin || window.location.origin;
      const response = await fetch(`${apiBase}/api/mfa/verify-sms`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${phoneFlow.mfaToken}`,
        },
        body: JSON.stringify({
          mfaToken: phoneFlow.mfaToken,
          oobCode: phoneFlow.oobCode,
          authenticatorId: phoneFlow.authenticatorId,
          otp,
          phoneNumber: (fieldValues.phone_number || "").trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(buildErrorMessage(data, "OTP verification failed."));
      }

      setPhoneFlow((prev) => ({
        ...prev,
        status: "success",
        message: "Phone number verified.",
      }));
      setPhoneVerified(true);
      setEditingField(null);
    } catch (err) {
      setPhoneFlow((prev) => ({
        ...prev,
        status: "error",
        message: err?.message || "OTP verification failed.",
      }));
    }
  };

  const createOrderDraft = (order) => ({
    id: order.id,
    status: order.status || "Paid",
    itemsText: (order.items || []).join("\n"),
    billing: {
      fullName: order.billing?.fullName || "",
      email: order.billing?.email || "",
      company: order.billing?.company || "",
      phone: order.billing?.phone || "",
      address: order.billing?.address || "",
      city: order.billing?.city || "",
      country: order.billing?.country || "",
      vat: order.billing?.vat || "",
    },
    payment: {
      method: order.payment?.method || "card",
      card: {
        number: order.payment?.card?.number || "",
        expiry: order.payment?.card?.expiry || "",
        cvv: order.payment?.card?.cvv || "",
        holder: order.payment?.card?.holder || "",
      },
      invoice: {
        pecEmail: order.payment?.invoice?.pecEmail || "",
        sdiCode: order.payment?.invoice?.sdiCode || "",
        vatNumber: order.payment?.invoice?.vatNumber || "",
        billingContact: order.payment?.invoice?.billingContact || "",
      },
    },
    totals: {
      pricePerItem: order.totals?.pricePerItem || 12000,
      currency: order.totals?.currency || "EUR",
    },
  });

  const handleEditOrder = (order) => {
    setEditingOrderId(order.id);
    setOrderDrafts((prev) => ({
      ...prev,
      [order.id]: prev[order.id] || createOrderDraft(order),
    }));
  };

  const handleCancelOrderEdit = (orderId) => {
    setEditingOrderId(null);
    setOrderDrafts((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  };

  const handleSaveOrder = async (orderId) => {
    const draft = orderDrafts[orderId];
    if (!draft) return;
    setOrderActionStatus((prev) => ({
      ...prev,
      [orderId]: { status: "loading", message: "" },
    }));

    const items = draft.itemsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const updatedOrder = {
      id: orderId,
      createdAt: orders.find((o) => o.id === orderId)?.createdAt,
      status: draft.status,
      items,
      totals: {
        currency: draft.totals.currency,
        pricePerItem: draft.totals.pricePerItem,
        subtotal: items.length * draft.totals.pricePerItem,
      },
      billing: draft.billing,
      payment: {
        method: draft.payment.method,
        card: draft.payment.method === "card" ? draft.payment.card : null,
        invoice: draft.payment.method === "invoice" ? draft.payment.invoice : null,
      },
    };

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: config.audience },
      });
      const apiBase = config.apiOrigin || window.location.origin;
      const response = await fetch(`${apiBase}/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order: updatedOrder }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to update order.");
      }

      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? data.order : order))
      );
      setEditingOrderId(null);
      setOrderActionStatus((prev) => ({
        ...prev,
        [orderId]: { status: "success", message: "Order updated." },
      }));
    } catch (err) {
      setOrderActionStatus((prev) => ({
        ...prev,
        [orderId]: {
          status: "error",
          message: err?.message || "Unable to update order.",
        },
      }));
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm("Delete this order? This action cannot be undone.")) {
      return;
    }

    setOrderActionStatus((prev) => ({
      ...prev,
      [orderId]: { status: "loading", message: "" },
    }));

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: config.audience },
      });
      const apiBase = config.apiOrigin || window.location.origin;
      const response = await fetch(`${apiBase}/api/orders/${orderId}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete order.");
      }

      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      setOrderActionStatus((prev) => ({
        ...prev,
        [orderId]: { status: "success", message: "Order deleted." },
      }));
    } catch (err) {
      setOrderActionStatus((prev) => ({
        ...prev,
        [orderId]: {
          status: "error",
          message: err?.message || "Unable to delete order.",
        },
      }));
    }
  };

  return (
    <div className="profile-container">
      <section className="profile-shell">
        <aside className="profile-card">
          <div
            className="profile-avatar"
            style={{ backgroundColor: avatarColor }}
            aria-label="Profile avatar"
          >
            {avatarInitial}
          </div>
          <h2 className="profile-name">{currentUser?.name || "User"}</h2>
          <p className="profile-email">{currentUser?.email || "Email not available"}</p>
          <div className="profile-actions">
            <button
              className="reset-password-button"
              onClick={handlePasswordReset}
              disabled={resetState.status === "loading" || !email || !isDbUser}
              type="button"
            >
              {resetState.status === "loading" ? "Sending..." : "Change password"}
            </button>
            {providerMessage ? (
              <div className="reset-password-status info">
                {providerMessage}
              </div>
            ) : null}
            {resetState.message ? (
              <div className={`reset-password-status ${resetState.status}`}>
                {resetState.message}
              </div>
            ) : null}
          </div>
        </aside>

        <div className="profile-details">
          <div className="details-header">
            <h3>User profile</h3>
            <span className="details-subtitle">Personal details and contacts</span>
          </div>

          <div className="profile-fields-grid">
            {[columnOneFields, columnTwoFields].map((columnFields, idx) => (
              <div key={`col-${idx}`} className="profile-fields compact">
                {columnFields.map((field) => {
                  const status = fieldStatus[field.key];
                  const isEditing = editingField === field.key;
                  const value = fieldValues[field.key] || "";

                  return (
                    <div key={field.key} className="profile-field compact">
                      <div className="field-row">
                        <div className="field-info">
                          <span className="field-label">{field.label}</span>
                          {field.note ? (
                            <span className="field-note">{field.note}</span>
                          ) : null}
                          <span className="field-value">
                            {value || "N/A"}
                            {field.key === "phone_number" && value ? (
                              <span
                                className={`phone-badge ${
                                  phoneVerified ? "verified" : "unverified"
                                }`}
                              >
                                {phoneVerified ? "Verified" : "Unverified"}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      <button
                        className="field-edit-button icon-only"
                        onClick={() =>
                          setEditingField(isEditing ? null : field.key)
                        }
                        aria-label="Edit"
                        type="button"
                      >
                          <svg
                            className="edit-icon"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              d="M4 16.5V20h3.5L19 8.5l-3.5-3.5L4 16.5z"
                              fill="currentColor"
                            />
                            <path
                              d="M20.7 7.3c.4-.4.4-1 0-1.4l-2.6-2.6c-.4-.4-1-.4-1.4 0l-1.7 1.7 3.5 3.5 2.2-2.2z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </div>

                      {isEditing ? (
                        <div className="field-edit">
                          <input
                            className="field-input"
                            type="text"
                            value={value}
                            placeholder={field.placeholder}
                            onChange={(event) =>
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.key]: event.target.value,
                              }))
                            }
                          />
                          {field.key === "phone_number" ? (
                            <>
                              <div className="field-edit-actions">
                                <button
                                  className="field-save-button"
                                  onClick={startPhoneVerification}
                                  disabled={phoneFlow.status === "loading"}
                                  type="button"
                                >
                                  {phoneFlow.status === "loading"
                                    ? "Sending..."
                                    : phoneFlow.status === "code_sent"
                                      ? "Resend OTP"
                                      : "Send OTP"}
                                </button>
                                <button
                                  className="field-cancel-button"
                                  onClick={() => handleCancelEdit(field.key)}
                                  type="button"
                                >
                                  Cancel
                                </button>
                              </div>
                              {phoneFlow.status === "code_sent" ||
                              phoneFlow.status === "verifying" ||
                              phoneFlow.status === "success" ||
                              phoneFlow.status === "error" ? (
                                <div className="field-otp">
                                  <label>OTP code</label>
                                  <input
                                    className="field-input"
                                    type="text"
                                    value={phoneFlow.otp}
                                    placeholder="123456"
                                    onChange={(event) =>
                                      setPhoneFlow((prev) => ({
                                        ...prev,
                                        otp: event.target.value,
                                      }))
                                    }
                                  />
                                  <div className="field-edit-actions">
                                    <button
                                      className="field-save-button"
                                      onClick={verifyPhoneOtp}
                                      disabled={phoneFlow.status === "verifying"}
                                      type="button"
                                    >
                                      {phoneFlow.status === "verifying" ? "Verifying..." : "Verify"}
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                              {phoneFlow.message ? (
                                <div className={`field-status ${phoneFlow.status}`}>
                                  {phoneFlow.message}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="field-edit-actions">
                              <button
                                className="field-save-button"
                                onClick={() => handleFieldSave(field.key)}
                                disabled={status?.status === "loading"}
                                type="button"
                              >
                                {status?.status === "loading" ? "Saving..." : "Save"}
                              </button>
                              <button
                                className="field-cancel-button"
                                onClick={() => handleCancelEdit(field.key)}
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null}

                      {status?.message ? (
                        <div className={`field-status ${status.status}`}>
                          {status.message}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="orders-shell">
        <div className="orders-header">
          <h3>Orders</h3>
          <div className="orders-tabs">
            <button className="orders-tab active" type="button">Recent</button>
            <button className="orders-tab" type="button">In progress</button>
            <button className="orders-tab" type="button">Archived</button>
          </div>
        </div>

        <div className="orders-table">
          {orders.length > 0 ? (
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order.id} className="order-card">
                  {isAdmin ? (
                    <div className="order-admin">
                      {editingOrderId === order.id ? (
                        <>
                          <button
                            className="order-admin-btn primary"
                            type="button"
                            onClick={() => handleSaveOrder(order.id)}
                          >
                            Save
                          </button>
                          <button
                            className="order-admin-btn"
                            type="button"
                            onClick={() => handleCancelOrderEdit(order.id)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="order-admin-btn"
                            type="button"
                            onClick={() => handleEditOrder(order)}
                          >
                            Edit
                          </button>
                          <button
                            className="order-admin-btn danger"
                            type="button"
                            onClick={() => handleDeleteOrder(order.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                  <div className="order-header">
                    <div>
                      <div className="order-id">Order {order.id}</div>
                      <div className="order-date">
                        {new Date(order.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <span className="status-badge">{order.status || "Paid"}</span>
                  </div>

                  <div className="order-panels">
                    <div className="order-panel">
                      <h4>Order summary</h4>
                      {editingOrderId === order.id ? (
                        <>
                          <div className="order-kv">
                            <span className="order-label">Status</span>
                            <input
                              className="order-input"
                              type="text"
                              value={orderDrafts[order.id]?.status || ""}
                              onChange={(event) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...prev[order.id],
                                    status: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Price per item</span>
                            <input
                              className="order-input"
                              type="number"
                              value={orderDrafts[order.id]?.totals?.pricePerItem || ""}
                              onChange={(event) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...prev[order.id],
                                    totals: {
                                      ...prev[order.id].totals,
                                      pricePerItem: Number(event.target.value || 0),
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="order-kv">
                            <span className="order-label">Items</span>
                            <span className="order-value">{(order.items || []).length}</span>
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Subtotal</span>
                            <span className="order-value">
                              {order.totals?.currency || "EUR"} {order.totals?.subtotal}
                            </span>
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Price per item</span>
                            <span className="order-value">
                              {order.totals?.currency || "EUR"} {order.totals?.pricePerItem}
                            </span>
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Status</span>
                            <span className="order-value">{order.status || "Paid"}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="order-panel">
                      <h4>Billing</h4>
                      {editingOrderId === order.id ? (
                        <>
                          <div className="order-kv">
                            <span className="order-label">Full name</span>
                            <input
                              className="order-input"
                              type="text"
                              value={orderDrafts[order.id]?.billing?.fullName || ""}
                              onChange={(event) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...prev[order.id],
                                    billing: {
                                      ...prev[order.id].billing,
                                      fullName: event.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Email</span>
                            <input
                              className="order-input"
                              type="email"
                              value={orderDrafts[order.id]?.billing?.email || ""}
                              onChange={(event) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...prev[order.id],
                                    billing: {
                                      ...prev[order.id].billing,
                                      email: event.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Company</span>
                            <input
                              className="order-input"
                              type="text"
                              value={orderDrafts[order.id]?.billing?.company || ""}
                              onChange={(event) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...prev[order.id],
                                    billing: {
                                      ...prev[order.id].billing,
                                      company: event.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Phone</span>
                            <input
                              className="order-input"
                              type="tel"
                              value={orderDrafts[order.id]?.billing?.phone || ""}
                              onChange={(event) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...prev[order.id],
                                    billing: {
                                      ...prev[order.id].billing,
                                      phone: event.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Address</span>
                            <input
                              className="order-input"
                              type="text"
                              value={orderDrafts[order.id]?.billing?.address || ""}
                              onChange={(event) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...prev[order.id],
                                    billing: {
                                      ...prev[order.id].billing,
                                      address: event.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="order-kv">
                            <span className="order-label">City</span>
                            <input
                              className="order-input"
                              type="text"
                              value={orderDrafts[order.id]?.billing?.city || ""}
                              onChange={(event) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...prev[order.id],
                                    billing: {
                                      ...prev[order.id].billing,
                                      city: event.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Country</span>
                            <input
                              className="order-input"
                              type="text"
                              value={orderDrafts[order.id]?.billing?.country || ""}
                              onChange={(event) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...prev[order.id],
                                    billing: {
                                      ...prev[order.id].billing,
                                      country: event.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                          <div className="order-kv">
                            <span className="order-label">VAT / Tax ID</span>
                            <input
                              className="order-input"
                              type="text"
                              value={orderDrafts[order.id]?.billing?.vat || ""}
                              onChange={(event) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...prev[order.id],
                                    billing: {
                                      ...prev[order.id].billing,
                                      vat: event.target.value,
                                    },
                                  },
                                }))
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="order-kv">
                            <span className="order-label">Full name</span>
                            <span className="order-value">{order.billing?.fullName}</span>
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Email</span>
                            <span className="order-value">{order.billing?.email}</span>
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Company</span>
                            <span className="order-value">{order.billing?.company}</span>
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Phone</span>
                            <span className="order-value">{order.billing?.phone}</span>
                          </div>
                          <div className="order-kv">
                            <span className="order-label">Address</span>
                            <span className="order-value">
                              {order.billing?.address}, {order.billing?.city}, {order.billing?.country}
                            </span>
                          </div>
                          <div className="order-kv">
                            <span className="order-label">VAT / Tax ID</span>
                            <span className="order-value">{order.billing?.vat}</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="order-panel">
                      <h4>Payment</h4>
                      {editingOrderId === order.id ? (
                        <>
                          <div className="order-kv">
                            <span className="order-label">Method</span>
                            <select
                              className="order-input"
                              value={orderDrafts[order.id]?.payment?.method || "card"}
                              onChange={(event) =>
                                setOrderDrafts((prev) => ({
                                  ...prev,
                                  [order.id]: {
                                    ...prev[order.id],
                                    payment: {
                                      ...prev[order.id].payment,
                                      method: event.target.value,
                                    },
                                  },
                                }))
                              }
                            >
                              <option value="card">Card</option>
                              <option value="paypal">PayPal</option>
                              <option value="gpay">Google Pay</option>
                              <option value="applepay">Apple Pay</option>
                              <option value="invoice">Invoice</option>
                            </select>
                          </div>

                          {orderDrafts[order.id]?.payment?.method === "card" ? (
                            <>
                              <div className="order-kv">
                                <span className="order-label">Card number</span>
                                <input
                                  className="order-input"
                                  type="text"
                                  value={orderDrafts[order.id]?.payment?.card?.number || ""}
                                  onChange={(event) =>
                                    setOrderDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...prev[order.id],
                                        payment: {
                                          ...prev[order.id].payment,
                                          card: {
                                            ...prev[order.id].payment.card,
                                            number: event.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="order-kv">
                                <span className="order-label">Cardholder</span>
                                <input
                                  className="order-input"
                                  type="text"
                                  value={orderDrafts[order.id]?.payment?.card?.holder || ""}
                                  onChange={(event) =>
                                    setOrderDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...prev[order.id],
                                        payment: {
                                          ...prev[order.id].payment,
                                          card: {
                                            ...prev[order.id].payment.card,
                                            holder: event.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </>
                          ) : null}

                          {orderDrafts[order.id]?.payment?.method === "invoice" ? (
                            <>
                              <div className="order-kv">
                                <span className="order-label">PEC</span>
                                <input
                                  className="order-input"
                                  type="email"
                                  value={orderDrafts[order.id]?.payment?.invoice?.pecEmail || ""}
                                  onChange={(event) =>
                                    setOrderDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...prev[order.id],
                                        payment: {
                                          ...prev[order.id].payment,
                                          invoice: {
                                            ...prev[order.id].payment.invoice,
                                            pecEmail: event.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="order-kv">
                                <span className="order-label">SDI</span>
                                <input
                                  className="order-input"
                                  type="text"
                                  value={orderDrafts[order.id]?.payment?.invoice?.sdiCode || ""}
                                  onChange={(event) =>
                                    setOrderDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...prev[order.id],
                                        payment: {
                                          ...prev[order.id].payment,
                                          invoice: {
                                            ...prev[order.id].payment.invoice,
                                            sdiCode: event.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="order-kv">
                                <span className="order-label">VAT</span>
                                <input
                                  className="order-input"
                                  type="text"
                                  value={orderDrafts[order.id]?.payment?.invoice?.vatNumber || ""}
                                  onChange={(event) =>
                                    setOrderDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...prev[order.id],
                                        payment: {
                                          ...prev[order.id].payment,
                                          invoice: {
                                            ...prev[order.id].payment.invoice,
                                            vatNumber: event.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="order-kv">
                                <span className="order-label">Billing contact</span>
                                <input
                                  className="order-input"
                                  type="email"
                                  value={orderDrafts[order.id]?.payment?.invoice?.billingContact || ""}
                                  onChange={(event) =>
                                    setOrderDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...prev[order.id],
                                        payment: {
                                          ...prev[order.id].payment,
                                          invoice: {
                                            ...prev[order.id].payment.invoice,
                                            billingContact: event.target.value,
                                          },
                                        },
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <div className="order-kv">
                            <span className="order-label">Method</span>
                            <span className="order-value">{order.payment?.method}</span>
                          </div>
                          {order.payment?.card ? (
                            <>
                              <div className="order-kv">
                                <span className="order-label">Card number</span>
                                <span className="order-value">{order.payment.card.number}</span>
                              </div>
                              <div className="order-kv">
                                <span className="order-label">Cardholder</span>
                                <span className="order-value">{order.payment.card.holder}</span>
                              </div>
                            </>
                          ) : null}
                          {order.payment?.invoice ? (
                            <>
                              <div className="order-kv">
                                <span className="order-label">PEC</span>
                                <span className="order-value">{order.payment.invoice.pecEmail}</span>
                              </div>
                              <div className="order-kv">
                                <span className="order-label">SDI</span>
                                <span className="order-value">{order.payment.invoice.sdiCode}</span>
                              </div>
                              <div className="order-kv">
                                <span className="order-label">VAT</span>
                                <span className="order-value">{order.payment.invoice.vatNumber}</span>
                              </div>
                              <div className="order-kv">
                                <span className="order-label">Billing contact</span>
                                <span className="order-value">{order.payment.invoice.billingContact}</span>
                              </div>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="order-items-row">
                    <span className="order-label">Items</span>
                    {editingOrderId === order.id ? (
                      <textarea
                        className="order-textarea"
                        rows="3"
                        value={orderDrafts[order.id]?.itemsText || ""}
                        onChange={(event) =>
                          setOrderDrafts((prev) => ({
                            ...prev,
                            [order.id]: {
                              ...prev[order.id],
                              itemsText: event.target.value,
                            },
                          }))
                        }
                      />
                    ) : (
                      <div className="order-items-chips">
                        {(order.items || []).map((item, idx) => (
                          <span key={`${order.id}-${idx}`} className="order-chip">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {orderActionStatus[order.id]?.message ? (
                    <div className={`order-action-status ${orderActionStatus[order.id].status}`}>
                      {orderActionStatus[order.id].message}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="orders-empty-text">No orders placed yet.</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default withAuthenticationRequired(ProfileComponent, {
  onRedirecting: () => <Loading />,
});
