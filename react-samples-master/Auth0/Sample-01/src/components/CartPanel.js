import React from "react";
import "./style/MainPageAfterLogin.css";

const CartPanel = ({ cart, open, onToggle, removeFromCart }) => {
  return (
    <div className={`cart-panel ${open ? "show" : ""}`}>
      <h3>My Cart</h3>
      <div>
        {cart.map((item, idx) => (
          <div key={idx} className="cart-item">
            <span>{item}</span>
            <button onClick={() => removeFromCart(item)}>Remove</button>
          </div>
        ))}
      </div>
      <button className="proceed" onClick={() => alert("Proceed to checkout")}>
        Proceed
      </button>
      <button onClick={onToggle}>{open ? "Close" : "Open"} Cart</button>
    </div>
  );
};

export default CartPanel;
