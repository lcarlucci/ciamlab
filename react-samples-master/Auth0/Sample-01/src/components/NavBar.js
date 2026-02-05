import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import styles from "./style/NavBar.module.css";
import { getConfig } from "../config";
import { getAvatarColor, getInitial } from "../utils/avatar";

const Navbar = () => {
  const { user, loginWithRedirect, logout, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const config = getConfig();
  const [isAdmin, setIsAdmin] = useState(false);
  const avatarSeed = user?.name || user?.email || "";
  const avatarInitial = getInitial(user?.name, user?.email);
  const avatarColor = getAvatarColor(avatarSeed);

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
          onClick={() => navigate("/home")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
          aria-label="Go to home or landing page"
        >
          <img
            src={process.env.PUBLIC_URL + "/assets/deiam-logo.png"}
            alt="DeIAM logo"
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
            <button
              className={styles.userAvatar}
              type="button"
              onClick={() => navigate("/profile")}
              aria-label="Open profile"
            >
              <span
                className={styles.userAvatarCircle}
                style={{ backgroundColor: avatarColor }}
              >
                {avatarInitial}
              </span>
            </button>
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
