import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./style/NavBar.module.css";
import { useUnifiedAuth } from "../auth/AuthContext";

const Navbar = () => {
  const {
    user,
    provider,
    loginWithAuth0,
    loginWithPingOne,
    logout,
    isAuthenticated,
  } = useUnifiedAuth();
  const navigate = useNavigate();

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
       <button
          onClick={() => navigate(isAuthenticated ? "/home" : "/")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
          aria-label="Go to home or landing page"
        >
          <img
            src=""//inserire logo qui //es: process.env.PUBLIC_URL + "/assets/logo.png"
            alt=""//inserire alt qui
          />
        </button>
      </div>

      <div className={styles.userInfo}>
        {isAuthenticated ? (
          <>
          <button
              className={styles.apibtn}
              onClick={() => navigate("/api")}
            >
              Api
            </button>
            <span
              className={styles.userName}
              onClick={() => navigate("/profile")}
              style={{ cursor: "pointer" }}
            >
              {user?.name || "User"}
            </span>
            <img
              className={styles.userPic}
              src={user?.picture || process.env.PUBLIC_URL + "/assets/placeholder.png"}
              alt="Profile"
              onClick={() => navigate("/profile")}
              style={{ cursor: "pointer" }}
            />
            <span className={styles.providerBadge}>
              {provider ? provider.toUpperCase() : "UNKNOWN"}
            </span>
            <button
              className={styles.logoutBtn}
              onClick={() => logout()}
            >
              Logout
            </button>
          </>
        ) : (
          <div className={styles.authButtons}>
            <button className={styles.loginBtn} onClick={loginWithAuth0}>
              Login Auth0
            </button>
            <button className={styles.loginBtn} onClick={loginWithPingOne}>
              Login PingOne
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
