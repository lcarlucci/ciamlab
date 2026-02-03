import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import styles from "./style/NavBar.module.css";

const Navbar = () => {
  const { user, loginWithRedirect, logout, isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const fallbackAvatar =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>" +
        "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
        "<stop offset='0%' stop-color='#dff5a1'/>" +
        "<stop offset='100%' stop-color='#86bc25'/>" +
        "</linearGradient></defs>" +
        "<rect width='120' height='120' rx='30' fill='url(#g)'/>" +
        "<circle cx='60' cy='46' r='22' fill='white'/>" +
        "<path d='M24 102c8-22 26-34 36-34s28 12 36 34' fill='white'/>" +
      "</svg>"
    );

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
              onClick={() => navigate("/home")}
            >
              Home
            </button>
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
              {user.name}
            </span>
            <img
              className={styles.userPic}
              src={user.picture || fallbackAvatar}
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
          <button
            className={styles.loginBtn}
            onClick={() =>
              loginWithRedirect({ appState: { returnTo: "/home" } })
            }
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
};

export default Navbar;
