document
  .getElementById("hospitalForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    // Mapping HTML values to the Pydantic Model keys
    const data = {
      id: document.getElementById("hid").value,
      City: document.getElementById("city").value,
      State: document.getElementById("state").value,
      District: "Ananthapuramu", // Static for this example
      Latitude: parseFloat(document.getElementById("lat").value),
      Longitude: parseFloat(document.getElementById("lng").value),
      Rating: parseFloat(document.getElementById("rate").value),
      Specialisation: document.getElementById("spec").value,
      No_of_Beds: parseInt(document.getElementById("beds").value),
      Insurance_Schemes: document.getElementById("ins").value,
    };

    try {
      const response = await fetch("http://127.0.0.1:8000/submit-hospital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      document.getElementById("responseBox").style.display = "block";
      document.getElementById("responseText").innerText = result.ai_note;
    } catch (err) {
      alert("Check if FastAPI server is running!");
    }
  });
