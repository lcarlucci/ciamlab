import React, { useState } from "react";
import styles from "./style/MainPageAfterLogin.css";
import { useAuth0 } from "@auth0/auth0-react";

const MainPageAfterLogin = () => {
  const { user } = useAuth0();
  const [cart, setCart] = useState([]);
  const [cartVisible, setCartVisible] = useState(false);

  const categories = [
    { id: "idg", label: "Identity Governance", tooltip: "Manage user lifecycle, compliance and identity policies." },
    { id: "am", label: "Access Management", tooltip: "Define access with roles, SSO, and MFA." },
    { id: "pam", label: "Privileged Identity", tooltip: "Secure, monitor, and control privileged accounts." },
    { id: "ciam", label: "CIAM", tooltip: "Customer login, registration, and self-service profiles." },
  ];

  const [activeCategory, setActiveCategory] = useState("idg");

  const servicesData = {
    idg: [
      { title: "User Lifecycle Management", description: "Create, modify and deactivate user accounts across systems.", users: 5000 },
      { title: "Access Certification", description: "Periodic review of user access rights to ensure compliance.", users: 1000 },
    ],
    am: [
      { title: "Role-Based Access Control", description: "Define roles and enforce policies for enterprise resources.", users: 5000 },
    ],
    pam: [
      { title: "Just-In-Time Access", description: "Grant privileged access only when needed for limited time.", users: 200 },
    ],
    ciam: [
      { title: "Customer Registration & Login", description: "Secure and seamless registration and login for customers.", users: 10000 },
    ],
  };

  const addToCart = (service, implType, userCount) => {
    const item = `${service} (${implType}, ${userCount} users)`;
    if (!cart.includes(item)) {
      setCart([...cart, item]);
    }
  };

  const removeFromCart = (item) => {
    setCart(cart.filter(i => i !== item));
  };

  return (
    <div className={styles["main-container"]}>
      <h2 className={styles["welcome-title"]}>Welcome, {user.name}!</h2>

      {/* Categorie */}
      <nav className={styles["service-menu"]}>
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

      {/* Catalogo Servizi */}
      <section className={styles["services-catalog"]}>
        {servicesData[activeCategory].map((service, index) => (
          <div key={index} className={styles["service-card"]}>
            <h3>{service.title}</h3>
            <p>{service.description}</p>
            <div className={styles["service-config"]}>
              <label>Users impacted:</label>
              <input
                type="range"
                min="1"
                max="1000000"
                step="1000"
                defaultValue={service.users}
                onInput={(e) => e.target.nextSibling.textContent = e.target.value}
              />
              <span>{service.users}</span>
              <label>Implementation type:</label>
              <select>
                <option>New Implementation</option>
                <option>Migration from existing</option>
                <option>Evolution</option>
              </select>
            </div>
            <button onClick={() => {
              const implType = service.title; // puoi cambiare se vuoi
              const userCount = service.users;
              addToCart(service.title, "New Implementation", userCount);
            }}>Add to Cart</button>
          </div>
        ))}
      </section>

      {/* Carrello */}
      <div className={`${styles["cart-panel"]} ${cartVisible ? "show" : ""}`}>
        <h3>My Cart</h3>
        <div>
          {cart.map((item, idx) => (
            <div key={idx} className={styles["cart-item"]}>
              <span>{item}</span>
              <button onClick={() => removeFromCart(item)}>Remove</button>
            </div>
          ))}
        </div>
        <button className={styles.proceed} onClick={() => alert("Proceed to checkout")}>Proceed</button>
      </div>

      {/* Toggle carrello */}
      <button className={styles["cart-toggle-btn"]} onClick={() => setCartVisible(!cartVisible)}>
        🛒 {cart.length}
      </button>
    </div>
  );
};

export default MainPageAfterLogin;
