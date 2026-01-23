import React from "react";
import "./style/MainPageAfterLogin.css";

const categories = [
  { id: "idg", label: "Identity Governance", tooltip: "Manage user lifecycle, compliance and identity policies." },
  { id: "am", label: "Access Management", tooltip: "Define access with roles, SSO, and MFA." },
  { id: "pam", label: "Privileged Identity", tooltip: "Secure, monitor, and control privileged accounts." },
  { id: "ciam", label: "CIAM", tooltip: "Customer login, registration, and self-service profiles." },
];

const ServiceMenu = ({ selected, onSelect }) => {
  return (
    <nav className="service-menu">
      <ul>
        {categories.map((cat) => (
          <li
            key={cat.id}
            className={selected === cat.id ? "active" : ""}
            onClick={() => onSelect(cat.id)}
          >
            {cat.label}
            <span className="tooltip">{cat.tooltip}</span>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default ServiceMenu;
