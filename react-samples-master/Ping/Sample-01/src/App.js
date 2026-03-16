import React from "react";
import { Routes, Route } from "react-router-dom";
import { Container } from "reactstrap";

import NavBar from "./components/NavBar";
import Footer from "./components/Footer";
import Home from "./views/Home";
import Profile from "./views/Profile";
import MainPageAfterLogin from "./components/MainPageAfterLogin";
import ExternalApi from "./views/ExternalApi";
import ProtectedRoute from "./components/ProtectedRoute";
import { useUnifiedAuth } from "./auth/AuthContext";
import PingOneCallback from "./auth/PingOneCallback";
import Auth0Callback from "./auth/Auth0Callback";

import "./App.css";
import initFontAwesome from "./utils/initFontAwesome";
initFontAwesome();

const App = () => {
  const { error, isLoading } = useUnifiedAuth();

  if (error) return <div>Oops... {error.message}</div>;
  if (isLoading) return <div>Loading...</div>;

  return (
    <div id="app" className="d-flex flex-column h-100">
      <NavBar />
      <Container className="flex-grow-1 mt-5 px-0">
        <Routes>
          <Route path="/callback/auth0" element={<Auth0Callback />} />
          <Route path="/callback/pingone" element={<PingOneCallback />} />
          {/* Rotte protette */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <MainPageAfterLogin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api"
            element={
              <ProtectedRoute>
                <ExternalApi />
              </ProtectedRoute>
            }
          />
          {/* Rotta pubblica: vetrina */}
          <Route path="/" element={<Home />} />
        </Routes>
      </Container>
      <Footer />
    </div>
  );
};

export default App;
