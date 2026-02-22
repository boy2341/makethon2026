const hospitals = [
  {
    id: "Hospital #1",
    name: "Apollo Children's Hospital",
    city: "Anantpur",
    state: "Andhra Pradesh",
    specialisation: "Pediatrics",
    rating: 4.8,
    beds: 210,
    insurance: ["CGHS", "AB-PMJAY"],
    distance: 1.2,
    score: 94,
  },
  {
    id: "Hospital #2",
    name: "Sri Ramakrishna Medical Centre",
    city: "Anantpur",
    state: "Andhra Pradesh",
    specialisation: "Cardiology",
    rating: 4.5,
    beds: 340,
    insurance: ["AB-PMJAY", "Star Health"],
    distance: 3.4,
    score: 87,
  },
  {
    id: "Hospital #3",
    name: "Narayana Multispeciality",
    city: "Kurnool",
    state: "Andhra Pradesh",
    specialisation: "General",
    rating: 4.3,
    beds: 180,
    insurance: ["CGHS", "New India"],
    distance: 5.8,
    score: 81,
  },
  {
    id: "Hospital #4",
    name: "KIMS Orthopedic Institute",
    city: "Anantpur",
    state: "Andhra Pradesh",
    specialisation: "Orthopedics",
    rating: 4.6,
    beds: 120,
    insurance: ["AB-PMJAY"],
    distance: 2.1,
    score: 89,
  },
  {
    id: "Hospital #5",
    name: "Neuro Care Centre",
    city: "Anantpur",
    state: "Andhra Pradesh",
    specialisation: "Neurology",
    rating: 4.1,
    beds: 90,
    insurance: ["CGHS", "United Health"],
    distance: 6.3,
    score: 76,
  },
  {
    id: "Hospital #6",
    name: "Care Hospitals",
    city: "Anantpur",
    state: "Andhra Pradesh",
    specialisation: "General",
    rating: 4.4,
    beds: 265,
    insurance: ["AB-PMJAY", "CGHS", "Star Health"],
    distance: 4.0,
    score: 83,
  },
];

// ── Render ──────────────────────────────────────────────────────────────
function renderStars(rating) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star ${i <= Math.round(rating) ? "filled" : "empty"}">★</span>`;
  }
  return html;
}

function renderCard(h, rank) {
  const isTop = rank === 1;
  return `
        <div class="card" data-spec="${h.specialisation}" style="animation-delay:${rank * 0.07}s">
          <div class="card-top">
            ${isTop ? `<div class="top-pick-banner">⭐ Top Match for You</div>` : ""}
            <div class="card-header">
              <div class="hospital-name">${h.name}</div>
              <div class="rank-badge ${isTop ? "top" : ""}">#${rank}</div>
            </div>
            <div class="location-line">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5"/>
              </svg>
              ${h.city}, ${h.state}
            </div>
            <div class="tags">
              <span class="tag tag-spec">${h.specialisation}</span>
              ${h.insurance.map((i) => `<span class="tag tag-ins">${i}</span>`).join("")}
            </div>
          </div>

          <div class="card-body">
            <div class="metric">
              <div class="metric-val">${h.rating}</div>
              <div class="rating-stars">${renderStars(h.rating)}</div>
              <div class="metric-lbl">Rating</div>
            </div>
            <div class="metric">
              <div class="metric-val">${h.beds}</div>
              <div class="metric-lbl">Total Beds</div>
            </div>
            <div class="metric">
              <div class="metric-val">${h.distance} km</div>
              <div class="metric-lbl">Distance</div>
            </div>
          </div>

          <div class="card-footer">
            <div class="distance-pill">📍 ${h.distance} km away</div>
            <div class="score-bar-wrap">
              <div class="score-bar-bg">
                <div class="score-bar-fill" style="width: ${h.score}%"></div>
              </div>
              <div class="score-val">${h.score}%</div>
            </div>
          </div>
        </div>`;
}

function renderAll(data) {
  const grid = document.getElementById("hospitalGrid");
  if (!data.length) {
    grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1/-1">
            <div class="empty-icon">🏥</div>
            <h3>No hospitals found</h3>
            <p>Try a different filter or expand your search area.</p>
          </div>`;
    document.getElementById("visibleCount").textContent = "";
    return;
  }
  grid.innerHTML = data.map((h, i) => renderCard(h, i + 1)).join("");
  document.getElementById("visibleCount").textContent =
    `${data.length} result${data.length !== 1 ? "s" : ""}`;
}

// ── Filter ──────────────────────────────────────────────────────────────
function filterCards(spec, el) {
  document
    .querySelectorAll(".chip")
    .forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  const filtered =
    spec === "all"
      ? hospitals
      : hospitals.filter((h) => h.specialisation === spec);
  renderAll(filtered);
}

// ── Stats ────────────────────────────────────────────────────────────────
function updateStats(data) {
  document.getElementById("statCount").textContent = data.length;
  const avgRating = (
    data.reduce((s, h) => s + h.rating, 0) / data.length
  ).toFixed(1);
  const avgBeds = Math.round(
    data.reduce((s, h) => s + h.beds, 0) / data.length,
  );
  const nearest = Math.min(...data.map((h) => h.distance));
  document.getElementById("statAvgRating").textContent = avgRating;
  document.getElementById("statAvgBeds").textContent = avgBeds;
  document.getElementById("statNearest").textContent = nearest;
}

// ── Geolocation header ───────────────────────────────────────────────────
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      document.getElementById("headerLocation").textContent =
        `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;

      // TODO: Replace mock data with real API call:
      // fetch(`http://127.0.0.1:8000/recommend?lat=${lat}&lng=${lng}`)
      //   .then(r => r.json())
      //   .then(data => { renderAll(data); updateStats(data); });
    },
    () => {
      document.getElementById("headerLocation").textContent =
        "Anantpur, Andhra Pradesh";
    },
  );
}

// ── Init ─────────────────────────────────────────────────────────────────
renderAll(hospitals);
updateStats(hospitals);
