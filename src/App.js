import React, { useState, useEffect } from "react";
import "./App.css";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  ref,
  push,
  onValue,
  query as rtdbQuery,
  orderByChild,
  equalTo,
} from "firebase/database";

function App() {
  const [selectedRoom, setSelectedRoom] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDates, setWeekDates] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [popup, setPopup] = useState(null); // {date, hour, show}

  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(
      today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + weekOffset * 7
    );

    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    setWeekDates(dates);
  }, [weekOffset]);

  // Fetch bookings from Realtime Database
  useEffect(() => {
    if (!selectedRoom || weekDates.length === 0) return;
    const bookingsRef = ref(db, "bookings");
    const q = rtdbQuery(bookingsRef, orderByChild("room"), equalTo(selectedRoom));
    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      const bookingsArr = data ? Object.values(data) : [];
      setBookings(bookingsArr);
    });
    return () => unsubscribe();
  }, [selectedRoom, weekDates]);

  const hours = Array.from({ length: 11 }, (_, i) => `${i + 9}:00`);

  const formatDate = (date) => {
    const options = { weekday: "short", month: "numeric", day: "numeric" };
    return date.toLocaleDateString(undefined, options);
  };

  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear() &&
      weekOffset === 0
    );
  };

  const isPastSlot = (date, hour) => {
    const now = new Date();
    const slotDate = new Date(date);
    const [h] = hour.split(":");
    slotDate.setHours(Number(h), 0, 0, 0);
    return slotDate < now;
  };

  // Helper to get hour index
  const getHourIndex = (hour) => hours.indexOf(hour);

  // Check if a slot is booked
  const getBookingForSlot = (date, hour) => {
    return bookings.find(
      (b) =>
        b.room === selectedRoom &&
        b.date === date.toDateString() &&
        getHourIndex(hour) >= getHourIndex(b.startHour) &&
        getHourIndex(hour) < getHourIndex(b.endHour)
    );
  };

  // Handle booking submit
  const handleBooking = async (name, endHour) => {
    const booking = {
      room: selectedRoom,
      date: popup.date.toDateString(),
      startHour: popup.hour,
      endHour,
      name,
    };
    await push(ref(db, "bookings"), booking);
    setPopup(null);
  };

  return (
    <div className="app">
      <nav className="navbar">GTO</nav>

      <div className="booking">
        <h2>Select a Room</h2>
        <div className="rooms">
          <label>
            <input
              type="radio"
              name="room"
              value="GTO Meeting Room"
              onChange={(e) => setSelectedRoom(e.target.value)}
            />
            Meeting Room
          </label>
          <label>
            <input
              type="radio"
              name="room"
              value="Discussion Room"
              onChange={(e) => setSelectedRoom(e.target.value)}
            />
            Discussion Room
          </label>
        </div>

        {selectedRoom ? (
          <>
            <h3>{selectedRoom} - Weekly Calendar (9am - 7pm)</h3>

            {/* Week navigation with arrows */}
            <div
              className="week-navigation"
              style={{
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "2rem",
                userSelect: "none",
              }}
            >
              <span
                onClick={() => {
                  if (weekOffset > 0) setWeekOffset((offset) => offset - 1);
                }}
                style={{
                  fontSize: "1.8rem",
                  cursor: weekOffset > 0 ? "pointer" : "not-allowed",
                  userSelect: "none",
                  lineHeight: 1,
                  color: weekOffset > 0 ? "#facc15" : "#a1a1aa", // yellow or gray
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (weekOffset > 0) e.currentTarget.style.color = "#ca8a04";
                }}
                onMouseLeave={(e) => {
                  if (weekOffset > 0) e.currentTarget.style.color = "#facc15";
                }}
                role="button"
                aria-label="Previous week"
              >
                &#x25B2;
              </span>

              <span
                style={{
                  fontWeight: "bold",
                  fontSize: "1.1rem",
                  color: "#374151",
                }}
              >
                Week of {formatDate(weekDates[0])}
              </span>

              <span
                onClick={() => setWeekOffset((offset) => offset + 1)}
                style={{
                  fontSize: "1.8rem",
                  cursor: "pointer",
                  userSelect: "none",
                  lineHeight: 1,
                  color: "#facc15",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ca8a04")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#facc15")}
                role="button"
                aria-label="Next week"
              >
                &#x25BC;
              </span>
            </div>

            <div className="calendar">
              <div className="calendar-row header">
                <div className="time-slot"></div>
                {hours.map((hour) => (
                  <div key={hour} className="day">
                    {hour}
                  </div>
                ))}
              </div>

              {weekDates.map((date) => (
                <div
                  key={date.toISOString()}
                  className={`calendar-row ${isToday(date) ? "today" : ""}`}
                >
                  <div className="time-slot">{formatDate(date)}</div>
                  {hours.map((hour, idx) => {
                    const booking = getBookingForSlot(date, hour);
                    const isBooked = !!booking;
                    const isPast = isPastSlot(date, hour);
                    return (
                      <div
                        key={`${date.toISOString()}-${hour}`}
                        className="slot"
                        style={{
                          background: isBooked
                            ? "#fde047"
                            : isPast
                            ? "#e5e7eb"
                            : undefined,
                          cursor: isBooked || isPast ? "not-allowed" : "pointer",
                          position: "relative",
                          color: isPast ? "#9ca3af" : undefined,
                        }}
                        onClick={() => {
                          if (!isBooked && !isPast)
                            setPopup({ date, hour, show: true });
                        }}
                      >
                        {isBooked && (
                          <span style={{ fontSize: "0.8em", color: "#78350f" }}>
                            {booking.name}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Popup for booking */}
            {popup && popup.show && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  background: "rgba(0,0,0,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                }}
                onClick={() => setPopup(null)}
              >
                <div
                  style={{
                    background: "#fde047",
                    padding: "2rem",
                    borderRadius: "1rem",
                    minWidth: "300px",
                    boxShadow: "0 2px 12px #0002",
                    position: "relative",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h4 style={{ margin: 0, color: "#78350f" }}>Book Room</h4>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = e.target.name.value;
                      const endHour = e.target.endHour.value;
                      if (name && endHour) handleBooking(name, endHour);
                    }}
                  >
                    <div style={{ margin: "1em 0" }}>
                      <label>
                        Name:{" "}
                        <input
                          name="name"
                          required
                          style={{
                            border: "1px solid #ca8a04",
                            borderRadius: "4px",
                            padding: "0.3em",
                          }}
                        />
                      </label>
                    </div>
                    <div style={{ margin: "1em 0" }}>
                      <label>
                        End Time:{" "}
                        <select name="endHour" required>
                          {hours
                            .slice(getHourIndex(popup.hour) + 1)
                            .map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <button
                      type="submit"
                      style={{
                        background: "#111827",
                        border: "none",
                        borderRadius: "4px",
                        padding: "0.5em 1em",
                        color: "#facc15",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      Book
                    </button>
                    <button
                      type="button"
                      onClick={() => setPopup(null)}
                      style={{
                        marginLeft: "1em",
                        background: "#fff",
                        border: "1px solid #ca8a04",
                        borderRadius: "4px",
                        padding: "0.5em 1em",
                        color: "#78350f",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        ) : (
          <p>Please select a room to see its calendar.</p>
        )}
      </div>
    </div>
  );
}

export default App;
