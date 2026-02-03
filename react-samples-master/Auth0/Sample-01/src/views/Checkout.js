import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getConfig } from "../config";
import "./css/Checkout.css";

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, getAccessTokenSilently } = useAuth0();
  const config = getConfig();
  const cart = location.state?.cart || [];
  const [storedCart, setStoredCart] = useState(() => {
    try {
      const stored = localStorage.getItem("ciam_cart");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const effectiveCart = cart.length ? cart : storedCart;
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
  const subtotal = effectiveCart.length * pricePerItem;
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  useEffect(() => {
    localStorage.setItem("ciam_payment_method", paymentMethod);
  }, [paymentMethod]);

  const showEnterpriseFields = paymentMethod === "invoice";

  const [billing, setBilling] = useState({
    fullName: user?.name || "",
    email: user?.email || "",
    company: "",
    phone: user?.phone_number || "",
    address: "",
    city: "",
    country: "Italy",
    vat: "",
  });

  const [card, setCard] = useState({
    number: "",
    expiry: "",
    cvv: "",
    holder: "",
  });

  const [invoice, setInvoice] = useState({
    pecEmail: "",
    sdiCode: "",
    vatNumber: "",
    billingContact: "",
  });

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    if (!user) return;
    setBilling((prev) => ({
      ...prev,
      fullName: prev.fullName || user?.name || "",
      email: prev.email || user?.email || "",
      phone: prev.phone || user?.phone_number || "",
    }));
  }, [user]);

  const validate = () => {
    const nextErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[+]?[\d\s().-]{6,}$/;
    const vatRegex = /^(IT)?\d{11}$/i;
    const sdiRegex = /^[A-Za-z0-9]{7}$/;

    if (!billing.fullName.trim()) nextErrors.fullName = "Full name is required.";
    if (!emailRegex.test(billing.email || "")) nextErrors.email = "Valid email is required.";
    if (!billing.company.trim()) nextErrors.company = "Company is required.";
    if (!phoneRegex.test(billing.phone || "")) nextErrors.phone = "Valid phone is required.";
    if (!billing.address.trim()) nextErrors.address = "Billing address is required.";
    if (!billing.city.trim()) nextErrors.city = "City is required.";
    if (!billing.country.trim()) nextErrors.country = "Country is required.";
    if (!billing.vat.trim()) nextErrors.vat = "VAT / Tax ID is required.";
    if (!termsAccepted) nextErrors.terms = "Please accept terms and privacy policy.";

    if (paymentMethod === "card") {
      if (!card.number.trim()) nextErrors.cardNumber = "Card number is required.";
      if (!card.expiry.trim()) nextErrors.cardExpiry = "Expiry is required.";
      if (!card.cvv.trim()) nextErrors.cardCvv = "CVV is required.";
      if (!card.holder.trim()) nextErrors.cardHolder = "Cardholder name is required.";
    }

    if (paymentMethod === "invoice") {
      if (!emailRegex.test(invoice.pecEmail || "")) nextErrors.pecEmail = "Valid PEC email is required.";
      if (!sdiRegex.test(invoice.sdiCode || "")) nextErrors.sdiCode = "SDI code must be 7 characters.";
      if (!vatRegex.test(invoice.vatNumber || "")) nextErrors.vatNumber = "Valid VAT number is required.";
      if (!emailRegex.test(invoice.billingContact || "")) nextErrors.billingContact = "Valid billing contact email is required.";
    }

    return nextErrors;
  };

  const handlePlaceOrder = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitState({ status: "error", message: "Please fix the highlighted fields." });
      return;
    }

    setSubmitState({ status: "loading", message: "" });

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: config.audience },
      });

      const apiBase = config.apiOrigin || window.location.origin;
      const order = {
        id: `ord_${Date.now()}`,
        createdAt: new Date().toISOString(),
        items: effectiveCart,
        totals: {
          subtotal,
          pricePerItem,
          currency: "USD",
        },
        billing,
        payment: {
          method: paymentMethod,
          card: paymentMethod === "card" ? card : null,
          invoice: paymentMethod === "invoice" ? invoice : null,
        },
      };

      const response = await fetch(`${apiBase}/api/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Error while placing order.");
      }

      localStorage.setItem("ciam_cart", "[]");
      setStoredCart([]);
      setSubmitState({ status: "success", message: "Order placed successfully." });
    } catch (err) {
      setSubmitState({
        status: "error",
        message: err?.message || "Error while placing order.",
      });
    }
  };

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
                value={billing.fullName}
                onChange={(event) =>
                  setBilling((prev) => ({ ...prev, fullName: event.target.value }))
                }
              />
              {errors.fullName ? <span className="field-error">{errors.fullName}</span> : null}
            </div>
            <div className="field">
              <label>Company email</label>
              <input
                type="email"
                placeholder="jane@company.com"
                value={billing.email}
                onChange={(event) =>
                  setBilling((prev) => ({ ...prev, email: event.target.value }))
                }
              />
              {errors.email ? <span className="field-error">{errors.email}</span> : null}
            </div>
            <div className="field">
              <label>Company</label>
              <input
                type="text"
                placeholder="Deloitte"
                value={billing.company}
                onChange={(event) =>
                  setBilling((prev) => ({ ...prev, company: event.target.value }))
                }
              />
              {errors.company ? <span className="field-error">{errors.company}</span> : null}
            </div>
            <div className="field">
              <label>Phone</label>
              <input
                type="tel"
                placeholder="+39 333 123 4567"
                value={billing.phone}
                onChange={(event) =>
                  setBilling((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
              {errors.phone ? <span className="field-error">{errors.phone}</span> : null}
            </div>
            <div className="field full">
              <label>Billing address</label>
              <input
                type="text"
                placeholder="123 Main St"
                value={billing.address}
                onChange={(event) =>
                  setBilling((prev) => ({ ...prev, address: event.target.value }))
                }
              />
              {errors.address ? <span className="field-error">{errors.address}</span> : null}
            </div>
            <div className="field">
              <label>City</label>
              <input
                type="text"
                placeholder="Milan"
                value={billing.city}
                onChange={(event) =>
                  setBilling((prev) => ({ ...prev, city: event.target.value }))
                }
              />
              {errors.city ? <span className="field-error">{errors.city}</span> : null}
            </div>
            <div className="field">
              <label>Country</label>
              <input
                type="text"
                placeholder="Italy"
                value={billing.country}
                onChange={(event) =>
                  setBilling((prev) => ({ ...prev, country: event.target.value }))
                }
              />
              {errors.country ? <span className="field-error">{errors.country}</span> : null}
            </div>
            <div className="field">
              <label>VAT / Tax ID</label>
              <input
                type="text"
                placeholder="IT12345678901"
                value={billing.vat}
                onChange={(event) =>
                  setBilling((prev) => ({ ...prev, vat: event.target.value }))
                }
              />
              {errors.vat ? <span className="field-error">{errors.vat}</span> : null}
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
                      <input
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        value={card.number}
                        onChange={(event) =>
                          setCard((prev) => ({ ...prev, number: event.target.value }))
                        }
                      />
                      {errors.cardNumber ? <span className="field-error">{errors.cardNumber}</span> : null}
                    </div>
                    <div className="field">
                      <label>Expiry</label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        value={card.expiry}
                        onChange={(event) =>
                          setCard((prev) => ({ ...prev, expiry: event.target.value }))
                        }
                      />
                      {errors.cardExpiry ? <span className="field-error">{errors.cardExpiry}</span> : null}
                    </div>
                    <div className="field">
                      <label>CVV</label>
                      <input
                        type="text"
                        placeholder="123"
                        value={card.cvv}
                        onChange={(event) =>
                          setCard((prev) => ({ ...prev, cvv: event.target.value }))
                        }
                      />
                      {errors.cardCvv ? <span className="field-error">{errors.cardCvv}</span> : null}
                    </div>
                    <div className="field full">
                      <label>Cardholder name</label>
                      <input
                        type="text"
                        placeholder="Jane Doe"
                        value={card.holder}
                        onChange={(event) =>
                          setCard((prev) => ({ ...prev, holder: event.target.value }))
                        }
                      />
                      {errors.cardHolder ? <span className="field-error">{errors.cardHolder}</span> : null}
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
                      <input
                        type="email"
                        placeholder="pec@company.it"
                        value={invoice.pecEmail}
                        onChange={(event) =>
                          setInvoice((prev) => ({ ...prev, pecEmail: event.target.value }))
                        }
                      />
                      {errors.pecEmail ? <span className="field-error">{errors.pecEmail}</span> : null}
                    </div>
                    <div className="field">
                      <label>SDI code</label>
                      <input
                        type="text"
                        placeholder="ABC1234"
                        value={invoice.sdiCode}
                        onChange={(event) =>
                          setInvoice((prev) => ({ ...prev, sdiCode: event.target.value }))
                        }
                      />
                      {errors.sdiCode ? <span className="field-error">{errors.sdiCode}</span> : null}
                    </div>
                    <div className="field full">
                      <label>VAT number</label>
                      <input
                        type="text"
                        placeholder="IT12345678901"
                        value={invoice.vatNumber}
                        onChange={(event) =>
                          setInvoice((prev) => ({ ...prev, vatNumber: event.target.value }))
                        }
                      />
                      {errors.vatNumber ? <span className="field-error">{errors.vatNumber}</span> : null}
                    </div>
                    <div className="field full">
                      <label>Billing contact</label>
                      <input
                        type="email"
                        placeholder="billing@company.com"
                        value={invoice.billingContact}
                        onChange={(event) =>
                          setInvoice((prev) => ({ ...prev, billingContact: event.target.value }))
                        }
                      />
                      {errors.billingContact ? <span className="field-error">{errors.billingContact}</span> : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </button>
          </div>

          <label className="terms">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            I agree to the terms and privacy policy.
          </label>
          {errors.terms ? <span className="field-error">{errors.terms}</span> : null}
        </section>

        <aside className="checkout-summary">
          <h2>Order Summary</h2>
          {effectiveCart.length === 0 ? (
            <p className="empty-cart">Your cart is empty.</p>
          ) : (
            <ul className="summary-list">
              {effectiveCart.map((item, idx) => (
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
          <button
            className="checkout-primary"
            disabled={effectiveCart.length === 0 || submitState.status === "loading"}
            onClick={handlePlaceOrder}
          >
            {submitState.status === "loading" ? "Placing order..." : "Place Order"}
          </button>
          {submitState.message ? (
            <div className={`submit-status ${submitState.status}`}>{submitState.message}</div>
          ) : null}
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
