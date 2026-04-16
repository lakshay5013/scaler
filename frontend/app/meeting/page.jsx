"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, clearSession, readSession } from "../../lib/apiClient";
import Sidebar from "../components/Sidebar";

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const defaultDate = toInputDate(new Date(Date.now() + 24 * 60 * 60 * 1000));


function slugTail(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const pieces = value.split("/").filter(Boolean);
  return pieces[pieces.length - 1] || "";
}


function eventTypeName(eventType) {
  if (!eventType) {
    return "";
  }
  return eventType.name || eventType.title || "Untitled event";
}


function eventTypeDuration(eventType) {
  if (!eventType) {
    return "";
  }
  return eventType.duration ?? eventType.durationMinutes ?? "";
}

export default function MeetingPage() {
  const params = useParams();
  const routeEventSlug = typeof params?.eventType === "string" ? params.eventType : "";

  const [session, setSession] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedEventTypeId, setSelectedEventTypeId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    const currentSession = readSession();
    setSession(currentSession);

    if (currentSession?.user?.name) {
      setName(currentSession.user.name);
    }

    if (currentSession?.user?.email) {
      setEmail(currentSession.user.email);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoadingEvents(true);
      setError("");

      try {
        const payload = await apiFetch("/api/event-types");
        if (cancelled) {
          return;
        }

        const incoming = Array.isArray(payload.eventTypes) ? payload.eventTypes : [];
        setEventTypes(incoming);

        const preferred = incoming.find((item) => slugTail(item.slug) === routeEventSlug);
        setSelectedEventTypeId(preferred?.id || incoming[0]?.id || "");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load event types");
        }
      } finally {
        if (!cancelled) {
          setLoadingEvents(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [routeEventSlug]);

  useEffect(() => {
    if (!selectedEventTypeId || !date) {
      setSlots([]);
      return;
    }

    let cancelled = false;

    async function loadSlots() {
      setLoadingSlots(true);
      setError("");

      try {
        const payload = await apiFetch(
          `/api/availability?eventTypeId=${encodeURIComponent(selectedEventTypeId)}&date=${encodeURIComponent(date)}`,
        );

        if (cancelled) {
          return;
        }

        const nextSlots = Array.isArray(payload.slots) ? payload.slots : [];
        setSlots(nextSlots);
        setSelectedSlot(nextSlots[0] || "");
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load slots");
        }
      } finally {
        if (!cancelled) {
          setLoadingSlots(false);
        }
      }
    }

    loadSlots();

    return () => {
      cancelled = true;
    };
  }, [selectedEventTypeId, date]);

  const selectedEventType = useMemo(
    () => eventTypes.find((item) => item.id === selectedEventTypeId) || null,
    [eventTypes, selectedEventTypeId],
  );

  async function handleBook(event) {
    event.preventDefault();
    setBookingLoading(true);
    setError("");

    try {
      const payload = await apiFetch("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          eventTypeId: selectedEventTypeId,
          event_type_id: selectedEventTypeId,
          date,
          time: selectedSlot,
          name,
          email,
          attendee_name: name,
          attendee_email: email,
        }),
      });

      setBooking(payload.booking || null);
    } catch (err) {
      setError(err.message || "Could not create booking");
    } finally {
      setBookingLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  return (
    <main className="dash-layout">
      <Sidebar />
      <section className="dash-main">
        <div className="dash-topbar">
          <div className="dash-topbar__left">
            <h1 className="dash-topbar__title">Meeting booking</h1>
            <p className="dash-topbar__subtitle">
              Select event type, date and available slot to confirm your booking.
            </p>
          </div>
          <div className="dash-topbar__right">
            <Link href="/" className="dash-btn dash-btn--ghost">Home</Link>
            <Link href="/dashboard/bookings" className="dash-btn dash-btn--ghost">View bookings</Link>
            {session ? (
              <button type="button" onClick={handleLogout} className="dash-btn dash-btn--ghost">
                Logout
              </button>
            ) : (
              <Link href="/login" className="dash-btn dash-btn--ghost">Login</Link>
            )}
          </div>
        </div>

        <div className="dash-event-list meeting-public-content">
          {error ? <p className="form-error meeting-public-error">{error}</p> : null}

          {booking ? (
            <div className="dash-event-card">
              <div className="dash-event-card__left">
                <div className="dash-event-card__color" />
                <div className="dash-event-card__info">
                  <div className="dash-event-card__name-row">
                    <span className="dash-event-card__name">Meeting confirmed</span>
                    <span className="dash-event-card__slug">{booking.date} • {booking.time}</span>
                  </div>
                  <span className="dash-event-card__duration">
                    {booking.name} booked {booking.eventTitle}
                  </span>
                </div>
              </div>
              <div className="dash-event-card__right">
                <a href={booking.joinUrl} target="_blank" rel="noreferrer" className="dash-btn dash-btn--ghost">
                  Join link
                </a>
                <button type="button" className="dash-btn dash-btn--primary" onClick={() => setBooking(null)}>
                  Book another
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBook} className="meeting-event-form">
              <div className="dash-event-card meeting-event-card-grid">
                <div className="dash-event-card__left">
                  <div className="dash-event-card__color" />
                  <div className="dash-event-card__info">
                    <div className="dash-event-card__name-row">
                      <span className="dash-event-card__name">Event and date</span>
                      <span className="dash-event-card__slug">Basic info</span>
                    </div>
                  </div>
                </div>
                <div className="meeting-form-fields">
                  <label className="meeting-field">
                    <span>Event Type</span>
                    <select
                      className="dash-modal__input"
                      value={selectedEventTypeId}
                      onChange={(e) => setSelectedEventTypeId(e.target.value)}
                      disabled={loadingEvents || eventTypes.length === 0}
                    >
                      {eventTypes.map((eventType) => (
                        <option key={eventType.id} value={eventType.id}>
                          {eventTypeName(eventType)} ({eventTypeDuration(eventType)} min)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="meeting-field">
                    <span>Date</span>
                    <input
                      className="dash-modal__input"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </label>
                </div>
              </div>

              <div className="dash-event-card meeting-event-card-grid">
                <div className="dash-event-card__left">
                  <div className="dash-event-card__color" />
                  <div className="dash-event-card__info">
                    <div className="dash-event-card__name-row">
                      <span className="dash-event-card__name">Available times</span>
                      <span className="dash-event-card__slug">
                        {loadingSlots ? "Loading..." : `${slots.length} slots`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="meeting-slot-grid">
                  {slots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={slot === selectedSlot ? "meeting-slot-btn meeting-slot-btn--active" : "meeting-slot-btn"}
                    >
                      {slot}
                    </button>
                  ))}
                  {!loadingSlots && slots.length === 0 ? (
                    <p className="meeting-empty-slots">No slots available for this date.</p>
                  ) : null}
                </div>
              </div>

              <div className="dash-event-card meeting-event-card-grid">
                <div className="dash-event-card__left">
                  <div className="dash-event-card__color" />
                  <div className="dash-event-card__info">
                    <div className="dash-event-card__name-row">
                      <span className="dash-event-card__name">Your details</span>
                      <span className="dash-event-card__slug">Attendee info</span>
                    </div>
                  </div>
                </div>
                <div className="meeting-form-fields">
                  <label className="meeting-field">
                    <span>Name</span>
                    <input
                      className="dash-modal__input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </label>

                  <label className="meeting-field">
                    <span>Email</span>
                    <input
                      className="dash-modal__input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </label>
                </div>
              </div>

              <div className="dash-event-card">
                <div className="dash-event-card__left">
                  <div className="dash-event-card__color" />
                  <div className="dash-event-card__info">
                    <div className="dash-event-card__name-row">
                      <span className="dash-event-card__name">Summary</span>
                      <span className="dash-event-card__slug">
                        {selectedEventType ? `${eventTypeName(selectedEventType)} • ${selectedSlot || "Select slot"}` : "-"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="dash-event-card__right">
                  <button type="submit" className="dash-btn dash-btn--primary" disabled={bookingLoading || !selectedSlot}>
                    {bookingLoading ? "Booking..." : "Confirm meeting"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
