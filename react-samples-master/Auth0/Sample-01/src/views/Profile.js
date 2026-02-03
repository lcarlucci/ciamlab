import React, { useEffect, useMemo, useState } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import Loading from "../components/Loading";
import { getConfig } from "../config";
import "./css/Profile.css";

const DEBUG_BYPASS_AUTH = false;
const PASSWORD_RESET_CONNECTION = "Username-Password-Authentication";

export const ProfileComponent = () => {
  const { user, getAccessTokenSilently } = useAuth0();
  const [resetState, setResetState] = useState({ status: "idle", message: "" });
  const [editingField, setEditingField] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [fieldStatus, setFieldStatus] = useState({});
  const config = getConfig();

  const mockUser = {
    picture: process.env.PUBLIC_URL + "/assets/placeholder.png",
    name: "Test User",
    email: "test@domain.com",
    sub: "auth0|test-user",
    user_metadata: {
      phone_number: "+390000000000",
      company: "Deloitte",
    },
  };

  const currentUser = DEBUG_BYPASS_AUTH ? mockUser : user;
  const email = currentUser?.email;
  const provider = currentUser?.sub?.split("|")[0];
  const isDbUser = provider === "auth0";

  const editableFields = useMemo(
    () => [
      { key: "name", label: "Nome completo", placeholder: "Mario Rossi" },
      { key: "given_name", label: "Nome", placeholder: "Mario" },
      { key: "family_name", label: "Cognome", placeholder: "Rossi" },
      {
        key: "email",
        label: "Email (profilo)",
        placeholder: "mario.rossi@azienda.com",
        note: "Non cambia la email di accesso.",
      },
      { key: "phone_number", label: "Telefono", placeholder: "+39 333 123 4567" },
      { key: "birthdate", label: "Data di nascita", placeholder: "1990-01-01" },
      { key: "zoneinfo", label: "Time zone", placeholder: "Europe/Rome" },
      { key: "company", label: "Azienda", placeholder: "Nome Azienda" },
    ],
    []
  );

  useEffect(() => {
    if (!currentUser) return;
    const nextValues = {};
    editableFields.forEach((field) => {
      const metaValue = currentUser?.user_metadata?.[field.key];
      const rootValue = currentUser?.[field.key];
      nextValues[field.key] = metaValue ?? rootValue ?? "";
    });
    setFieldValues(nextValues);
  }, [currentUser, editableFields]);

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

  const handleFieldSave = async (fieldKey) => {
    const value = (fieldValues[fieldKey] || "").trim();
    setFieldStatus((prev) => ({
      ...prev,
      [fieldKey]: { status: "loading", message: "" },
    }));

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: config.audience },
      });

      const apiBase = config.apiOrigin || window.location.origin;
      const response = await fetch(`${apiBase}/api/user/profile`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ field: fieldKey, value }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "Errore durante il salvataggio del profilo.");
      }

      setFieldStatus((prev) => ({
        ...prev,
        [fieldKey]: { status: "success", message: "Aggiornato." },
      }));
      setEditingField(null);
    } catch (err) {
      setFieldStatus((prev) => ({
        ...prev,
        [fieldKey]: {
          status: "error",
          message: err?.message || "Errore durante il salvataggio del profilo.",
        },
      }));
    }
  };

  const handleCancelEdit = (fieldKey) => {
    const metaValue = currentUser?.user_metadata?.[fieldKey];
    const rootValue = currentUser?.[fieldKey];
    const fallbackValue = metaValue ?? rootValue ?? "";
    setFieldValues((prev) => ({ ...prev, [fieldKey]: fallbackValue }));
    setEditingField(null);
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
          <h2>{currentUser?.name || currentUser?.email || "Utente"}</h2>
          <p>Email: {currentUser?.email}</p>
          <p>Email verificata: {String(currentUser?.email_verified)}</p>

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

          <div className="profile-fields">
            {editableFields.map((field) => {
              const status = fieldStatus[field.key];
              const isEditing = editingField === field.key;
              const value = fieldValues[field.key] || "";

              return (
                <div key={field.key} className="profile-field">
                  {!isEditing ? (
                    <div className="field-view">
                      <div className="field-text">
                        <span className="field-label">{field.label}</span>
                        {field.note ? (
                          <span className="field-note">{field.note}</span>
                        ) : null}
                        <span className="field-value">{value || "N/A"}</span>
                      </div>
                      <button
                        className="field-edit-button"
                        onClick={() => setEditingField(field.key)}
                        type="button"
                      >
                        Modifica
                      </button>
                    </div>
                  ) : (
                    <div className="field-edit">
                      <input
                        className="field-input"
                        type="text"
                        value={value}
                        placeholder={field.placeholder}
                        onChange={(event) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
                      />
                      <div className="field-edit-actions">
                        <button
                          className="field-save-button"
                          onClick={() => handleFieldSave(field.key)}
                          disabled={status?.status === "loading"}
                          type="button"
                        >
                          {status?.status === "loading" ? "Salvataggio..." : "Salva"}
                        </button>
                        <button
                          className="field-cancel-button"
                          onClick={() => handleCancelEdit(field.key)}
                          type="button"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}

                  {status?.message ? (
                    <div className={`field-status ${status.status}`}>
                      {status.message}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default withAuthenticationRequired(ProfileComponent, {
  onRedirecting: () => <Loading />,
});
