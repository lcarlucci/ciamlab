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
  }, [selectedUserId]);

  const handleEditOrder = (order) => {
    setEditingOrderId(order.id);
    setOrderDrafts((prev) => ({
      ...prev,
      [order.id]: prev[order.id] || createOrderDraft(order),
    }));
  };

  const handleCancelEdit = (orderId) => {
    setEditingOrderId(null);
    setOrderDrafts((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  };

  const handleSaveOrder = async (order) => {
    const draft = orderDrafts[order.id];
    if (!draft) return;
    const items = draft.itemsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const pricePerItem = Number(order.totals?.pricePerItem || 12000);

    const { user, userId, ...orderPayload } = order;
    const updatedOrder = {
      ...orderPayload,
      id: order.id,
      status: draft.status,
      items,
      totals: {
        currency: order.totals?.currency || "EUR",
        pricePerItem,
        subtotal: items.length * pricePerItem,
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
        <section className="admin-card">
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

        <section className="admin-card">
          <div className="admin-orders-header">
            <div>
              <h2>Orders</h2>
              <span className="admin-orders-subtitle">
                {selectedUserId === "all"
                  ? "All customers"
                  : selectedUser?.name || "Selected customer"}
              </span>
            </div>
            <div className="admin-orders-meta">
              <span>{filteredOrders.length} orders</span>
              {selectedUser?.email ? <span>{selectedUser.email}</span> : null}
            </div>
          </div>
          <div className="admin-orders">
            {filteredOrders.length === 0 ? (
              <div className="admin-orders-empty">No orders for this customer.</div>
            ) : null}
            {filteredOrders.map((order) => (
              <div key={`${order.id}-${order.user?.id}`} className="admin-order-card">
                <div className="admin-order-header">
                  <div>
                    <div className="admin-order-id">Order {order.id}</div>
                    <div className="admin-order-user">
                      {order.user?.name || "Unknown"} - {order.user?.email || "No email"}
                    </div>
                  </div>
                  <div className="admin-order-actions">
                    <span className="admin-order-status">{order.status || "Paid"}</span>
                    {editingOrderId === order.id ? (
                      <>
                        <button
                          className="admin-action-btn primary"
                          type="button"
                          onClick={() => handleSaveOrder(order)}
                        >
                          Save
                        </button>
                        <button
                          className="admin-action-btn"
                          type="button"
                          onClick={() => handleCancelEdit(order.id)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="admin-action-btn"
                          type="button"
                          onClick={() => handleEditOrder(order)}
                        >
                          Edit
                        </button>
                        <button
                          className="admin-action-btn danger"
                          type="button"
                          onClick={() => handleDeleteOrder(order)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="admin-order-body">
                  <div className="admin-order-kv">
                    <span className="admin-label">Items</span>
                    <span>{(order.items || []).length}</span>
                  </div>
                  <div className="admin-order-kv">
                    <span className="admin-label">Subtotal</span>
                    <span>
                      {order.totals?.currency || "EUR"} {order.totals?.subtotal}
                    </span>
                  </div>
                  <div className="admin-order-kv">
                    <span className="admin-label">Payment</span>
                    <span>{order.payment?.method || "n/a"}</span>
                  </div>
                  <div className="admin-order-kv">
                    <span className="admin-label">Date</span>
                    <span>
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleString()
                        : "n/a"}
                    </span>
                  </div>
                </div>
                {editingOrderId === order.id ? (
                  <div className="admin-order-edit">
                    <div className="admin-edit-field">
                      <label>Status</label>
                      <input
                        className="admin-input"
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
                    <div className="admin-edit-field">
                      <label>Items (one per line)</label>
                      <textarea
                        className="admin-textarea"
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
                    </div>
                  </div>
                ) : (
                  <div className="admin-order-items">
                    {(order.items || []).slice(0, 4).map((item, idx) => (
                      <span key={`${order.id}-${idx}`} className="admin-order-chip">
                        {item}
                      </span>
                    ))}
                    {(order.items || []).length > 4 ? (
                      <span className="admin-order-chip muted">
                        +{(order.items || []).length - 4} more
                      </span>
                    ) : null}
                  </div>
                )}
                {orderActionStatus[order.id]?.message ? (
                  <div className={`admin-action-status ${orderActionStatus[order.id].status}`}>
                    {orderActionStatus[order.id].message}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default withAuthenticationRequired(AdminComponent, {
  onRedirecting: () => <Loading />,
});

