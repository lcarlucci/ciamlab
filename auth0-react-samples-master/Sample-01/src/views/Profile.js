import React from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import Loading from "../components/Loading";
import "./css/Profile.css";

const DEBUG_BYPASS_AUTH = false;

export const ProfileComponent = () => {
  const { user, getAccessTokenSilently } = useAuth0();

  const mockUser = {
    picture: process.env.PUBLIC_URL + "/assets/placeholder.png",
    name: "Test User",
    email: "test@domain.com",
  };

  const currentUser = DEBUG_BYPASS_AUTH ? mockUser : user;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <img
          src={currentUser?.picture || "/assets/placeholder.png"}
          alt="Profile"
          className="profile-picture"
        />
        <div className="profile-info">
          <h2>{currentUser.name}</h2>
          <p>Email: {currentUser.email}</p>
          <p>Email verificata: {currentUser.email_verified}</p>
          <p>Given Name: {currentUser.given_name}</p>
          <p>Family Name: {currentUser.family_name}</p>
          <p>Compleanno {currentUser.birthdate}</p>
          <p>Info Zone: {currentUser.zoneinfo}</p>
          <p>Telefono: {currentUser.phone_number}</p>
          <p>Telefono Verificato: {currentUser.phone_number_verified}</p>
        </div>
      </div>
    </div>
  );
};

export default withAuthenticationRequired(ProfileComponent, {
  onRedirecting: () => <Loading />,
});
