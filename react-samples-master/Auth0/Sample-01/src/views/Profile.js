import React, { useState } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import Loading from "../components/Loading";
import { getConfig } from "../config";
import "./css/Profile.css";

const DEBUG_BYPASS_AUTH = false;
const PASSWORD_RESET_CONNECTION = "Username-Password-Authentication";

export const ProfileComponent = () => {
  const { user } = useAuth0();
  const [resetState, setResetState] = useState({ status: "idle", message: "" });
  const config = getConfig();

  const mockUser = {
    picture: process.env.PUBLIC_URL + "/assets/placeholder.png",
    name: "Test User",
    email: "test@domain.com",
    sub: "auth0|test-user",
  };

  const currentUser = DEBUG_BYPASS_AUTH ? mockUser : user;
  const email = currentUser?.email;
  const provider = currentUser?.sub?.split("|")[0];
  const isDbUser = provider === "auth0";

  const providerMessage = !isDbUser
    ? provider === "google-oauth2"
      ? "Per cambiare la password vai nelle impostazioni del tuo account Google."
      : provider === "facebook"
        ? "Per cambiare la password vai nelle impostazioni del tuo account Facebook."
        : "Per cambiare la password usa il tuo provider di accesso."
    : "";

  const handlePasswordReset = async () => {
    if (!email) {
      setResetState({ status: "error", message: "Email utente non disponibile." });
      return;
    }

    setResetState({ status: "loading", message: "" });

    try {
      const response = await fetch(
        `https://${config.domain}/dbconnections/change_password`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client_id: config.clientId,
            email,
            connection: PASSWORD_RESET_CONNECTION,
          }),
        }
      );

      const text = await response.text();

      if (!response.ok) {
        throw new Error(text || "Errore durante la richiesta di reset password.");
      }

      setResetState({
        status: "success",
        message: text || "Email di reset inviata.",
      });
    } catch (err) {
      setResetState({
        status: "error",
        message: err?.message || "Errore durante la richiesta di reset password.",
      });
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <img
          src={currentUser?.picture || "/assets/placeholder.png"}
          alt="Profile"
          className="profile-picture"
        />
        <div className="profile-info">
          <h2>{currentUser?.toString?.()}</h2>
          <p>Email: {currentUser?.user}</p>
          <p>Email verificata: {currentUser?.email_verified}</p>
          <p>Given Name: {currentUser?.given_name}</p>
          <p>Family Name: {currentUser?.family_name}</p>
          <p>Compleanno {currentUser?.birthdate}</p>
          <p>Info Zone: {currentUser?.zoneinfo}</p>
          <p>Telefono: {currentUser?.phone_number}</p>
          <p>Telefono Verificato: {currentUser?.phone_number_verified}</p>

          <div className="profile-actions">
            <button
              className="reset-password-button"
              onClick={handlePasswordReset}
              disabled={resetState.status === "loading" || !email || !isDbUser}
              type="button"
            >
              {resetState.status === "loading" ? "Invio..." : "Cambia password"}
            </button>
            {providerMessage ? (
              <div className="reset-password-status info">
                {providerMessage}
              </div>
            ) : null}
            {resetState.message ? (
              <div className={`reset-password-status ${resetState.status}`}>
                {resetState.message}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default withAuthenticationRequired(ProfileComponent, {
  onRedirecting: () => <Loading />,
});
