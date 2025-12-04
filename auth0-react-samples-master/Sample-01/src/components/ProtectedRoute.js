import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Loading from "./Loading";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    // Non fare login automatico qui, lascia la gestione del login al pulsante nella navbar
    return <Loading />; 
  }

  return children;
};

export default ProtectedRoute;
