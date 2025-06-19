import React, { useState, useEffect } from "react";
import "./App.css";
import { db } from "./firebase";
//import {
  //collection,
 // addDoc,
 // getDocs,
 // query,
 // where,
//} from "firebase/firestore";
import {
  ref,
  push,
  onValue,
  query as rtdbQuery,
  orderByChild,
  equalTo,
} from "firebase/database";
import { FaLinkedin, FaGithub } from "react-icons/fa";

function App() {
  const [selectedRoom, setSelectedRoom] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDates, setWeekDates] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [popup, setPopup] = useState(null); // {date, hour, show}
  const [showFooter, setShowFooter] = useState(false);

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
    const [slotHour] = hour.split(":");
    slotDate.setHours(Number(slotHour), 0, 0, 0);

    // If the slot is before today, it's past
    if (
      slotDate.getFullYear() < now.getFullYear() ||
      (slotDate.getFullYear() === now.getFullYear() &&
        slotDate.getMonth() < now.getMonth()) ||
      (slotDate.getFullYear() === now.getFullYear() &&
        slotDate.getMonth() === now.getMonth() &&
        slotDate.getDate() < now.getDate())
    ) {
      return true;
    }

    // If the slot is today and the hour is less than or equal to now, it's past
    if (
      slotDate.getFullYear() === now.getFullYear() &&
      slotDate.getMonth() === now.getMonth() &&
      slotDate.getDate() === now.getDate()
    ) {
      return Number(slotHour) <= now.getHours();
    }

    // Otherwise, it's not past
    return false;
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

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.body.offsetHeight;
      // Show footer if scrolled to within 20px of the bottom
      setShowFooter(scrollPosition >= documentHeight - 20);
    };
    window.addEventListener("scroll", handleScroll);
    // Check on mount in case content is short
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="app" style={{ minHeight: "100vh", position: "relative", paddingBottom: "90px" }}>
      <nav className="navbar">GTO</nav>

      <div className="booking">
        <h2>Select a Room</h2>
        <div className="rooms">
          <label>
            <input
              type="radio"
              name="room"
              value="Meeting Room"
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
                marginBottom: "0.5rem", // reduced margin below navigation
                marginTop: "0.3rem",    // add a small margin above if needed
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.7rem",          // reduced gap between arrows and text
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
                  color: weekOffset > 0 ? "#facc15" : "#a1a1aa",
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

            {/* Calendar: Times as rows, Days as columns */}
            <div className="calendar-horizontal" style={{ marginTop: "0.2rem", marginBottom: "3.5rem" }}>
              <div className="calendar-row-horizontal header-horizontal">
                <div className="time-cell header-cell"></div>
                {weekDates.map((date) => (
                  <div
                    key={date.toISOString()}
                    className={
                      "day-cell header-cell" +
                      (isToday(date) ? " today-header" : "")
                    }
                  >
                    <span className="day-label">
                      {date.toLocaleDateString(undefined, { weekday: "short" })}
                    </span>
                    <span className="date-label">
                      {date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
              {hours.map((hour) => (
                <div key={hour} className="calendar-row-horizontal">
                  <div className="time-cell">{hour}</div>
                  {weekDates.map((date) => {
                    const booking = getBookingForSlot(date, hour);
                    const isBooked = !!booking;
                    const isPast = isPastSlot(date, hour);
                    return (
                      <div
                        key={`${date.toISOString()}-${hour}`}
                        className="day-cell slot-cell"
                        style={{
                          background: isBooked
                            ? "#fde047"
                            : isPast
                            ? "#e5e7eb"
                            : undefined,
                          cursor: isBooked || isPast ? "not-allowed" : "pointer",
                          color: isPast ? "#9ca3af" : undefined,
                        }}
                        onClick={() => {
                          if (!isBooked && !isPast)
                            setPopup({ date, hour, show: true });
                        }}
                      >
                        {isBooked && (
                          <span
                            style={{
                              fontSize: "0.8em",
                              color: "#78350f",
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "inline-block",
                              verticalAlign: "middle",
                            }}
                            title={booking.name}
                          >
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

      {/* Footer only appears at end of scroll */}
      {showFooter && (
        <footer
          style={{
            width: "100vw",
            background: "#111827",
            color: "#f3f4f6",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            padding: "0.5rem 0.7rem 0.7rem 0.7rem", // reduced bottom padding
            zIndex: 100,
            position: "fixed",
            left: 0,
            bottom: 0,
          }}
        >
          {/* Top row: left and right sections */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              width: "100%",
              maxWidth: 900,
              margin: "0 auto",
              gap: "1.5rem",
            }}
          >
            {/* Left section */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.4rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", fontSize: "0.95rem" }}>
                <span>Created by Khaillash</span>
                <a
                  href="https://www.linkedin.com/in/khaillash-sashitharan-57580625a/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#f3f4f6", fontSize: "1.2rem" }}
                  aria-label="LinkedIn"
                >
                  <FaLinkedin />
                </a>
                <a
                  href="https://github.com/Khaillash1911"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#f3f4f6", fontSize: "1.2rem" }}
                  aria-label="GitHub"
                >
                  <FaGithub />
                </a>
              </div>
              <button
                style={{
                  background: "#facc15",
                  color: "#111827",
                  border: "none",
                  borderRadius: "4px",
                  padding: "0.3em 1em",
                  fontWeight: "bold",
                  fontSize: "0.95rem",
                  cursor: "pointer",
                }}
                onClick={() => window.open("https://khaillashportfolio.netlify.app/", "_blank")}
              >
                More Projects
              </button>
              {/* v1.1 version moved here, right below More Projects, right-aligned */}
              <div
                style={{
                  width: "100%",
                  textAlign: "left",
                  fontSize: "0.92rem",
                  color: "#facc15",
                  letterSpacing: "0.05em",
                  marginTop: "0.1rem",
                  paddingRight: "0.2rem",
                }}
              >
                v1.2
              </div>
            </div>
            {/* Right section: Feedback */}
            <div
              style={{
                minWidth: "120px",
                maxWidth: "180px",
                background: "#fde047", // yellow background for the whole form
                borderRadius: "8px",
                padding: "0.4rem 0.7rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                boxShadow: "0 2px 8px #0002",
                height: "fit-content",
              }}
            >
              <form
                action="https://formspree.io/f/movwdjak"
                method="POST"
                target="_blank"
                style={{ width: "100%" }}
              >
                <label
                  style={{
                    color: "#111",
                    background: "#fde047",
                    padding: "0.2em 0.5em",
                    borderRadius: "4px",
                    marginBottom: "0.3em",
                    display: "inline-block"
                  }}
                >
                  Leave a review !
                </label>
                <textarea
                  name="feedback"
                  required
                  style={{
                    background: "#fffde7",
                    border: "1px solid #ca8a04",
                    borderRadius: "4px",
                    width: "100%",
                    marginBottom: "0.5em",
                    color: "#111"
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: "#facc15",
                    color: "#111827",
                    border: "none",
                    borderRadius: "4px",
                    padding: "0.3em 1em",
                    fontWeight: "bold",
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    width: "100%"
                  }}
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
