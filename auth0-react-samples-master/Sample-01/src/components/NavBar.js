import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import styles from "./style/NavBar.module.css";

const Navbar = () => {
  const { user, loginWithRedirect, logout, isAuthenticated } = useAuth0();
  const navigate = useNavigate();

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <img
          src={process.env.PUBLIC_URL + "/assets/Deloitteicon.png"}
          alt="Logo"
        />
      </div>

      <div className={styles.userInfo}>
        {isAuthenticated ? (
          <>
            <span
              className={styles.userName}
              onClick={() => navigate("/profile")}
              style={{ cursor: "pointer" }}
            >
              {user.name}
            </span>
            <img
              className={styles.userPic}
              src={user.picture || process.env.PUBLIC_URL + "/assets/placeholder.png"}
              alt="Profile"
              onClick={() => navigate("/profile")}
              style={{ cursor: "pointer" }}
            />
            <button
              className={styles.logoutBtn}
              onClick={() => logout({ returnTo: window.location.origin })}
            >
              Logout
            </button>
          </>
        ) : (
          <button className={styles.loginBtn} onClick={() => loginWithRedirect()}>
            Login
          </button>
        )}
      </div>
    </header>
  );
};

export default Navbar;
