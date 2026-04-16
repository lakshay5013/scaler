"use client";

import { useEffect, useMemo, useState } from "react";
import { IconFilter, IconChevronDown, IconCalendar, IconSliders } from "../../components/Icons";
import { apiFetch } from "../../../lib/apiClient";

const TABS = ["Upcoming", "Unconfirmed", "Recurring", "Past", "Cancelled"];

const TAB_TO_API = {
  Upcoming: "upcoming",
  Unconfirmed: "unconfirmed",
  Recurring: "recurring",
  Past: "past",
  Cancelled: "cancelled",
};

/* ─── Empty State ─── */
function EmptyState({ tab }) {
  const messages = {
    Upcoming: { title: "No upcoming bookings", desc: "You have no upcoming bookings. As soon as someone books a time with you it will show up here." },
    Unconfirmed: { title: "No unconfirmed bookings", desc: "You have no bookings requiring confirmation." },
    Recurring: { title: "No recurring bookings", desc: "You don't have any recurring bookings yet." },
    Past: { title: "No past bookings", desc: "You don't have any past bookings." },
    Cancelled: { title: "No cancelled bookings", desc: "You don't have any cancelled bookings." },
  };

  const msg = messages[tab] || messages.Upcoming;

  return (
    <div className="bookings-empty">
      <div className="bookings-empty__icon">
        <IconCalendar size={40} />
      </div>
      <h3 className="bookings-empty__title">{msg.title}</h3>
      <p className="bookings-empty__desc">{msg.desc}</p>
    </div>
  );
}

/* ─── Booking Card ─── */
function BookingCard({ booking }) {
  const normalizedStatus = String(booking.status || "upcoming").toLowerCase();
  const statusLabelByKey = {
    upcoming: "Upcoming",
    unconfirmed: "Unconfirmed",
    recurring: "Recurring",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <div className={`booking-card ${normalizedStatus === "cancelled" ? "booking-card--cancelled" : ""}`}>
      <div className="booking-card__left">
        <div className="booking-card__color" />
        <div className="booking-card__info">
          <div className="booking-card__title-row">
            <span className="booking-card__title">{booking.title}</span>
            <span className={`booking-card__status booking-card__status--${normalizedStatus}`}>
              {statusLabelByKey[normalizedStatus] || "Upcoming"}
            </span>
          </div>
          <div className="booking-card__meta">
            <span className="booking-card__attendee">{booking.attendee}</span>
            <span className="booking-card__separator">·</span>
            <span className="booking-card__email">{booking.email}</span>
          </div>
          <div className="booking-card__time">
            <IconCalendar size={12} />
            <span>{booking.date}</span>
            <span className="booking-card__separator">·</span>
            <span>{booking.time}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Bookings Page ─── */
export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState("Upcoming");
  const [showFilters, setShowFilters] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBookings() {
      setLoading(true);
      setError("");

      try {
        const tab = TAB_TO_API[activeTab] || "upcoming";
        const payload = await apiFetch(`/api/bookings?tab=${encodeURIComponent(tab)}`);

        if (cancelled) {
          return;
        }

        setBookings(Array.isArray(payload.bookings) ? payload.bookings : []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load bookings");
          setBookings([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBookings();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const bookingsForTab = useMemo(() => bookings, [bookings]);

  return (
    <>
      {/* ─── Top bar ─── */}
      <div className="dash-topbar">
        <div className="dash-topbar__left">
          <h1 className="dash-topbar__title">Bookings</h1>
          <p className="dash-topbar__subtitle">
            See upcoming and past events booked through your event type links.
          </p>
        </div>
      </div>

      {/* ─── Tabs + Filter Row ─── */}
      <div className="bookings-toolbar">
        <div className="bookings-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`bookings-tab ${activeTab === tab ? "bookings-tab--active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}

          <button
            className={`bookings-filter-btn ${showFilters ? "bookings-filter-btn--active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <IconFilter size={14} />
            <span>Filter</span>
          </button>
        </div>

        <button className="bookings-saved-filters">
          <IconSliders size={14} />
          <span>Saved filters</span>
          <IconChevronDown size={12} />
        </button>
      </div>

      {/* ─── Content ─── */}
      <div className="bookings-content">
        {error ? <p className="form-error">{error}</p> : null}
        {loading ? <p>Loading bookings...</p> : null}
        {!loading && bookingsForTab.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : null}
        {!loading && bookingsForTab.length > 0 ? (
          <div className="bookings-list">
            {bookingsForTab.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
