import React from "react";
import "./style/Hero.css";

const Hero = () => {
  return (
    <>
      {/* HERO SECTION */}
      <section className="hero">
        <h1>Discover the World of Identity & Access Management</h1>
        <p>
          Log in to explore our services tailored for enterprises or contact us
          for more information.
        </p>
      </section>

      {/* SERVICES GRID */}
      <section className="sections">

        <div className="info-card">
          <img
            src="https://tse2.mm.bing.net/th/id/OIP.l0KI0KE3kUum8QuS-NbhYAHaEJ?pid=Api"
            alt="Identity Management"
          />
          <h3>Identity Management</h3>
          <p>
            Streamline your enterprise identity lifecycle. From provisioning and
            governance to synchronization, manage digital identities efficiently
            across your organization.
          </p>
        </div>

        <div className="info-card">
          <img
            src="https://tse3.mm.bing.net/th/id/OIP.rXqVK66sS2TgLW0IU3wz7AHaFY?pid=Api"
            alt="Access Management"
          />
          <h3>Access Management</h3>
          <p>
            Control who accesses what within your enterprise. Implement SSO, MFA
            and role-based access policies to secure your business-critical
            resources.
          </p>
        </div>

        <div className="info-card">
          <img
            src="https://tse1.mm.bing.net/th/id/OIP.uZ2om3hPucUXAdejV_UWjwHaEw?pid=Api"
            alt="Privileged Access Management"
          />
          <h3>Privileged Access Management</h3>
          <p>
            Protect your high-risk accounts with session management,
            credential vaulting and just-in-time access.
          </p>
        </div>

        <div className="info-card">
          <img
            src="https://tse4.mm.bing.net/th/id/OIP.nKjuv8VXyH6G7QOGj7YQzgHaFf?pid=Api"
            alt="Customer IAM"
          />
          <h3>CIAM</h3>
          <p>
            Seamless customer experiences: registration, social login,
            consent and self-service — with enterprise-grade security.
          </p>
        </div>

      </section>
    </>
  );
};

export default Hero;
