import React from "react";
import { Navigate } from "react-router-dom";
import Loading from "./Loading";
import { useUnifiedAuth } from "../auth/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useUnifiedAuth();

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return children;
};

export default ProtectedRoute;
