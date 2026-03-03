import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getConfig } from "../config";
import "./style/MainPageAfterLogin.css";

const MainPageAfterLogin = () => {
  const { user, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const { apiOrigin = "https://ciamlab.onrender.com", audience } = getConfig();
  const apiBase = apiOrigin.replace(/\/+$/, "");

  const categories = [
    { id: "IGA", label: "Identity Governance", tooltip: "Manage user lifecycle, compliance and identity policies." },
    { id: "am", label: "Access Management", tooltip: "Define access with roles, SSO, and MFA." },
    { id: "pam", label: "Privileged Identity", tooltip: "Secure, monitor, and control privileged accounts." },
    { id: "ciam", label: "CIAM", tooltip: "Customer login, registration, and self-service profiles." },
  ];

  const servicesData = {
    IGA: [
      {
        title: "User Lifecycle Management",
        description: "Create, modify and deactivate user accounts.",
        users: 5000,
        basePrice: 18000,
        perUser: 3.2,
      },
      {
        title: "Access Certification",
        description: "Periodic review of user access rights.",
        users: 1000,
        basePrice: 14000,
        perUser: 2.4,
      },
    ],
    am: [
      {
        title: "Role-Based Access Control",
        description: "Define roles and enforce policies.",
        users: 5000,
        basePrice: 16000,
        perUser: 2.6,
      }
    ],
    pam: [
      {
        title: "Just-In-Time Access",
        description: "Grant privileged access only when needed.",
        users: 200,
        basePrice: 22000,
        perUser: 12.5,
      }
    ],
    ciam: [
      {
        title: "Customer Registration & Login",
        description: "Secure customer authentication.",
        users: 10000,
        basePrice: 20000,
        perUser: 1.4,
      }
    ],
  };

  const servicesCatalog = Object.entries(servicesData).flatMap(([category, services]) =>
    services.map((service) => ({ ...service, category }))
  );

  const formatter = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const numberFormatter = new Intl.NumberFormat("it-IT");
  const DEFAULT_IMPL = "New Implementation";
  const DEFAULT_USERS = 1000;
  const PARTNER_DISCOUNT = 5000;

  const computeServicePrice = (service, users) => {
    const base = service?.basePrice ?? 12000;
    const perUser = service?.perUser ?? 2;
    return Math.round(base + users * perUser);
  };

  const buildCartLabel = (title, implType, users) =>
    `${title} (${implType}, ${users} users)`;

  const normalizeCartItem = (item) => {
    if (!item) return null;
    if (typeof item === "string") {
      const match = item.match(/^(.*) \((.*),\s*([\d.,]+)\s*users\)$/);
      const title = match ? match[1] : item;
      const implType = match ? match[2] : DEFAULT_IMPL;
      const usersRaw = match ? match[3] : `${DEFAULT_USERS}`;
      const users = Number(String(usersRaw).replace(/\D/g, "")) || DEFAULT_USERS;
      const service = servicesCatalog.find((entry) => entry.title === title);
      const price = computeServicePrice(service, users);
      return {
        id: `${title}::${implType}::${users}`,
        title,
        implType,
        users,
        price,
        label: buildCartLabel(title, implType, users),
        category: service?.category?.toUpperCase?.() || "CUSTOM",
      };
    }
    const title = item.title || item.label || "Service";
    const implType = item.implType || DEFAULT_IMPL;
    const users = Number(item.users) || DEFAULT_USERS;
    const service = servicesCatalog.find((entry) => entry.title === title);
    const price = Number(item.price) || computeServicePrice(service, users);
    return {
      id: item.id || `${title}::${implType}::${users}`,
      title,
      implType,
      users,
      price,
      label: item.label || buildCartLabel(title, implType, users),
      category: item.category || service?.category?.toUpperCase?.() || "CUSTOM",
    };
  };

  const [cart, setCart] = useState(() => {
    try {
      const stored = localStorage.getItem("ciam_cart");
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeCartItem).filter(Boolean) : [];
    } catch {
      return [];
    }
  });
  const [cartVisible, setCartVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState("IGA");
  const [serviceValues, setServiceValues] = useState({});
  const [hasPartnerDiscount, setHasPartnerDiscount] = useState(false);
  const [discountChecked, setDiscountChecked] = useState(false);

  const handleSliderChange = (serviceTitle, value) => {
    setServiceValues(prev => ({
      ...prev,
      [serviceTitle]: {
        ...prev[serviceTitle],
        users: value
      }
    }));
  };

  const handleSelectChange = (serviceTitle, value) => {
    setServiceValues(prev => ({
      ...prev,
      [serviceTitle]: {
        ...prev[serviceTitle],
        implType: value
      }
    }));
  };

  const getRangeBackground = (value, min, max) => {
    const pct = ((value - min) / (max - min)) * 100;
    return `linear-gradient(90deg, var(--brand) 0%, var(--brand) ${pct}%, #d9e6d5 ${pct}%, #d9e6d5 100%)`;
  };

  const addToCart = (service) => {
    const { title, users } = service;
    const implType = serviceValues[title]?.implType || DEFAULT_IMPL;
    const userCount = serviceValues[title]?.users || users;
    const price = computeServicePrice(service, Number(userCount));
    const item = {
      id: `${title}::${implType}::${userCount}`,
      title,
      implType,
      users: Number(userCount),
      price,
      label: buildCartLabel(title, implType, userCount),
      category: activeCategory.toUpperCase(),
    };
    setCart((prev) => {
      if (prev.some((entry) => entry.id === item.id)) return prev;
      return [...prev, item];
    });
    setCartVisible(true);
  };

  const removeFromCart = (id) => setCart(cart.filter((item) => item.id !== id));
  const openCart = () => setCartVisible(true);
  const toggleCart = () => setCartVisible((prev) => !prev);
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price || 0), 0);
  const discountValue = hasPartnerDiscount ? PARTNER_DISCOUNT : 0;
  const cartTotal = Math.max(cartSubtotal - discountValue, 0);

  const proceedToCheckout = () => {
    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    const confirmed = window.confirm("Proceed to checkout?");
    if (!confirmed) return;

    navigate("/checkout", { state: { cart } });
  };

  useEffect(() => {
    localStorage.setItem("ciam_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (!user || !audience) return;
    let isMounted = true;

    const loadRoles = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience },
        });
        const response = await fetch(`${apiBase}/api/user/roles`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || "Unable to load roles.");
        }
        const roles = Array.isArray(data.roles) ? data.roles : [];
        const partnerDiscount = roles.some(
          (role) => String(role || "").trim().toLowerCase() === "sconto_partner"
        );
        if (isMounted) {
          setHasPartnerDiscount(partnerDiscount);
          setDiscountChecked(true);
        }
      } catch {
        if (isMounted) {
          setHasPartnerDiscount(false);
          setDiscountChecked(true);
        }
      }
    };

    loadRoles();
    return () => {
      isMounted = false;
    };
  }, [user, audience, apiBase, getAccessTokenSilently]);

  return (
    <div className="main-container">
      <header className="portal-hero">
        <div className="hero-text">
          <span className="eyebrow">Cyber & IAM Services</span>
          <h2 className="welcome-title">Welcome, {user.name}!</h2>
          <p className="hero-subtitle">
            Compose your Identity & Access roadmap by selecting the services you
            need. Adjust scope, delivery model, and users impacted in a few
            clicks.
          </p>
          <div className="hero-actions">
            <button className="primary-cta" onClick={proceedToCheckout}>
              Start with Governance
            </button>
            <div className="cart-summary" onClick={openCart} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openCart()}>
              <span className="cart-summary-label">Your cart</span>
              <span className="cart-summary-count">{cart.length}</span>
              <span className="cart-summary-text">
                {cart.length === 0
                  ? "No items yet"
                  : `Estimated ${formatter.format(cartTotal)}`}
              </span>
            </div>
          </div>
        </div>
        <div className="hero-metrics" />
      </header>

      <nav className="service-menu">
        <ul>
          {categories.map(cat => (
            <li
              key={cat.id}
              className={activeCategory === cat.id ? "active" : ""}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
              <span className="tooltip">{cat.tooltip}</span>
            </li>
          ))}
        </ul>
      </nav>

      <section className="services-catalog">
        {servicesData[activeCategory].map((service, index) => {
          const currentUsers = serviceValues[service.title]?.users || service.users;
          const currentImpl = serviceValues[service.title]?.implType || DEFAULT_IMPL;
          const currentPrice = computeServicePrice(service, Number(currentUsers));

          return (
            <div key={index} className="service-card">
              <div className="service-header">
                <h3>{service.title}</h3>
                <span className="service-tag">{activeCategory.toUpperCase()}</span>
              </div>
              <p>{service.description}</p>
              <div className="service-config">
                <div className="config-row">
                  <label>Users impacted</label>
                  <span className="config-value">
                    {numberFormatter.format(Number(currentUsers))}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100000"
                  step="100"
                  className="service-range"
                  value={currentUsers}
                  style={{
                    background: getRangeBackground(
                      Number(currentUsers),
                      1,
                      100000
                    )
                  }}
                  onChange={(e) => handleSliderChange(service.title, Number(e.target.value))}
                />

                <label>Implementation type</label>
                <select
                  className="service-select"
                  value={currentImpl}
                  onChange={(e) => handleSelectChange(service.title, e.target.value)}
                >
                  <option>New Implementation</option>
                  <option>Migration from existing</option>
                  <option>Evolution</option>
                </select>
              </div>
              <div className="service-price">
                <span>Estimated annual fee</span>
                <strong>{formatter.format(currentPrice)}</strong>
                <small>
                  {numberFormatter.format(Number(currentUsers))} users | {currentImpl}
                </small>
              </div>
              <button onClick={() => addToCart(service)}>Add to Cart</button>
            </div>
          );
        })}
      </section>

      {cartVisible && (
        <div className="cart-overlay" onClick={toggleCart} role="presentation" />
      )}

      <div className={`cart-panel ${cartVisible ? "show" : ""}`}>
        <div className="cart-panel-header">
          <div>
            <span className="cart-panel-kicker">Cart</span>
            <h3>My Cart</h3>
          </div>
          <button className="cart-close" onClick={toggleCart} aria-label="Close cart">
            Close
          </button>
        </div>

        <div className="cart-panel-body">
          {cart.length === 0 && (
            <div className="cart-empty">
              <p>Your cart is empty.</p>
              <span>Add services to create a tailored IAM roadmap.</span>
            </div>
          )}
          {cart.map((item) => (
            <div key={item.id} className="cart-item">
              <div className="cart-item-main">
                <div className="cart-item-title">{item.title}</div>
                <div className="cart-item-meta">
                  {item.implType} | {numberFormatter.format(item.users)} users
                </div>
                <span className="cart-item-tag">{item.category}</span>
              </div>
              <div className="cart-item-side">
                <div className="cart-item-price">{formatter.format(item.price)}</div>
                <button onClick={() => removeFromCart(item.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-panel-footer">
          <div className="cart-total-row">
            <span>Items</span>
            <strong>{cart.length}</strong>
          </div>
          <div className="cart-total-row">
            <span>Subtotal</span>
            <strong>{formatter.format(cartSubtotal)}</strong>
          </div>
          {hasPartnerDiscount && (
            <div className="cart-total-row discount">
              <span>Partner discount</span>
              <strong>-{formatter.format(discountValue)}</strong>
            </div>
          )}
          {!discountChecked && (
            <div className="cart-total-row muted">
              <span>Checking discounts</span>
              <span>...</span>
            </div>
          )}
          <div className="cart-total-row muted">
            <span>Tax & fees</span>
            <span>Calculated at checkout</span>
          </div>
          <div className="cart-total-row total">
            <span>Total</span>
            <strong>{formatter.format(cartTotal)}</strong>
          </div>
          <button className="proceed" onClick={proceedToCheckout} disabled={cart.length === 0}>
            Proceed to checkout
          </button>
        </div>
      </div>

      <button
        className="cart-toggle-btn"
        onClick={toggleCart}
        title="Toggle cart"
        aria-expanded={cartVisible}
      >
        Cart
        <span className="cart-badge">{cart.length}</span>
      </button>
    </div>
  );
};

export default MainPageAfterLogin;
