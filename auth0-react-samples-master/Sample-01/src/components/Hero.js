import React from "react";
import "./style/Hero.css";
import CIAM from "../assets/CIAM.png";
import PAM from "../assets/PAM.png";
import AM from "../assets/AM.png";
import IM from "../assets/IM.png";

const Hero = () => (
  <>
    <section className="hero">
      <h1>Discover the World of Identity & Access Management</h1>
      <p>
        Log in to explore our services tailored for enterprises or contact us
        for more information.
      </p>
    </section>

    <section className="sections">
      <div className="info-card">
        <img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExaWk3aTYxZTRjYTdoeHBhamh4OXhua3lveXN3djhyOHFsd2liczJyeiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ki2FaRevK4g5rlW2tK/giphy.gif" alt="Identity Management" />
        <h3>Identity Management</h3>
        <p>
          Streamline your enterprise identity lifecycle. From provisioning and
          governance to synchronization, manage digital identities efficiently.
        </p>
      </div>

      <div className="info-card">
        <img src={AM} alt="Access Management" />
        <h3>Access Management</h3>
        <p>
          Implement SSO, MFA, and role-based access policies to secure your
          business-critical resources.
        </p>
      </div>

      <div className="info-card">
        <img src={PAM} alt="Privileged Access Management" />
        <h3>Privileged Access Management</h3>
        <p>
          Protect your high-risk accounts with session management, credential
          vaulting, and just-in-time access.
        </p>
      </div>

      <div className="info-card">
        <img src={CIAM} alt="Customer IAM" />
        <h3>CIAM</h3>
        <p>
          Seamless customer experiences: registration, social login, consent,
          and self-service — with enterprise-grade security.
        </p>
      </div>
    </section>
  </>
);

export default Hero;
