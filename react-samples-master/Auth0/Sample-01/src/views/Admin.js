import React, { useEffect, useState } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import Loading from "../components/Loading";
import { getConfig } from "../config";
import "./css/Admin.css";

const AdminComponent = () => {
  const { getAccessTokenSilently } = useAuth0();
  const config = getConfig();
  const [isAdmin, setIsAdmin] = useState(null);
  const [overview, setOverview] = useState({ totals: {}, users: [], orders: [] });
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [orderDrafts, setOrderDrafts] = useState({});
  const [orderActionStatus, setOrderActionStatus] = useState({});
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [expandedOrders, setExpandedOrders] = useState({});

  const fallbackAvatar =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>" +
        "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
        "<stop offset='0%' stop-color='#dff5a1'/>" +
        "<stop offset='100%' stop-color='#86bc25'/>" +
        "</linearGradient></defs>" +
        "<rect width='120' height='120' rx='30' fill='url(#g)'/>" +
        "<circle cx='60' cy='46' r='22' fill='white'/>" +
        "<path d='M24 102c8-22 26-34 36-34s28 12 36 34' fill='white'/>" +
      "</svg>"
    );

  const decodeJwtPayload = (token) => {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    try {
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  };

  const hasAdminRole = (roles) =>
    roles.some((role) => {
      const normalized = String(role || "").toLowerCase();
      return normalized === "administrator" || normalized === "administator";
    });

  const createOrderDraft = (order) => ({
    status: order.status || "Paid",
    itemsText: (order.items || []).join("\n"),
    totals: {
      pricePerItem: order.totals?.pricePerItem || 12000,
      currency: order.totals?.currency || "EUR",
    },
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
  });

  const fetchOverview = async (token) => {
    const apiBase = config.apiOrigin || window.location.origin;
    const response = await fetch(`${apiBase}/api/admin/overview`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || "Unable to load admin data.");
    }
    return data;
  };

  useEffect(() => {
    let mounted = true;

    const loadOverview = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: config.audience },
        });

        const payload = decodeJwtPayload(token);
        const tokenRoles = [];
        if (payload) {
          Object.entries(payload).forEach(([key, value]) => {
            if (!key.toLowerCase().includes("roles")) return;
            if (Array.isArray(value)) tokenRoles.push(...value);
          });
        }

        let admin = hasAdminRole(tokenRoles);
        if (!admin) {
          const apiBase = config.apiOrigin || window.location.origin;
          const rolesResponse = await fetch(`${apiBase}/api/user/roles`, {
            headers: { authorization: `Bearer ${token}` },
          });
          const rolesData = await rolesResponse.json().catch(() => ({}));
          if (rolesResponse.ok && Array.isArray(rolesData.roles)) {
            admin = hasAdminRole(rolesData.roles);
          }
        }

        if (!mounted) return;
        setIsAdmin(admin);

        if (!admin) {
          setStatus({ loading: false, error: "" });
          return;
        }

        const data = await fetchOverview(token);
        if (!mounted) return;
        setOverview(data);
        setStatus({ loading: false, error: "" });
      } catch (error) {
        if (!mounted) return;
        setStatus({ loading: false, error: error?.message || "Unable to load admin data." });
        setIsAdmin(false);
      }
    };

    loadOverview();

    return () => {
      mounted = false;
    };
  }, [getAccessTokenSilently, config.audience, config.apiOrigin]);

  const filteredOrders =
    selectedUserId === "all"
      ? overview.orders
      : overview.orders.filter((order) => order.userId === selectedUserId);

  const selectedUser =
    selectedUserId === "all"
      ? null
      : overview.users.find((user) => user.id === selectedUserId);

  useEffect(() => {
    setEditingOrderId(null);
    setExpandedOrders({});
  }, [selectedUserId]);

  const toggleExpanded = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const handleEditOrder = (order) => {
    setEditingOrderId(order.id);
    setExpandedOrders((prev) => ({ ...prev, [order.id]: true }));
    setOrderDrafts((prev) => ({
      ...prev,
      [order.id]: prev[order.id] || createOrderDraft(order),
    }));
  };

  const handleCancelEdit = (orderId) => {
    setEditingOrderId(null);
    setExpandedOrders((prev) => ({ ...prev, [orderId]: false }));
    setOrderDrafts((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  };

  const updateOrderDraft = (orderId, updater) => {
    setOrderDrafts((prev) => {
      const current = prev[orderId] || createOrderDraft(overview.orders.find((o) => o.id === orderId) || {});
      return {
        ...prev,
        [orderId]: updater(current),
      };
    });
  };

  const handleSaveOrder = async (order) => {
    const draft = orderDrafts[order.id];
    if (!draft) return;
    const items = draft.itemsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const pricePerItem = Number(draft?.totals?.pricePerItem || 0);
    const currency = draft?.totals?.currency || "EUR";

    const { user, userId, ...orderPayload } = order;
    const updatedOrder = {
      ...orderPayload,
      id: order.id,
      status: draft.status,
      items,
      totals: {
        currency,
        pricePerItem,
        subtotal: items.length * pricePerItem,
      },
      billing: draft.billing,
      payment: {
        method: draft.payment?.method || "card",
        card: draft.payment?.method === "card" ? draft.payment.card : null,
        invoice: draft.payment?.method === "invoice" ? draft.payment.invoice : null,
      },
    };

    setOrderActionStatus((prev) => ({
      ...prev,
      [order.id]: { status: "loading", message: "" },
    }));

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: config.audience },
      });
      const apiBase = config.apiOrigin || window.location.origin;
      const response = await fetch(`${apiBase}/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: order.userId || order.user?.id, order: updatedOrder }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to update order.");
      }

      const refreshed = await fetchOverview(token);
      setOverview(refreshed);
      setEditingOrderId(null);
      setOrderActionStatus((prev) => ({
        ...prev,
        [order.id]: { status: "success", message: "Order updated." },
      }));
    } catch (error) {
      setOrderActionStatus((prev) => ({
        ...prev,
        [order.id]: {
          status: "error",
          message: error?.message || "Unable to update order.",
        },
      }));
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm("Delete this order? This action cannot be undone.")) {
      return;
    }

    setOrderActionStatus((prev) => ({
      ...prev,
      [order.id]: { status: "loading", message: "" },
    }));

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: config.audience },
      });
      const apiBase = config.apiOrigin || window.location.origin;
      const response = await fetch(
        `${apiBase}/api/admin/orders/${order.id}?userId=${encodeURIComponent(order.userId || order.user?.id || "")}`,
        {
          method: "DELETE",
          headers: {
            authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to delete order.");
      }

      const refreshed = await fetchOverview(token);
      setOverview(refreshed);
      setEditingOrderId(null);
      setOrderActionStatus((prev) => ({
        ...prev,
        [order.id]: { status: "success", message: "Order deleted." },
      }));
    } catch (error) {
      setOrderActionStatus((prev) => ({
        ...prev,
        [order.id]: {
          status: "error",
          message: error?.message || "Unable to delete order.",
        },
      }));
    }
  };

  if (status.loading) {
    return <div className="admin-loading">Loading admin dashboard...</div>;
  }

  if (status.error) {
    return (
      <div className="admin-container">
        <div className="admin-hero">
          <div>
            <span className="admin-eyebrow">Admin Center</span>
            <h1>Dashboard unavailable</h1>
            <p>{status.error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="admin-container">
        <div className="admin-hero">
          <div>
            <span className="admin-eyebrow">Admin Center</span>
            <h1>Access restricted</h1>
            <p>This area is available only to administrators.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <header className="admin-hero">
        <div>
          <span className="admin-eyebrow">Admin Center</span>
          <h1>Identity Operations Dashboard</h1>
          <p>
            Monitor users, orders, and fulfillment data in a single command
            center.
          </p>
        </div>
        <div className="admin-hero-badge">Administrator</div>
      </header>

      <section className="admin-stats">
        <div className="admin-stat-card">
          <span className="stat-label">Total users</span>
          <span className="stat-value">{overview.totals?.users || 0}</span>
          <span className="stat-meta">Active identities</span>
        </div>
        <div className="admin-stat-card">
          <span className="stat-label">Orders</span>
          <span className="stat-value">{overview.totals?.orders || 0}</span>
          <span className="stat-meta">Across all accounts</span>
        </div>
        <div className="admin-stat-card">
          <span className="stat-label">Revenue</span>
          <span className="stat-value">
            EUR {Number(overview.totals?.revenue || 0).toLocaleString("it-IT")}
          </span>
          <span className="stat-meta">Gross, simulated</span>
        </div>
      </section>

      <div className="admin-grid">
        <section className="admin-card admin-people-panel">
          <h2>People</h2>
          <div className="admin-users">
            <button
              type="button"
              className={`admin-user-card ${selectedUserId === "all" ? "active" : ""}`}
              onClick={() => setSelectedUserId("all")}
              aria-pressed={selectedUserId === "all"}
            >
              <div className="admin-user-avatar all">ALL</div>
              <div>
                <div className="admin-user-name">All customers</div>
                <div className="admin-user-email">Show every order</div>
              </div>
              <div className="admin-user-meta">
                <span>{overview.orders.length} orders</span>
                <span>{overview.users.length} users</span>
              </div>
            </button>
            {overview.users.map((user) => (
              <button
                key={user.id}
                type="button"
                className={`admin-user-card ${selectedUserId === user.id ? "active" : ""}`}
                onClick={() => setSelectedUserId(user.id)}
                aria-pressed={selectedUserId === user.id}
              >
                <img
                  src={user.picture || fallbackAvatar}
                  alt="User avatar"
                  className="admin-user-avatar"
                />
                <div>
                  <div className="admin-user-name">{user.name || "Unnamed user"}</div>
                  <div className="admin-user-email">{user.email || "No email"}</div>
                </div>
                <div className="admin-user-meta">
                  <span>{(user.orders || []).length} orders</span>
                  <span>{user.metadata?.company || "No company"}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="admin-card admin-orders-panel">
          <h2 className="admin-orders-title">Orders</h2>
          <div className="admin-orders-header">
            <span className="admin-orders-subtitle">
              {selectedUserId === "all"
                ? "All customers"
                : selectedUser?.name || "Selected customer"}
            </span>
            <div className="admin-orders-meta">
              <span>{filteredOrders.length} orders</span>
              {selectedUser?.email ? <span>{selectedUser.email}</span> : null}
            </div>
          </div>
          <div className="admin-orders">
            {filteredOrders.length === 0 ? (
              <div className="admin-orders-empty">No orders for this customer.</div>
            ) : null}
            {filteredOrders.map((order) => {
              const isExpanded = !!expandedOrders[order.id];
              const isEditing = editingOrderId === order.id;
              const draft = orderDrafts[order.id] || createOrderDraft(order);

              return (
              <div
                key={`${order.id}-${order.user?.id}`}
                className={`admin-order-card ${isExpanded ? "expanded" : ""} ${isEditing ? "editing" : ""} ${!isEditing ? "clickable" : ""}`}
                onClick={() => {
                  if (!isEditing) {
                    toggleExpanded(order.id);
                  }
                }}
              >
                <div className="admin-order-header">
                  <div>
                    <div className="admin-order-id">Order {order.id}</div>
                    <div className="admin-order-user">
                      {order.user?.name || "Unknown"} - {order.user?.email || "No email"}
                    </div>
                  </div>
                  <div className="admin-order-actions">
                    <span className="admin-order-status">{order.status || "Paid"}</span>
                    {isEditing ? (
                      <>
                        <button
                          className="admin-action-btn primary"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSaveOrder(order);
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="admin-action-btn"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCancelEdit(order.id);
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="admin-action-btn"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEditOrder(order);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="admin-action-btn danger"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteOrder(order);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="admin-order-summary">
                  <div className="admin-summary-item">
                    <span className="admin-label">Items</span>
                    <span>{(order.items || []).length}</span>
                  </div>
                  <div className="admin-summary-item">
                    <span className="admin-label">Subtotal</span>
                    <span>
                      {order.totals?.currency || "EUR"} {order.totals?.subtotal}
                    </span>
                  </div>
                  <div className="admin-summary-item">
                    <span className="admin-label">Payment</span>
                    <span>{order.payment?.method || "n/a"}</span>
                  </div>
                  <div className="admin-summary-item">
                    <span className="admin-label">Date</span>
                    <span>
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleString()
                        : "n/a"}
                    </span>
                  </div>
                </div>

                {isEditing ? (
                  <div className="admin-order-edit">
                    <div className="admin-edit-section">
                      <h4>Order</h4>
                      <div className="admin-edit-grid">
                        <div className="admin-edit-field">
                          <label>Status</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={draft.status || ""}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                status: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="admin-edit-field">
                          <label>Price per item</label>
                          <input
                            className="admin-input"
                            type="number"
                            value={draft.totals?.pricePerItem || ""}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                totals: {
                                  ...current.totals,
                                  pricePerItem: Number(event.target.value || 0),
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="admin-edit-field">
                          <label>Currency</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={draft.totals?.currency || ""}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                totals: {
                                  ...current.totals,
                                  currency: event.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="admin-edit-section">
                      <h4>Billing</h4>
                      <div className="admin-edit-grid">
                        <div className="admin-edit-field">
                          <label>Full name</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={draft.billing?.fullName || ""}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                billing: { ...current.billing, fullName: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="admin-edit-field">
                          <label>Email</label>
                          <input
                            className="admin-input"
                            type="email"
                            value={draft.billing?.email || ""}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                billing: { ...current.billing, email: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="admin-edit-field">
                          <label>Company</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={draft.billing?.company || ""}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                billing: { ...current.billing, company: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="admin-edit-field">
                          <label>Phone</label>
                          <input
                            className="admin-input"
                            type="tel"
                            value={draft.billing?.phone || ""}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                billing: { ...current.billing, phone: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="admin-edit-field">
                          <label>Address</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={draft.billing?.address || ""}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                billing: { ...current.billing, address: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="admin-edit-field">
                          <label>City</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={draft.billing?.city || ""}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                billing: { ...current.billing, city: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="admin-edit-field">
                          <label>Country</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={draft.billing?.country || ""}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                billing: { ...current.billing, country: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="admin-edit-field">
                          <label>VAT / Tax ID</label>
                          <input
                            className="admin-input"
                            type="text"
                            value={draft.billing?.vat || ""}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                billing: { ...current.billing, vat: event.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="admin-edit-section">
                      <h4>Payment</h4>
                      <div className="admin-edit-grid">
                        <div className="admin-edit-field">
                          <label>Method</label>
                          <select
                            className="admin-input"
                            value={draft.payment?.method || "card"}
                            onChange={(event) =>
                              updateOrderDraft(order.id, (current) => ({
                                ...current,
                                payment: { ...current.payment, method: event.target.value },
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

                        {draft.payment?.method === "card" ? (
                          <>
                            <div className="admin-edit-field">
                              <label>Card number</label>
                              <input
                                className="admin-input"
                                type="text"
                                value={draft.payment?.card?.number || ""}
                                onChange={(event) =>
                                  updateOrderDraft(order.id, (current) => ({
                                    ...current,
                                    payment: {
                                      ...current.payment,
                                      card: { ...current.payment.card, number: event.target.value },
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="admin-edit-field">
                              <label>Expiry</label>
                              <input
                                className="admin-input"
                                type="text"
                                value={draft.payment?.card?.expiry || ""}
                                onChange={(event) =>
                                  updateOrderDraft(order.id, (current) => ({
                                    ...current,
                                    payment: {
                                      ...current.payment,
                                      card: { ...current.payment.card, expiry: event.target.value },
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="admin-edit-field">
                              <label>CVV</label>
                              <input
                                className="admin-input"
                                type="text"
                                value={draft.payment?.card?.cvv || ""}
                                onChange={(event) =>
                                  updateOrderDraft(order.id, (current) => ({
                                    ...current,
                                    payment: {
                                      ...current.payment,
                                      card: { ...current.payment.card, cvv: event.target.value },
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="admin-edit-field">
                              <label>Cardholder</label>
                              <input
                                className="admin-input"
                                type="text"
                                value={draft.payment?.card?.holder || ""}
                                onChange={(event) =>
                                  updateOrderDraft(order.id, (current) => ({
                                    ...current,
                                    payment: {
                                      ...current.payment,
                                      card: { ...current.payment.card, holder: event.target.value },
                                    },
                                  }))
                                }
                              />
                            </div>
                          </>
                        ) : null}

                        {draft.payment?.method === "invoice" ? (
                          <>
                            <div className="admin-edit-field">
                              <label>PEC email</label>
                              <input
                                className="admin-input"
                                type="email"
                                value={draft.payment?.invoice?.pecEmail || ""}
                                onChange={(event) =>
                                  updateOrderDraft(order.id, (current) => ({
                                    ...current,
                                    payment: {
                                      ...current.payment,
                                      invoice: { ...current.payment.invoice, pecEmail: event.target.value },
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="admin-edit-field">
                              <label>SDI code</label>
                              <input
                                className="admin-input"
                                type="text"
                                value={draft.payment?.invoice?.sdiCode || ""}
                                onChange={(event) =>
                                  updateOrderDraft(order.id, (current) => ({
                                    ...current,
                                    payment: {
                                      ...current.payment,
                                      invoice: { ...current.payment.invoice, sdiCode: event.target.value },
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="admin-edit-field">
                              <label>VAT number</label>
                              <input
                                className="admin-input"
                                type="text"
                                value={draft.payment?.invoice?.vatNumber || ""}
                                onChange={(event) =>
                                  updateOrderDraft(order.id, (current) => ({
                                    ...current,
                                    payment: {
                                      ...current.payment,
                                      invoice: { ...current.payment.invoice, vatNumber: event.target.value },
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="admin-edit-field">
                              <label>Billing contact</label>
                              <input
                                className="admin-input"
                                type="email"
                                value={draft.payment?.invoice?.billingContact || ""}
                                onChange={(event) =>
                                  updateOrderDraft(order.id, (current) => ({
                                    ...current,
                                    payment: {
                                      ...current.payment,
                                      invoice: { ...current.payment.invoice, billingContact: event.target.value },
                                    },
                                  }))
                                }
                              />
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="admin-edit-section full">
                      <h4>Items</h4>
                      <textarea
                        className="admin-textarea"
                        rows="4"
                        value={draft.itemsText || ""}
                        onChange={(event) =>
                          updateOrderDraft(order.id, (current) => ({
                            ...current,
                            itemsText: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : null}

                {isExpanded && !isEditing ? (
                  <>
                    <div className="admin-order-details">
                      <div className="admin-details-block">
                        <h4>Billing</h4>
                        <div className="admin-details-grid">
                          <div>
                            <span className="admin-label">Full name</span>
                            <span>{order.billing?.fullName || "n/a"}</span>
                          </div>
                          <div>
                            <span className="admin-label">Email</span>
                            <span>{order.billing?.email || "n/a"}</span>
                          </div>
                          <div>
                            <span className="admin-label">Company</span>
                            <span>{order.billing?.company || "n/a"}</span>
                          </div>
                          <div>
                            <span className="admin-label">Phone</span>
                            <span>{order.billing?.phone || "n/a"}</span>
                          </div>
                          <div>
                            <span className="admin-label">Address</span>
                            <span>
                              {order.billing?.address || "n/a"},{" "}
                              {order.billing?.city || "n/a"},{" "}
                              {order.billing?.country || "n/a"}
                            </span>
                          </div>
                          <div>
                            <span className="admin-label">VAT / Tax ID</span>
                            <span>{order.billing?.vat || "n/a"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="admin-details-block">
                        <h4>Payment</h4>
                        <div className="admin-details-grid">
                          <div>
                            <span className="admin-label">Method</span>
                            <span>{order.payment?.method || "n/a"}</span>
                          </div>
                          {order.payment?.card ? (
                            <>
                              <div>
                                <span className="admin-label">Card number</span>
                                <span>{order.payment.card.number || "n/a"}</span>
                              </div>
                              <div>
                                <span className="admin-label">Cardholder</span>
                                <span>{order.payment.card.holder || "n/a"}</span>
                              </div>
                            </>
                          ) : null}
                          {order.payment?.invoice ? (
                            <>
                              <div>
                                <span className="admin-label">PEC</span>
                                <span>{order.payment.invoice.pecEmail || "n/a"}</span>
                              </div>
                              <div>
                                <span className="admin-label">SDI</span>
                                <span>{order.payment.invoice.sdiCode || "n/a"}</span>
                              </div>
                              <div>
                                <span className="admin-label">VAT</span>
                                <span>{order.payment.invoice.vatNumber || "n/a"}</span>
                              </div>
                              <div>
                                <span className="admin-label">Billing contact</span>
                                <span>{order.payment.invoice.billingContact || "n/a"}</span>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="admin-order-items">
                      {(order.items || []).map((item, idx) => (
                        <span key={`${order.id}-${idx}`} className="admin-order-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
                {orderActionStatus[order.id]?.message ? (
                  <div className={`admin-action-status ${orderActionStatus[order.id].status}`}>
                    {orderActionStatus[order.id].message}
                  </div>
                ) : null}
              </div>
            )})}
          </div>
        </section>
      </div>
    </div>
  );
};

export default withAuthenticationRequired(AdminComponent, {
  onRedirecting: () => <Loading />,
});

