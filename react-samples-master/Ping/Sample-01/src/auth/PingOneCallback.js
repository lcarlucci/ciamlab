import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Loading from "../components/Loading";
import { useUnifiedAuth } from "./AuthContext";

const PingOneCallback = () => {
  const { completePingOneLogin } = useUnifiedAuth();
  const navigate = useNavigate();

  useEffect(() => {
    completePingOneLogin()
      .then(() => navigate("/home", { replace: true }))
      .catch(() => navigate("/", { replace: true }));
  }, [completePingOneLogin, navigate]);

  return <Loading />;
};

export default PingOneCallback;
