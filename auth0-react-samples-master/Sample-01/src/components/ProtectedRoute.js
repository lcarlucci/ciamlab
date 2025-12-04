import { useAuth0 } from "@auth0/auth0-react";
import Loading from "./Loading";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  // Se Auth0 sta caricando il token → mostra il loader
  if (isLoading) {
    return <Loading />;
  }

  // Se non è autenticato → redirect login
  if (!isAuthenticated) {
    loginWithRedirect();
    return null;
  }

  // Se è autenticato → mostra la route
  return children;
};

export default ProtectedRoute;
