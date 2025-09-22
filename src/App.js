import React, { useState, useEffect } from "react";
import "./App.css";
import { ref, push, remove } from "firebase/database";
import { db, auth, provider } from "./firebase";
import {
  onValue,
  query as rtdbQuery,
  orderByChild,
  equalTo,
} from "firebase/database";
import { signInWithPopup, signOut } from "firebase/auth";
import { FaLinkedin, FaGithub, FaTrash, FaSignInAlt, FaSignOutAlt } from "react-icons/fa";

// Add your admin emails here
const ADMIN_EMAILS = [
  "khaillash1911@gmail.com",
  "sashi151177@gmail.com"
];

function App() {
  const [selectedRoom, setSelectedRoom] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDates, setWeekDates] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [popup, setPopup] = useState(null); // {date, hour, show}
  const [showFooter, setShowFooter] = useState(false);
  const [endTime, setEndTime] = useState(""); // New state for end time
  const [name, setName] = useState(""); // New state for name
  const [user, setUser] = useState(null);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // Sign in/out handlers
  const handleSignIn = () => signInWithPopup(auth, provider);
  const handleSignOut = () => signOut(auth);

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
      // Attach booking keys for deletion
      const bookingsArr = data
        ? Object.entries(data).map(([key, val]) => ({ ...val, _key: key }))
        : [];
      setBookings(bookingsArr);
    });
    return () => unsubscribe();
  }, [selectedRoom, weekDates]);

  // Generate 30-min interval hours from 9:00 to 19:00
  const hours = [];
  for (let h = 9; h < 19; h++) {
    hours.push(`${h}:00`);
    hours.push(`${h}:30`);
  }
  hours.push("19:00");

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

  // isPastSlot now supports 30-min intervals
  const isPastSlot = (date, hour) => {
    const now = new Date();
    const slotDate = new Date(date);
    const [slotHour, slotMin] = hour.split(":").map(Number);
    slotDate.setHours(slotHour, slotMin, 0, 0);

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

    // If the slot is today and the time is less than or equal to now, it's past
    if (
      slotDate.getFullYear() === now.getFullYear() &&
      slotDate.getMonth() === now.getMonth() &&
      slotDate.getDate() === now.getDate()
    ) {
      if (slotHour < now.getHours()) return true;
      if (slotHour === now.getHours() && slotMin <= now.getMinutes()) return true;
      return false;
    }

    // Otherwise, it's not past
    return false;
  };

  // Helper to get hour index (for 30-min intervals)
  const getHourIndex = (hour) => hours.indexOf(hour);

  // Check if a slot is booked (for 30-min intervals)
  const getBookingForSlot = (date, hour) => {
    return bookings.find(
      (b) =>
        b.room === selectedRoom &&
        b.date === date.toDateString() &&
        getHourIndex(hour) >= getHourIndex(b.startHour) &&
        getHourIndex(hour) < getHourIndex(b.endHour)
    );
  };

  // Check if a time range overlaps with any existing booking
  const isOverlapping = (date, startHour, endHour) => {
    const startIdx = getHourIndex(startHour);
    const endIdx = getHourIndex(endHour);
    return bookings.some(
      (b) =>
        b.room === selectedRoom &&
        b.date === date.toDateString() &&
        // Overlap if ranges intersect
        getHourIndex(b.startHour) < endIdx &&
        getHourIndex(b.endHour) > startIdx
    );
  };

  // Generate end time options in 30-min increments, stopping at next booking
  function getEndTimeOptions(start) {
    const [startHour, startMin] = start.split(":").map(Number);
    const options = [];
    let hour = startHour;
    let min = startMin + 30;
    let prev = start;
    while (hour < 19 || (hour === 19 && min === 0)) {
      if (min >= 60) {
        hour += 1;
        min = 0;
      }
      if (hour > 19 || (hour === 19 && min > 0)) break;
      const end = `${hour}:${min === 0 ? "00" : "30"}`;
      // Prevent overlap: stop if this interval would overlap with any booking
      if (isOverlapping(popup.date, start, end)) break;
      options.push(end);
      prev = end;
      min += 30;
    }
    return options;
  }

  // Handle booking submit
  const handleBooking = async (name, endHour) => {
    // Prevent overlapping bookings
    if (isOverlapping(popup.date, popup.hour, endHour)) {
      alert("This time range overlaps with an existing booking.");
      return;
    }
    const booking = {
      room: selectedRoom,
      date: popup.date.toDateString(),
      startHour: popup.hour,
      endHour,
      name,
    };
    await push(ref(db, "bookings"), booking);
    setPopup(null);
    setEndTime(""); // Reset end time
    setName("");    // Reset name
  };

  // Delete booking (admin only)
  const handleDeleteBooking = (bookingKey) => {
    if (!isAdmin) return;
    if (window.confirm("Delete this booking?")) {
      remove(ref(db, `bookings/${bookingKey}`));
    }
  };

  // Show footer when scrolled to bottom

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
      <nav className="navbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>GTO</span>
        <div>
          {user ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.7em" }}>
              <img src={user.photoURL} alt="avatar" style={{ width: 21, height: 21, borderRadius: "50%", marginLeft: "50px"}} />
              <span style={{ fontSize: "20px" }}>{user.displayName || user.email}</span>
              <button
                onClick={handleSignOut}
                style={{
                  background: "none",
                  border: "none",
                  color: "#facc15",
                  cursor: "pointer",
                  fontSize: "20px"
                }}
                title="Sign out"
              >
                <FaSignOutAlt />
              </button>
            </span>
          ) : (
            <button
              onClick={handleSignIn}
              style={{
                background: "none",
                border: "none",
                color: "#facc15",
                cursor: "pointer",
                fontSize: "20px"
              }}
              title="Sign in with Google"
            >
              <FaSignInAlt /> Admin
            </button>
          )}
        </div>
      </nav>

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
                          position: "relative"
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
                            {/* Admin delete button */}
                            {isAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBooking(booking._key);
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#dc2626",
                                  marginLeft: 6,
                                  cursor: "pointer",
                                  fontSize: "1em",
                                  verticalAlign: "middle"
                                }}
                                title="Delete booking"
                              >
                                <FaTrash />
                              </button>
                            )}
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
                  <h4 style={{ margin: 0, color: "#78350f", fontSize: "20px" }}>Book Room</h4>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = e.target.name.value;
                      const endHour = e.target.endHour.value;
                      if (name && endHour) handleBooking(name, endHour);
                    }}
                  >
                    <div style={{ margin: "1em 0", fontSize: "18px"}}>
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
                          value={name}
                          onChange={(e) => setName(e.target.value)} // Bind state
                        />
                      </label>
                    </div>
                    <div style={{ margin: "1em 0", fontSize: "18px" }}>
                      <label>
                        End Time:{" "}
                        <select
                          name="endHour"
                          required
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)} // Bind state
                        >
                          {getEndTimeOptions(popup.hour).map((h) => (
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
                        fontSize: "16px"
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
                        fontSize: "16px"
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
