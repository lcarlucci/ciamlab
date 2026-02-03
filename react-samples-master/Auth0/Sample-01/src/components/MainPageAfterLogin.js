import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import "./style/MainPageAfterLogin.css";

const MainPageAfterLogin = () => {
  const { user } = useAuth0();
  const navigate = useNavigate();

  const [cart, setCart] = useState(() => {
    try {
      const stored = localStorage.getItem("ciam_cart");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [cartVisible, setCartVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState("idg");

  const [serviceValues, setServiceValues] = useState({});

  const categories = [
    { id: "idg", label: "Identity Governance", tooltip: "Manage user lifecycle, compliance and identity policies." },
    { id: "am", label: "Access Management", tooltip: "Define access with roles, SSO, and MFA." },
    { id: "pam", label: "Privileged Identity", tooltip: "Secure, monitor, and control privileged accounts." },
    { id: "ciam", label: "CIAM", tooltip: "Customer login, registration, and self-service profiles." },
  ];

  const servicesData = {
    idg: [
      { title: "User Lifecycle Management", description: "Create, modify and deactivate user accounts.", users: 5000 },
      { title: "Access Certification", description: "Periodic review of user access rights.", users: 1000 },
    ],
    am: [
      { title: "Role-Based Access Control", description: "Define roles and enforce policies.", users: 5000 }
    ],
    pam: [
      { title: "Just-In-Time Access", description: "Grant privileged access only when needed.", users: 200 }
    ],
    ciam: [
      { title: "Customer Registration & Login", description: "Secure customer authentication.", users: 10000 }
    ],
  };

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
    const implType = serviceValues[title]?.implType || "New Implementation";
    const userCount = serviceValues[title]?.users || users;
    const item = `${title} (${implType}, ${userCount} users)`;
    if (!cart.includes(item)) {
      setCart([...cart, item]);
      setCartVisible(true);
    }
  };

  const removeFromCart = (item) => setCart(cart.filter(i => i !== item));

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
            <div className="cart-summary" onClick={proceedToCheckout} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && proceedToCheckout()}>
              <span className="cart-summary-label">Your cart</span>
              <span className="cart-summary-count">{cart.length}</span>
              <span className="cart-summary-text">
                {cart.length === 0 ? "No items yet" : "Items selected"}
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
        {servicesData[activeCategory].map((service, index) => (
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
                  {serviceValues[service.title]?.users || service.users}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="1000000"
                step="1000"
                className="service-range"
                value={serviceValues[service.title]?.users || service.users}
                style={{
                  background: getRangeBackground(
                    Number(serviceValues[service.title]?.users || service.users),
                    1,
                    1000000
                  )
                }}
                onChange={(e) => handleSliderChange(service.title, e.target.value)}
              />

              <label>Implementation type</label>
              <select
                className="service-select"
                value={serviceValues[service.title]?.implType || "New Implementation"}
                onChange={(e) => handleSelectChange(service.title, e.target.value)}
              >
                <option>New Implementation</option>
                <option>Migration from existing</option>
                <option>Evolution</option>
              </select>
            </div>
            <button onClick={() => addToCart(service)}>Add to Cart</button>
          </div>
        ))}
      </section>

      <div className={`cart-panel ${cartVisible ? "show" : ""}`}>
        <h3>My Cart</h3>
        {cart.length === 0 && <p>Your cart is empty.</p>}
        {cart.map((item, idx) => (
          <div key={idx} className="cart-item">
            <span>{item}</span>
            <button onClick={() => removeFromCart(item)}>Remove</button>
          </div>
        ))}
        {cart.length > 0 && (
          <button className="proceed" onClick={proceedToCheckout}>
            Proceed
          </button>
        )}
      </div>

      <button
        className="cart-toggle-btn"
        onClick={() => setCartVisible(!cartVisible)}
        title="Toggle cart"
      >
        Cart
        <span className="cart-badge">{cart.length}</span>
      </button>
    </div>
  );
};

export default MainPageAfterLogin;
