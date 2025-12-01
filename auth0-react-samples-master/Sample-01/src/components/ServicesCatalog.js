import React from "react";

const services = {
  idg: [
    { title: "User Lifecycle Management", users: 5000 },
    { title: "Access Certification", users: 1000 },
  ],
  am: [{ title: "Role-Based Access Control", users: 5000 }],
  pam: [{ title: "Just-In-Time Access", users: 200 }],
  ciam: [{ title: "Customer Registration & Login", users: 10000 }],
};

const ServicesCatalog = ({ category, addToCart }) => {
  return (
    <section className="services-catalog">
      {services[category].map((service, idx) => (
        <div key={idx} className="service-card">
          <h3>{service.title}</h3>
          <p>Configure your service details here.</p>
          <div className="service-config">
            <label>Users impacted:</label>
            <input type="range" min="1" max="1000000" step="1000" value={service.users} readOnly />
            <span>{service.users}</span>
            <label>Implementation type:</label>
            <select>
              <option>New Implementation</option>
              <option>Migration from existing</option>
              <option>Evolution</option>
            </select>
          </div>
          <button onClick={() => addToCart(`${service.title} (${service.users} users)`)}>
            Add to Cart
          </button>
        </div>
      ))}
    </section>
  );
};

export default ServicesCatalog;
