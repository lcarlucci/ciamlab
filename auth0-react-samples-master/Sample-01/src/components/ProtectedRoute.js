import { useAuth0 } from "@auth0/auth0-react";
import Loading from "./components/Loading";

const ProtectedRoute = ({ component }) => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (isLoading) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    loginWithRedirect();
    return null;
  }

  return component;
};

export default ProtectedRoute;
