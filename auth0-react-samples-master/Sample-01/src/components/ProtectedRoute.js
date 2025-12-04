import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Loading from "./Loading";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const [triedLogin, setTriedLogin] = useState(false);

  useEffect(() => {
    // Aspetta che isLoading sia false e non abbia già tentato login
    if (!isLoading && !isAuthenticated && !triedLogin) {
      setTriedLogin(true);
      loginWithRedirect({ appState: { returnTo: "/home" } });
    }
  }, [isLoading, isAuthenticated, triedLogin, loginWithRedirect]);

  if (isLoading || (!isAuthenticated && !triedLogin)) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return null; // Evita render prematuro
  }

  return children;
};

export default ProtectedRoute;
