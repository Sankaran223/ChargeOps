import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import Card from "../components/Card.jsx";
import Loader from "../components/Loader.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { bookingApi, paymentApi, stationApi } from "../services/api.js";

const defaultForm = {
  stationId: "",
  slotTime: "",
  units: "1",
  amount: ""
};

const STRIPE_MIN_BOOKING_AMOUNT = 0.5;

const getBookingAmount = (station, units) => {
  const pricePerUnit = Number(station?.pricePerUnit || 0);
  const normalizedUnits = Math.max(1, Number(units) || 1);

  return pricePerUnit * normalizedUnits;
};

const Bookings = () => {
  const { state } = useLocation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookingForm, setBookingForm] = useState(defaultForm);
  const [bookings, setBookings] = useState([]);
  const [stations, setStations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState("");
  const [isMockPaying, setIsMockPaying] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [stationLoadError, setStationLoadError] = useState("");

  useEffect(() => {
    if (state?.selectedStation) {
      setBookingForm({
        stationId: state.selectedStation.id,
        slotTime: "",
        units: "1",
        amount: String(getBookingAmount(state.selectedStation, 1))
      });
    }
  }, [state]);

  useEffect(() => {
    const loadStations = async () => {
      try {
        const { data } = await stationApi.list({ isApproved: true });
        setStations(data.data || []);
      } catch (error) {
        setStationLoadError(error.response?.data?.message || "Unable to load stations for booking.");
      }
    };

    loadStations();
  }, []);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const { data } = await bookingApi.mine();
      setBookings(data.data || []);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Unable to load bookings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    const paymentState = searchParams.get("payment");

    if (paymentState === "cancelled") {
      setErrorMessage("Stripe checkout was cancelled.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const selectedStation = stations.find((station) => station.id === bookingForm.stationId) || state?.selectedStation || null;
  const computedAmount = selectedStation ? getBookingAmount(selectedStation, bookingForm.units) : 0;
  const isBelowStripeMinimum = Boolean(selectedStation) && computedAmount < STRIPE_MIN_BOOKING_AMOUNT;

  const handleStationChange = (event) => {
    const stationId = event.target.value;
    const station = stations.find((entry) => entry.id === stationId);

    setBookingForm((current) => ({
      ...current,
      stationId,
      amount: station ? String(getBookingAmount(station, current.units)) : ""
    }));
  };

  const handleUnitsChange = (event) => {
    const units = event.target.value;

    setBookingForm((current) => ({
      ...current,
      units,
      amount: selectedStation ? String(getBookingAmount(selectedStation, units)) : ""
    }));
  };

  const createBooking = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (selectedStation && computedAmount < STRIPE_MIN_BOOKING_AMOUNT) {
        throw new Error(`Minimum booking total for Stripe is $${STRIPE_MIN_BOOKING_AMOUNT}. Increase the units to continue.`);
      }

      await bookingApi.create({
        stationId: bookingForm.stationId,
        slotTime: bookingForm.slotTime,
        amount: computedAmount
      });
      setSuccessMessage("Booking created successfully.");
      setBookingForm(defaultForm);
      loadBookings();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Unable to create booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelBooking = async (bookingId) => {
    await bookingApi.cancel(bookingId);
    loadBookings();
  };

  const payBooking = async (booking) => {
    setIsPaying(booking.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data } = await paymentApi.create({
        bookingId: booking.id,
        amount: Number(booking.amount),
        paymentMethod: "card"
      });

      if (data?.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
        return;
      }

      throw new Error("Stripe checkout URL was not returned.");
    } catch (error) {
      const validationErrors = error.response?.data?.errors
        ?.map((issue) => `${issue.field}: ${issue.message}`)
        .join(", ");
      setErrorMessage(validationErrors || error.response?.data?.message || error.message || "Unable to start Stripe checkout.");
      setIsPaying("");
    }
  };

  const mockPayBooking = async (booking) => {
    setIsMockPaying(booking.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await paymentApi.mockPay({
        bookingId: booking.id,
        amount: Number(booking.amount)
      });

      setSuccessMessage("Payment completed successfully.");
      await loadBookings();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || error.message || "Unable to complete dummy payment.");
    } finally {
      setIsMockPaying("");
    }
  };

  return (
    <main className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Sidebar />

      <div className="flex-1 space-y-6">
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card title="Book a Charging Slot" subtitle="New Booking">
            <form className="space-y-4" onSubmit={createBooking}>
              <select
                value={bookingForm.stationId}
                onChange={handleStationChange}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white"
                required
              >
                <option value="">Select station</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name} - {"$"}{station.pricePerUnit}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={bookingForm.slotTime}
                onChange={(event) => setBookingForm((current) => ({ ...current, slotTime: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white"
                required
              />
              <input
                type="number"
                min="1"
                step="1"
                value={bookingForm.units}
                onChange={handleUnitsChange}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white"
                placeholder="Units"
                required
              />
              <input
                type="number"
                min="0"
                value={selectedStation ? computedAmount : bookingForm.amount}
                readOnly
                placeholder="Total amount"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500"
                required
              />
              <button
                type="submit"
                disabled={isSubmitting || !selectedStation || isBelowStripeMinimum}
                className="rounded-full bg-gradient-to-r from-blue-800 via-violet-700 to-amber-400 px-5 py-3 text-sm font-semibold text-white"
              >
                {isSubmitting ? "Creating..." : "Create Booking"}
              </button>
            </form>

            {selectedStation ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
                Booking for: <span className="font-semibold text-white">{selectedStation.name}</span>
                <div className="mt-2 text-slate-400">
                  Price per unit: <span className="font-semibold text-white">{"$"}{selectedStation.pricePerUnit}</span>
                </div>
                <div className="mt-2 text-slate-400">
                  Selected units: <span className="font-semibold text-white">{Math.max(1, Number(bookingForm.units) || 1)}</span>
                </div>
                <div className="mt-2 text-slate-400">
                  Total amount: <span className="font-semibold text-white">{"$"}{computedAmount}</span>
                </div>
              </div>
            ) : null}
            {isBelowStripeMinimum ? (
              <p className="mt-4 text-sm text-amber-300">
                Stripe checkout for this account needs at least {"$"}{STRIPE_MIN_BOOKING_AMOUNT}. Increase the units to continue.
              </p>
            ) : null}
            {stationLoadError ? <p className="mt-4 text-sm text-rose-300">{stationLoadError}</p> : null}
            {successMessage ? <p className="mt-4 text-sm text-emerald-300">{successMessage}</p> : null}
            {errorMessage ? <p className="mt-4 text-sm text-rose-300">{errorMessage}</p> : null}
          </Card>

          <Card title="My Booking History" subtitle="Customer Records">
            {isLoading ? <Loader label="Loading bookings..." /> : null}
            <div className="space-y-4">
              {bookings.length === 0 && !isLoading ? <p className="text-slate-400">No bookings yet.</p> : null}
              {bookings.map((booking) => (
                <div key={booking.id} className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">Station ID: {booking.stationId}</p>
                      <p className="mt-1 text-sm text-slate-400">{new Date(booking.slotTime).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Status</p>
                      <p className="font-semibold capitalize text-white">
                        {booking.status} / {booking.paymentStatus}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">Amount: {"$"}{booking.amount}</p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {booking.status === "booked" ? (
                      <button
                        type="button"
                        onClick={() => cancelBooking(booking.id)}
                        className="rounded-full border border-rose-400/30 px-4 py-2 text-sm font-semibold text-rose-300"
                      >
                        Cancel
                      </button>
                    ) : null}
                    {booking.paymentStatus !== "paid" && booking.status === "booked" && (user?.role === "customer" || user?.role === "admin") ? (
                      <button
                        type="button"
                        onClick={() => payBooking(booking)}
                        disabled={isPaying === booking.id || Number(booking.amount) < STRIPE_MIN_BOOKING_AMOUNT}
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
                      >
                        {isPaying === booking.id ? "Redirecting..." : "Pay with Stripe"}
                      </button>
                    ) : null}
                    {booking.paymentStatus !== "paid" && booking.status === "booked" && (user?.role === "customer" || user?.role === "admin") ? (
                      <button
                        type="button"
                        onClick={() => mockPayBooking(booking)}
                        disabled={isMockPaying === booking.id}
                        className="rounded-full border border-emerald-400/30 px-4 py-2 text-sm font-semibold text-emerald-300"
                      >
                        {isMockPaying === booking.id ? "Processing..." : "Normal Pay"}
                      </button>
                    ) : null}
                    {Number(booking.amount) < STRIPE_MIN_BOOKING_AMOUNT ? (
                      <p className="text-sm text-amber-300">
                        Stripe payment needs at least {"$"}{STRIPE_MIN_BOOKING_AMOUNT}. Create a booking with more units.
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card title="Quick Access" subtitle="Explore More">
          <div className="flex flex-wrap gap-3">
            <Link to="/stations" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">
              Browse Stations
            </Link>
            <Link to="/plans" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200">
              View Plans
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
};

export default Bookings;
