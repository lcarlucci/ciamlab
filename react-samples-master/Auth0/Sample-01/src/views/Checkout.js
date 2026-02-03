import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import "./css/Checkout.css";

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth0();
  const cart = location.state?.cart || [];
  const [paymentMethod, setPaymentMethod] = useState(() => {
    try {
      return localStorage.getItem("ciam_payment_method") || "card";
    } catch {
      return "card";
    }
  });

  const pricePerItem = 12000;
  const subtotal = cart.length * pricePerItem;
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  useEffect(() => {
    localStorage.setItem("ciam_payment_method", paymentMethod);
  }, [paymentMethod]);

  const showEnterpriseFields = paymentMethod === "invoice" || paymentMethod === "po";

  return (
    <div className="checkout-container">
      <header className="checkout-hero">
        <div>
          <span className="checkout-eyebrow">Secure Checkout</span>
          <h1>Finalize Your IAM Services</h1>
          <p>
            Review your cart, confirm billing details, and choose a payment
            method to complete your request.
          </p>
        </div>
        <button className="checkout-secondary" onClick={() => navigate("/home")}>
          Back to Services
        </button>
      </header>

      <div className="checkout-grid">
        <section className="checkout-card">
          <h2>Billing Information</h2>
          <div className="checkout-form">
            <div className="field">
              <label>Full name</label>
              <input
                type="text"
                placeholder="Jane Doe"
                defaultValue={user?.name || ""}
              />
            </div>
            <div className="field">
              <label>Company email</label>
              <input
                type="email"
                placeholder="jane@company.com"
                defaultValue={user?.email || ""}
              />
            </div>
            <div className="field">
              <label>Company</label>
              <input type="text" placeholder="Deloitte" />
            </div>
            <div className="field">
              <label>Phone</label>
              <input
                type="tel"
                placeholder="+39 333 123 4567"
                defaultValue={user?.phone_number || ""}
              />
            </div>
            <div className="field full">
              <label>Billing address</label>
              <input type="text" placeholder="Via Roma 12" />
            </div>
            <div className="field">
              <label>City</label>
              <input type="text" placeholder="Milano" />
            </div>
            <div className="field">
              <label>Country</label>
              <input type="text" placeholder="Italy" />
            </div>
            <div className="field">
              <label>VAT / Tax ID</label>
              <input type="text" placeholder="IT12345678901" />
            </div>
          </div>
        </section>

        <section className="checkout-card">
          <h2>Payment Method</h2>
          <div className="payment-options">
            <label className="payment-option">
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "card"}
                onChange={() => setPaymentMethod("card")}
              />
              Credit / Debit Card
            </label>
            <label className="payment-option">
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "bank"}
                onChange={() => setPaymentMethod("bank")}
              />
              Bank Transfer
            </label>
            <label className="payment-option">
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "invoice"}
                onChange={() => setPaymentMethod("invoice")}
              />
              Pay with invoice
            </label>
            <label className="payment-option">
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === "po"}
                onChange={() => setPaymentMethod("po")}
              />
              Purchase order
            </label>
          </div>

          <div className="checkout-form">
            <div className="field full">
              <label>Card number</label>
              <input type="text" placeholder="1234 5678 9012 3456" />
            </div>
            <div className="field">
              <label>Expiry</label>
              <input type="text" placeholder="MM/YY" />
            </div>
            <div className="field">
              <label>CVC</label>
              <input type="text" placeholder="123" />
            </div>
            <div className="field full">
              <label>Name on card</label>
              <input type="text" placeholder="Jane Doe" />
            </div>
            <label className="terms">
              <input type="checkbox" />
              I agree to the terms and privacy policy.
            </label>
          </div>

          {showEnterpriseFields ? (
            <div className="enterprise-fields">
              <div className="field">
                <label>Purchase order number</label>
                <input type="text" placeholder="PO-2026-0098" />
              </div>
              <div className="field">
                <label>Billing contact</label>
                <input type="email" placeholder="billing@company.com" />
              </div>
              <div className="field full">
                <label>Invoice notes</label>
                <input type="text" placeholder="Cost center, reference, special instructions" />
              </div>
            </div>
          ) : null}
        </section>

        <aside className="checkout-summary">
          <h2>Order Summary</h2>
          {cart.length === 0 ? (
            <p className="empty-cart">Your cart is empty.</p>
          ) : (
            <ul className="summary-list">
              {cart.map((item, idx) => (
                <li key={idx}>
                  <span>{item}</span>
                  <span>{formatter.format(pricePerItem)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="summary-total">
            <span>Subtotal</span>
            <span>{formatter.format(subtotal)}</span>
          </div>
          <div className="summary-total muted">
            <span>Tax & fees</span>
            <span>Calculated at invoicing</span>
          </div>
          <button className="checkout-primary" disabled={cart.length === 0}>
            Place Order
          </button>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
