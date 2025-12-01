/*import React from "react";
import { Container, Row, Col } from "reactstrap";

import Highlight from "../components/Highlight";
import Loading from "../components/Loading";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";

const DEBUG_BYPASS_AUTH = false; // <--- attiva/disattiva autenticazione

export const ProfileComponent = () => {
  const { user } = useAuth0();

  const mockUser = {
    picture: "https://via.placeholder.com/150",
    name: "Test User",
    email: "test@domain.com",
  };

  const currentUser = DEBUG_BYPASS_AUTH ? mockUser : user;

  return (
    <Container className="mb-5">
      <Row className="align-items-center profile-header mb-5 text-center text-md-left">
        <Col md={2}>
          <img
            src={currentUser.picture}
            alt="Profile"
            className="rounded-circle img-fluid profile-picture mb-3 mb-md-0"
          />
        </Col>
        <Col md>
          <h2>{currentUser.name}</h2>
          <p className="lead text-muted">{currentUser.email}</p>
        </Col>
      </Row>
      <Row>
        <Highlight>{JSON.stringify(currentUser, null, 2)}</Highlight>
      </Row>
    </Container>
  );
};

export default withAuthenticationRequired(ProfileComponent, {
  onRedirecting: () => <Loading />,
});

*/
