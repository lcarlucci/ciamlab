import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import styles from "./style/NavBar.module.css";
import { getConfig } from "../config";

const Navbar = () => {
  const { user, loginWithRedirect, logout, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const config = getConfig();
  const [isAdmin, setIsAdmin] = useState(false);
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

  const hasAdminRole = (roles) =>
    roles.some((role) => {
      const normalized = String(role || "").toLowerCase();
      return normalized === "administrator" || normalized === "administator";
    });

  const decodeJwtPayload = (token) => {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    try {
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setIsAdmin(false);
      return;
    }

    const loadRoles = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: config.audience },
        });
        const payload = decodeJwtPayload(token);
        const tokenRoles = [];
        if (payload) {
          Object.entries(payload).forEach(([key, value]) => {
            if (!key.toLowerCase().includes("roles")) return;
            if (Array.isArray(value)) tokenRoles.push(...value);
          });
        }

        if (hasAdminRole(tokenRoles)) {
          setIsAdmin(true);
          return;
        }

        const apiBase = config.apiOrigin || window.location.origin;
        const response = await fetch(`${apiBase}/api/user/roles`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && Array.isArray(data.roles)) {
          setIsAdmin(hasAdminRole(data.roles));
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      }
    };

    loadRoles();
  }, [isAuthenticated, getAccessTokenSilently, config.audience, config.apiOrigin]);

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
          {isAdmin ? (
            <button
              className={styles.apibtn}
              onClick={() => navigate("/admin")}
            >
              Admin
            </button>
          ) : null}
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
