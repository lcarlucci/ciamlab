import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Loading from "./Loading";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (isLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    loginWithRedirect({
      appState: { returnTo: "/home" }
    });
    return null;
  }

  return children;
};

export default ProtectedRoute;
