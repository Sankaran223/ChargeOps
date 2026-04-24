import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Card from "../components/Card.jsx";
import Loader from "../components/Loader.jsx";
import { paymentApi } from "../services/api.js";

const REDIRECT_DELAY_MS = 3000;

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("Verifying your payment and updating booking status...");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      setStatus("error");
      setMessage("Payment session was not found.");
      return;
    }

    let redirectTimer;
    let isMounted = true;

    const verifyPayment = async () => {
      try {
        await paymentApi.verifyStripeSession(sessionId);

        if (!isMounted) {
          return;
        }

        setStatus("success");
        setMessage("Order successful. Your booking payment is now marked as paid.");
        redirectTimer = window.setTimeout(() => {
          navigate("/bookings", { replace: true });
        }, REDIRECT_DELAY_MS);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus("error");
        setMessage(error.response?.data?.message || "Unable to verify Stripe payment.");
      }
    };

    verifyPayment();

    return () => {
      isMounted = false;
      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [navigate, searchParams]);

  return (
    <main className="mx-auto flex max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Card title="Payment Status" subtitle="Stripe Checkout">
        <div className="space-y-5">
          {status === "verifying" ? <Loader label="Confirming your payment..." /> : null}

          {status === "success" ? (
            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6">
              <h2 className="text-2xl font-semibold text-white">Order Successful</h2>
              <p className="mt-3 text-sm text-emerald-100">{message}</p>
              <p className="mt-2 text-sm text-emerald-200">Redirecting to your bookings in 3 seconds...</p>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-6">
              <h2 className="text-2xl font-semibold text-white">Payment Verification Failed</h2>
              <p className="mt-3 text-sm text-rose-100">{message}</p>
              <div className="mt-4">
                <Link to="/bookings" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950">
                  Back to Bookings
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </main>
  );
};

export default PaymentSuccess;
