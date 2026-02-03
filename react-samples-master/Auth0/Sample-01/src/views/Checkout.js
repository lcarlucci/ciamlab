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
      const stored = localStorage.getItem("ciam_payment_method");
      const allowed = ["card", "paypal", "gpay", "applepay", "invoice"];
      return allowed.includes(stored) ? stored : "card";
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

  const showEnterpriseFields = paymentMethod === "invoice";

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
              <input type="text" placeholder="123 Main St" />
            </div>
            <div className="field">
              <label>City</label>
              <input type="text" placeholder="Milan" />
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
          <h2>Payment method</h2>
          <div className="payment-methods">
            <button
              type="button"
              className={`payment-card ${paymentMethod === "card" ? "active" : ""}`}
              onClick={() => setPaymentMethod("card")}
            >
              <div className="payment-card-header">
                <div className="payment-card-title">
                  <span className="payment-icon" aria-hidden="true">
                    <svg className="payment-logo" viewBox="0 0 48 32">
                      <rect x="1" y="1" width="46" height="30" rx="6" fill="#E8F2FF" stroke="#1A73E8" />
                      <rect x="4" y="6" width="40" height="6" fill="#1A73E8" />
                      <text x="24" y="24" textAnchor="middle" fontSize="9" fontFamily="Arial" fill="#1A73E8">CARD</text>
                    </svg>
                  </span>
                  <span>Credit card</span>
                </div>
                <span className="payment-check" />
              </div>
              <div className="payment-brands">
                <span className="brand-chip visa">VISA</span>
                <span className="brand-chip mc">Mastercard</span>
                <span className="brand-chip amex">AMEX</span>
              </div>
              {paymentMethod === "card" ? (
                <div className="payment-body">
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
                      <label>CVV</label>
                      <input type="text" placeholder="123" />
                    </div>
                    <div className="field full">
                      <label>Cardholder name</label>
                      <input type="text" placeholder="Jane Doe" />
                    </div>
                  </div>
                </div>
              ) : null}
            </button>

            <button
              type="button"
              className={`payment-card ${paymentMethod === "paypal" ? "active" : ""}`}
              onClick={() => setPaymentMethod("paypal")}
            >
              <div className="payment-card-header">
                <div className="payment-card-title">
                  <span className="payment-icon" aria-hidden="true">
                    <svg className="payment-logo" viewBox="0 0 48 32">
                      <rect x="1" y="1" width="46" height="30" rx="6" fill="#F2F6FF" stroke="#003087" />
                      <text x="24" y="20" textAnchor="middle" fontSize="12" fontFamily="Arial" fill="#003087">PayPal</text>
                    </svg>
                  </span>
                  <span>PayPal</span>
                </div>
                <span className="payment-check" />
              </div>
            </button>

            <button
              type="button"
              className={`payment-card ${paymentMethod === "gpay" ? "active" : ""}`}
              onClick={() => setPaymentMethod("gpay")}
            >
              <div className="payment-card-header">
                <div className="payment-card-title">
                  <span className="payment-icon" aria-hidden="true">
                    <svg className="payment-logo" viewBox="0 0 48 32">
                      <rect x="1" y="1" width="46" height="30" rx="6" fill="#FFFFFF" stroke="#1A73E8" />
                      <text x="18" y="20" textAnchor="middle" fontSize="12" fontFamily="Arial" fill="#1A73E8">G</text>
                      <text x="31" y="20" textAnchor="middle" fontSize="10" fontFamily="Arial" fill="#3C4C40">Pay</text>
                    </svg>
                  </span>
                  <span>Google Pay</span>
                </div>
                <span className="payment-check" />
              </div>
            </button>

            <button
              type="button"
              className={`payment-card ${paymentMethod === "applepay" ? "active" : ""}`}
              onClick={() => setPaymentMethod("applepay")}
            >
              <div className="payment-card-header">
                <div className="payment-card-title">
                  <span className="payment-icon" aria-hidden="true">
                    <svg className="payment-logo" viewBox="0 0 48 32">
                      <rect x="1" y="1" width="46" height="30" rx="6" fill="#111111" stroke="#111111" />
                      <text x="16" y="20" textAnchor="middle" fontSize="10" fontFamily="Arial" fill="#FFFFFF">Apple</text>
                      <text x="32" y="20" textAnchor="middle" fontSize="10" fontFamily="Arial" fill="#FFFFFF">Pay</text>
                    </svg>
                  </span>
                  <span>Apple Pay</span>
                </div>
                <span className="payment-check" />
              </div>
            </button>

            <button
              type="button"
              className={`payment-card ${paymentMethod === "invoice" ? "active" : ""}`}
              onClick={() => setPaymentMethod("invoice")}
            >
              <div className="payment-card-header">
                <div className="payment-card-title">
                  <span className="payment-icon" aria-hidden="true">
                    <svg className="payment-logo" viewBox="0 0 48 32">
                      <rect x="1" y="1" width="46" height="30" rx="6" fill="#F4F9EE" stroke="#6A961D" />
                      <rect x="8" y="8" width="20" height="2" fill="#6A961D" />
                      <rect x="8" y="13" width="28" height="2" fill="#6A961D" />
                      <rect x="8" y="18" width="16" height="2" fill="#6A961D" />
                      <text x="34" y="24" textAnchor="middle" fontSize="8" fontFamily="Arial" fill="#6A961D">INV</text>
                    </svg>
                  </span>
                  <span>Invoice</span>
                </div>
                <span className="payment-check" />
              </div>
              {showEnterpriseFields ? (
                <div className="payment-body">
                  <div className="enterprise-fields">
                    <div className="field">
                      <label>PEC email</label>
                      <input type="email" placeholder="pec@company.it" />
                    </div>
                    <div className="field">
                      <label>SDI code</label>
                      <input type="text" placeholder="ABC1234" />
                    </div>
                    <div className="field full">
                      <label>VAT number</label>
                      <input type="text" placeholder="IT12345678901" />
                    </div>
                    <div className="field full">
                      <label>Billing contact</label>
                      <input type="email" placeholder="billing@company.com" />
                    </div>
                  </div>
                </div>
              ) : null}
            </button>
          </div>

          <label className="terms">
            <input type="checkbox" />
            I agree to the terms and privacy policy.
          </label>
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
