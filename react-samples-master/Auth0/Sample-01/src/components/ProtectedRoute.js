import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Loading from "./Loading";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <Loading />;  // Mostra loader finché Auth0 verifica
  if (!isAuthenticated) return <Loading />; // Non fare login automatico qui, Navbar gestisce login

  return children;
};

export default ProtectedRoute;
