import React, { useEffect, useMemo, useState } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import Loading from "../components/Loading";
import { getConfig } from "../config";
import "./css/Profile.css";

const DEBUG_BYPASS_AUTH = false;
const PASSWORD_RESET_CONNECTION = "Username-Password-Authentication";

export const ProfileComponent = () => {
  const { user, getAccessTokenSilently } = useAuth0();
  const [resetState, setResetState] = useState({ status: "idle", message: "" });
  const [editingField, setEditingField] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [fieldStatus, setFieldStatus] = useState({});
  const [orders, setOrders] = useState([]);
  const config = getConfig();

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
      nextValues[field.key] = metaValue ?? rootValue ?? "";
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
        setOrders(metadata.orders || []);
        setFieldValues((prev) => {
          const next = { ...prev };
          editableFields.forEach((field) => {
            if (metadata[field.key] !== undefined && metadata[field.key] !== null) {
              next[field.key] = metadata[field.key];
            }
          });
          return next;
        });
      } catch (err) {
        setFieldStatus((prev) => ({
          ...prev,
          metadata: {
            status: "error",
            message: err?.message || "Unable to load profile metadata.",
          },
        }));
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
  };

  return (
    <div className="profile-container">
      <section className="profile-shell">
        <aside className="profile-card">
          <img
            src={currentUser?.picture || "/assets/placeholder.png"}
            alt="Profile"
            className="profile-picture"
          />
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
                          <span className="field-value">{value || "N/A"}</span>
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
                      <div className="order-kv">
                        <span className="order-label">Items</span>
                        <span className="order-value">{(order.items || []).length}</span>
                      </div>
                      <div className="order-kv">
                        <span className="order-label">Subtotal</span>
                        <span className="order-value">
                          {order.totals?.currency || "USD"} {order.totals?.subtotal}
                        </span>
                      </div>
                      <div className="order-kv">
                        <span className="order-label">Price per item</span>
                        <span className="order-value">
                          {order.totals?.currency || "USD"} {order.totals?.pricePerItem}
                        </span>
                      </div>
                    </div>

                    <div className="order-panel">
                      <h4>Billing</h4>
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
                    </div>

                    <div className="order-panel">
                      <h4>Payment</h4>
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
                            <span className="order-label">Expiry</span>
                            <span className="order-value">{order.payment.card.expiry}</span>
                          </div>
                          <div className="order-kv">
                            <span className="order-label">CVV</span>
                            <span className="order-value">{order.payment.card.cvv}</span>
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
                    </div>
                  </div>

                  <div className="order-items-row">
                    <span className="order-label">Items</span>
                    <div className="order-items-chips">
                      {(order.items || []).map((item, idx) => (
                        <span key={`${order.id}-${idx}`} className="order-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
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
