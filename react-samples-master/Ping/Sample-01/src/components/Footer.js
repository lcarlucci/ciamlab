import React from "react";

const Footer = () => {
  return (
    <footer style={styles.footer}>
      © Deloitte – Cyber & IAM Services Portal
    </footer>
  );
};

const styles = {
  footer: {
    textAlign: "center",
    padding: "30px",
    background: "#111",
    color: "white",
    marginTop: "40px"
  }
};

export default Footer;
