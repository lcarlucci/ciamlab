import React from "react";
import { useUnifiedAuth } from "../auth/AuthContext";
import "./css/Profile.css";

export const ProfileComponent = () => {
  const { user, provider } = useUnifiedAuth();

  return (
    <div className="profile-container">
      <div className="profile-header">
        <img
          src={user?.picture || "/assets/placeholder.png"}
          alt="Profile"
          className="profile-picture"
        />
        <div className="profile-info">
          <h2>{user?.name || user?.preferred_username || "User"}</h2>
          <p>Provider: {provider || "unknown"}</p>
          <p>Email: {user?.email || "n/a"}</p>
          <p>Email verificata: {String(user?.email_verified ?? "n/a")}</p>
          <p>Given Name: {user?.given_name || "n/a"}</p>
          <p>Family Name: {user?.family_name || "n/a"}</p>
          <p>Compleanno {user?.birthdate || "n/a"}</p>
          <p>Info Zone: {user?.zoneinfo || "n/a"}</p>
          <p>Telefono: {user?.phone_number || "n/a"}</p>
          <p>Telefono Verificato: {String(user?.phone_number_verified ?? "n/a")}</p>
        </div>
      </div>
      <pre className="profile-json">{JSON.stringify(user, null, 2)}</pre>
    </div>
  );
};

export default ProfileComponent;
