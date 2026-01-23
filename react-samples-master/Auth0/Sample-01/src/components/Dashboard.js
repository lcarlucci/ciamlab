import React, { useState } from "react";
import Navbar from "../components/Navbar/Navbar";
import MainPageAfterLogin from "../components/MainPageAfterLogin";
import ProfileComponent from "./ProfileComponent";
import { withAuthenticationRequired } from "@auth0/auth0-react";
import Loading from "../components/Loading";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <>
      <Navbar />
      <div style={{ margin: "20px" }}>
        <button onClick={() => setActiveTab("profile")}>Profile</button>
        <button onClick={() => setActiveTab("services")}>Services</button>
      </div>
      {activeTab === "profile" && <ProfileComponent />}
      {activeTab === "services" && <MainPageAfterLogin />}
    </>
  );
};

export default withAuthenticationRequired(Dashboard, {
  onRedirecting: () => <Loading />,
});
