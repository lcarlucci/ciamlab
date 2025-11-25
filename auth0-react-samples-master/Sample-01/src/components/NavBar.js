import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const NavBar = () => {
  const { user, isAuthenticated, loginWithRedirect, logout } = useAuth0();

  const logoutWithRedirect = () =>
    logout({ logoutParams: { returnTo: window.location.origin } });

  return (
    <header style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "20px 40px",
      background: "white",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
    }}>
      {/* LOGO */}
      <div className="logo">
        <img
          src="https://logodownload.org/wp-content/uploads/2019/10/deloitte-logo.png"
          alt="Deloitte Logo"
          style={{ height: "40px" }}
        />
      </div>

      {/* LOGIN / USER INFO */}
      <div>
        {!isAuthenticated && (
          <button
            onClick={() => loginWithRedirect()}
            style={{
              backgroundColor: "#86BC25",
              color: "#fff",
              padding: "15px 30px",
              borderRadius: "8px",
              fontWeight: "bold",
              fontSize: "1.1rem",
              border: "none",
              cursor: "pointer",
              transition: "0.3s"
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = "#6a961d")}
            onMouseOut={(e) => (e.target.style.backgroundColor = "#86BC25")}
          >
            Login
          </button>
        )}

        {isAuthenticated && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "20px"
          }}>
            <span style={{ fontWeight: "bold" }}>{user.name}</span>
            <img
              src={user.picture}
              alt="Profile"
              style={{
                width: "45px",
                height: "45px",
                borderRadius: "50%"
              }}
            />
            <button
              onClick={logoutWithRedirect}
              style={{
                backgroundColor: "#333",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer"
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default NavBar;
