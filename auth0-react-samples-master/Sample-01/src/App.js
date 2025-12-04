import React from "react";
import { Routes, Route } from "react-router-dom";
import { Container } from "reactstrap";

import Loading from "./components/Loading";
import NavBar from "./components/NavBar";
import Footer from "./components/Footer";
import Home from "./views/Home";
import Profile from "./views/Profile";
import MainPageAfterLogin from "./components/MainPageAfterLogin";
import ExternalApi from "./views/ExternalApi";
import { useAuth0 } from "@auth0/auth0-react";
import ProtectedRoute from "./components/ProtectedRoute";

// styles
import "./App.css";

// fontawesome
import initFontAwesome from "./utils/initFontAwesome";
initFontAwesome();

const App = () => {
  const { error } = useAuth0();

  if (error) {
    return <div>Oops... {error.message}</div>;
  }

  return (
    <div id="app" className="d-flex flex-column h-100">
      <NavBar />

      <Container className="flex-grow-1 mt-5 px-0">
        <Routes>
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
            path="/external-api"
            element={
              <ProtectedRoute>
                <ExternalApi />
              </ProtectedRoute>
            }
          />

          {/* Rotta pubblica */}
          <Route path="/" element={<Home />} />
        </Routes>
      </Container>

      <Footer />
    </div>
  );
};

export default App;
