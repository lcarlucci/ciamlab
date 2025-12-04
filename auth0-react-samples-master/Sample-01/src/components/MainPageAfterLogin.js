import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import "./style/MainPageAfterLogin.css";

const MainPageAfterLogin = () => {
  const { user } = useAuth0();

  const [cart, setCart] = useState([]);
  const [cartVisible, setCartVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState("idg");

  // Stato per slider e dropdown dei servizi
  const [serviceValues, setServiceValues] = useState({}); 
  // struttura: { "User Lifecycle Management": { users: 5000, implType: "New Implementation" }, ... }

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

  // Aggiorna slider
  const handleSliderChange = (serviceTitle, value) => {
    setServiceValues(prev => ({
      ...prev,
      [serviceTitle]: {
        ...prev[serviceTitle],
        users: value
      }
    }));
  };

  // Aggiorna dropdown
  const handleSelectChange = (serviceTitle, value) => {
    setServiceValues(prev => ({
      ...prev,
      [serviceTitle]: {
        ...prev[serviceTitle],
        implType: value
      }
    }));
  };

  // Aggiungi al carrello usando i valori correnti
  const addToCart = (service) => {
    const { title, users } = service;
    const implType = serviceValues[title]?.implType || "New Implementation";
    const userCount = serviceValues[title]?.users || users;
    const item = `${title} (${implType}, ${userCount} users)`;
    if (!cart.includes(item)) {
      setCart([...cart, item]);
      setCartVisible(true); // apre il carrello automaticamente
    }
  };

  const removeFromCart = (item) => setCart(cart.filter(i => i !== item));

  return (
    <div className="main-container">
      <h2 className="welcome-title">Welcome, {user.name}!</h2>

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
            <h3>{service.title}</h3>
            <p>{service.description}</p>
            <div className="service-config">
              <label>Users impacted:</label>
              <input
                type="range"
                min="1"
                max="1000000"
                step="1000"
                value={serviceValues[service.title]?.users || service.users}
                onChange={(e) => handleSliderChange(service.title, e.target.value)}
              />
              <span>{serviceValues[service.title]?.users || service.users}</span>

              <label>Implementation type:</label>
              <select
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
          <button className="proceed" onClick={() => alert("Proceed to checkout")}>
            Proceed
          </button>
        )}
      </div>

      <button
        className="cart-toggle-btn"
        onClick={() => setCartVisible(!cartVisible)}
        title="Toggle cart"
      >
        🛒 {cart.length}
      </button>
    </div>
  );
};

export default MainPageAfterLogin;
