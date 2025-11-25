import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import styles from "./style/NavBar.module.css";

const NavBar = () => {
  const { user, isAuthenticated, loginWithRedirect, logout } = useAuth0();

  const logoutWithRedirect = () =>
    logout({ logoutParams: { returnTo: window.location.origin } });

  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <img
          src="https://logodownload.org/wp-content/uploads/2019/10/deloitte-logo.png"
          alt="Deloitte Logo"
        />
      </div>

      {!isAuthenticated && (
        <button className={styles.loginBtn} onClick={() => loginWithRedirect()}>
          Login
        </button>
      )}

      {isAuthenticated && (
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.name}</span>
          <img className={styles.userPic} src={user.picture} alt="Profile" />
          <button className={styles.logoutBtn} onClick={logoutWithRedirect}>
            Logout
          </button>
        </div>
      )}
    </header>
  );
};

export default NavBar;
