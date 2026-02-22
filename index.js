import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

// get current folder path (needed in ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load .env file so we can use process.env
dotenv.config({ path: path.join(__dirname, ".env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// stop the server if no API key found
if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY not found in .env");
    process.exit(1);
}

// setup Gemini AI and Express
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const app = express();
app.use(cors());
app.use(express.json());

// load hospital data from JSON file
let hospitals = [];
try {
    const raw = fs.readFileSync(path.join(__dirname, "hospital.json"), "utf-8");
    hospitals = JSON.parse(raw);
    console.log(`✅ Loaded ${hospitals.length} hospitals`);
} catch (e) {
    console.error("❌ Could not load hospital.json:", e.message);
    process.exit(1);
}

// store referrals in memory (use a database in production)
const referrals = new Map();

// calculate distance between two GPS points in km
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// find top hospitals based on rating, specialisation match, and distance
function findBestHospitals(lat, lon, condition, topN = 5) {
    const conditionLower = condition.toLowerCase();

    const scored = hospitals.map((h) => {
        const dist = (lat && lon) ? haversine(lat, lon, h.Latitude, h.Longitude) : null;

        const specialisations = (h.Specialisation || "")
            .toLowerCase()
            .split(",")
            .map((s) => s.trim());

        // 1 if hospital matches the condition, 0 if not
        const specialisationMatch = specialisations.some((s) =>
            conditionLower.includes(s) || s.includes(conditionLower)
        ) ? 1 : 0;

        const ratingScore = (h.Rating || 0) / 5;
        const distanceScore = dist !== null ? Math.max(0, 1 - dist / 500) : 0.5;

        // final score: 50% rating + 30% specialisation + 20% distance
        const score = 0.5 * ratingScore + 0.3 * specialisationMatch + 0.2 * distanceScore;

        return { ...h, _distance: dist, _score: score };
    });

    // sort by score and return top N
    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, topN);
}

// conditions that need urgent/high priority care
const HIGH_PRIORITY_CONDITIONS = [
    "cardiology", "neurology", "oncology", "pulmonology", "nephrology"
];

// decide if patient needs high, medium, or normal priority
function getPriority(condition) {
    const c = condition.toLowerCase();
    if (HIGH_PRIORITY_CONDITIONS.some((hp) => c.includes(hp))) return "HIGH";
    if (["orthopedics", "gastroenterology", "endocrinology"].some((m) => c.includes(m)))
        return "MEDIUM";
    return "NORMAL";
}

// find which insurance schemes the patient can use
function getEligibleSchemes(hospitals, bplStatus, disabled, age) {
    const allSchemes = new Set();
    hospitals.forEach((h) => {
        (h["Insurance Schemes"] || "").split(",").forEach((s) => {
            allSchemes.add(s.trim());
        });
    });

    const eligible = [...allSchemes].filter((scheme) => {
        if (bplStatus === "below") return true;
        if (disabled === "yes" && ["AB-PMJAY", "NHM", "NRHM", "NUHM"].includes(scheme)) return true;
        if (age >= 60 && ["CGHS", "AB-PMJAY", "NHA"].includes(scheme)) return true;
        return ["CGHS", "AIIMS", "OPD"].includes(scheme);
    });

    return [...new Set(eligible)].slice(0, 6);
}

// make disease name look nice e.g. "cardiology" → "Cardiology"
function formatDisease(disease, otherDisease) {
    if (disease === "other") return otherDisease || "Other";
    return disease.charAt(0).toUpperCase() + disease.slice(1);
}

// ask Gemini AI to explain why these hospitals were recommended
async function getAIExplanation(patient, topHospitals) {
    const hospitalList = topHospitals
        .map((h, i) =>
            `${i + 1}. ${h.id} — ${h.City}, ${h.State} | Rating: ${h.Rating} | ` +
            `Specialisation: ${h.Specialisation} | Beds: ${h["No of Beds"]} | ` +
            `Distance: ${h._distance !== null ? h._distance.toFixed(1) + " km" : "N/A"} | ` +
            `Schemes: ${h["Insurance Schemes"]}`
        )
        .join("\n");

    const prompt = `
You are a medical referral assistant for India's public healthcare system.

Patient Profile:
- Name: ${patient.name}
- Age: ${patient.age}, Gender: ${patient.gender}
- Condition requiring referral: ${patient.diseaseLabel}
- Income: ${patient.bplStatus === "below" ? "Below BPL" : "Above BPL"}
- Disability: ${patient.disabled === "yes" ? "Yes" : "No"}
- Current Hospital: ${patient.hospital}
- Location: ${patient.lat ? `${patient.lat.toFixed(4)}, ${patient.lon.toFixed(4)}` : "Not provided"}

Top Recommended Hospitals (ranked by AI scoring):
${hospitalList}

Task:
1. In 2-3 sentences, explain WHY these specific hospitals were recommended for this patient.
2. Mention the most relevant hospital by name and its key strengths (specialisation, rating, proximity if applicable).
3. Note any relevant insurance schemes the patient may benefit from given their profile.
4. Keep tone professional, concise, and human-readable.

Do NOT use bullet points. Write in clear prose.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
        });
        return response.text?.trim() || null;
    } catch (err) {
        console.error("Gemini error:", err.message);
        return null;
    }
}

// fetch real nearby hospitals from OpenStreetMap using GPS
async function getNearbyFromOSM(lat, lon, radiusKm = 25) {
    const radiusM = radiusKm * 1000;
    const query = `
    [out:json][timeout:10];
    (
      node["amenity"="hospital"](around:${radiusM},${lat},${lon});
      way["amenity"="hospital"](around:${radiusM},${lat},${lon});
    );
    out center 10;
  `;

    try {
        const res = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `data=${encodeURIComponent(query)}`,
            signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) return [];

        const json = await res.json();
        return (json.elements || []).map((el) => {
            const osmLat = el.lat || el.center?.lat;
            const osmLon = el.lon || el.center?.lon;
            return {
                osm_id: el.id,
                name: el.tags?.name || "Unnamed Hospital",
                lat: osmLat,
                lon: osmLon,
                distance_km: (osmLat && osmLon)
                    ? parseFloat(haversine(lat, lon, osmLat, osmLon).toFixed(2))
                    : null,
                address: [
                    el.tags?.["addr:street"],
                    el.tags?.["addr:city"],
                    el.tags?.["addr:state"],
                ].filter(Boolean).join(", "),
                phone: el.tags?.phone || el.tags?.["contact:phone"] || null,
                website: el.tags?.website || null,
                emergency: el.tags?.emergency || null,
            };
        });
    } catch (err) {
        console.warn("OSM fetch failed:", err.message);
        return [];
    }
}

// simple health check so frontend knows the server is alive
app.get("/health", (req, res) => {
    res.json({ status: "ok", hospitals_loaded: hospitals.length });
});

// main route: takes patient data and returns hospital recommendations
app.post("/api/referral", async (req, res) => {
    const {
        name, age, gender, hospital, disease, otherDisease,
        bplStatus, disabled, location, address, timestamp,
    } = req.body;

    // check all required fields are present
    const errors = [];
    if (!name?.trim()) errors.push("name is required");
    if (!age || typeof age !== "number" || !Number.isInteger(age) || age <= 0 || age > 120)
        errors.push("age must be a whole number between 1 and 120");
    if (!gender) errors.push("gender is required");
    if (!hospital?.trim()) errors.push("hospital is required");
    if (!disease) errors.push("disease/condition is required");
    if (disease === "other" && !otherDisease?.trim())
        errors.push("otherDisease is required when disease is 'other'");
    if (!bplStatus) errors.push("bplStatus is required");
    if (!disabled) errors.push("disabled status is required");

    if (errors.length > 0) {
        return res.status(422).json({ detail: errors });
    }

    // get GPS from request body
    const lat = location?.lat ?? null;
    const lon = location?.lng ?? null;
    const diseaseLabel = formatDisease(disease, otherDisease);

    // get top 5 hospitals from our database
    const topHospitals = findBestHospitals(lat, lon, diseaseLabel, 5);

    // get real hospitals nearby from OpenStreetMap (only if GPS available)
    let nearbyOSM = [];
    if (lat && lon) {
        nearbyOSM = await getNearbyFromOSM(lat, lon, 30);
    }

    // get AI explanation from Gemini
    const patientContext = { name, age, gender, hospital, diseaseLabel, bplStatus, disabled, lat, lon };
    const aiExplanation = await getAIExplanation(patientContext, topHospitals);

    const priority = getPriority(diseaseLabel);
    const schemesEligible = getEligibleSchemes(topHospitals, bplStatus, disabled, age);

    // create a unique ID for this referral
    const referralId = "REF-" + uuidv4().slice(0, 8).toUpperCase();

    const record = {
        referral_id: referralId,
        patient_name: name,
        age,
        gender,
        current_hospital: hospital,
        disease_label: diseaseLabel,
        priority,
        bpl_status: bplStatus,
        disabled,
        location: lat && lon ? { lat, lon } : null,
        address: address || null,
        received_at: timestamp || new Date().toISOString(),

        // list of top recommended hospitals
        recommended_hospitals: topHospitals.map((h) => ({
            id: h.id,
            city: h.City,
            state: h.State,
            district: h.District,
            rating: h.Rating,
            reviews: h["Number of Reviews"],
            specialisation: h.Specialisation,
            beds: h["No of Beds"],
            schemes: h["Insurance Schemes"],
            coordinates: { lat: h.Latitude, lon: h.Longitude },
            distance_km: h._distance !== null ? parseFloat(h._distance.toFixed(2)) : null,
            score: parseFloat(h._score.toFixed(3)),
        })),

        // real hospitals pulled from OpenStreetMap
        nearby_osm_hospitals: nearbyOSM,

        // AI explanation or fallback message if Gemini fails
        ai_explanation:
            aiExplanation ||
            `${topHospitals[0]?.id} in ${topHospitals[0]?.City} is recommended based on its ` +
            `rating of ${topHospitals[0]?.Rating} and specialisation in ${topHospitals[0]?.Specialisation}, ` +
            `making it well-suited for ${diseaseLabel} cases.`,

        schemes_eligible: schemesEligible,
    };

    // save referral and send response
    referrals.set(referralId, record);
    return res.status(200).json(record);
});

// get a saved referral by its ID
app.get("/api/referral/:id", (req, res) => {
    const record = referrals.get(req.params.id);
    if (!record) {
        return res.status(404).json({ detail: "Referral not found" });
    }
    res.json(record);
});

// find hospitals near a GPS location
app.get("/api/hospitals/nearby", async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const condition = req.query.condition || "";
    const radius = parseInt(req.query.radius) || 50;

    if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ detail: "lat and lon are required query params" });
    }

    const fromJson = findBestHospitals(lat, lon, condition, 10).map((h) => ({
        source: "database",
        id: h.id,
        city: h.City,
        state: h.State,
        specialisation: h.Specialisation,
        rating: h.Rating,
        beds: h["No of Beds"],
        schemes: h["Insurance Schemes"],
        coordinates: { lat: h.Latitude, lon: h.Longitude },
        distance_km: h._distance !== null ? parseFloat(h._distance.toFixed(2)) : null,
    }));

    const fromOSM = (await getNearbyFromOSM(lat, lon, radius)).map((h) => ({
        source: "openstreetmap",
        ...h,
    }));

    res.json({
        query: { lat, lon, condition, radius_km: radius },
        database_hospitals: fromJson,
        osm_hospitals: fromOSM,
        total: fromJson.length + fromOSM.length,
    });
});

// welcome message at root URL
app.get("/", (req, res) => {
    res.json({
        message: "Welcome to Jeevan-Setu API",
        status: "active",
        documentation: "/health"
    });
});

// handle unknown routes
app.use((req, res) => res.status(404).json({ detail: "Route not found" }));

// handle unexpected server errors
app.use((err, req, res, next) => {
    console.error("Unhandled:", err.message);
    res.status(500).json({ detail: "Internal server error" });
});

// start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`🚀 Jeevan-Setu API running → http://localhost:${PORT}`);
    console.log(`   POST /api/referral`);
    console.log(`   GET  /api/referral/:id`);
    console.log(`   GET  /api/hospitals/nearby?lat=&lon=&condition=`);
    console.log(`   GET  /health`);
});
