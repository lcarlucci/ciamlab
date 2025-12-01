import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import styles from "./style/NavBar.module.css";

const Navbar = () => {
  const { user, loginWithRedirect, logout, isAuthenticated } = useAuth0();

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
            <span className={styles.userName}>{user.name}</span>
            <img
              className={styles.userPic}
              src={user.picture || process.env.PUBLIC_URL + "/assets/placeholder.png"}
              alt="Profile"
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
