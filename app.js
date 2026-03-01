// ======================
// CONFIG
// ======================
const API_URL = "https://script.google.com/macros/s/AKfycbzAp5c0f0vcv3yqnIPoXlgMvwN3rOpuUW7Y41zpiXT5ZQK9AQluio-eDlppPOiBA_sV/exec";

// ======================
// DOM
// ======================
const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");

const passwordInput = document.getElementById("passwordInput");
const unlockBtn = document.getElementById("unlockBtn");
const authStatus = document.getElementById("authStatus");

// ======================
// STATE
// ======================
let isWriteEnabled = false;
let currentPassword = "";

// ======================
// UI
// ======================
function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "crimson" : "inherit";
}

function updateCheckboxState() {
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.disabled = !isWriteEnabled;
  });
}

// ======================
// AUTH
// ======================
unlockBtn.addEventListener("click", () => {
  const pw = passwordInput.value.trim();

  if (!pw) {
    authStatus.textContent = "Entre un mot de passe";
    return;
  }

  currentPassword = pw;
  isWriteEnabled = true;

  authStatus.textContent = "Écriture activée";
  updateCheckboxState();
});

// ======================
// FETCH UTIL
// ======================
async function fetchJsonDebug(url) {
  const u = new URL(url);
  u.searchParams.set("_ts", Date.now().toString()); // anti-cache

  let res;
  try {
    res = await fetch(u.toString(), {
      method: "GET",
      cache: "no-store",
      redirect: "follow"
    });
  } catch (e) {
    throw new Error("Failed to fetch : " + u.toString());
  }

  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Réponse non JSON : " + text.slice(0, 150));
  }

  if (!res.ok) {
    throw new Error("HTTP " + res.status + " : " + text.slice(0, 150));
  }

  return json;
}

// ======================
// API
// ======================
async function apiReadState() {
  const url = `${API_URL}?action=read`;
  const json = await fetchJsonDebug(url);

  if (!json.ok) throw new Error(json.error || "Erreur API read");

  return json.data || {};
}

async function apiWriteCell({ id, column, value }) {
  const url = new URL(API_URL);

  url.searchParams.set("action", "write");
  url.searchParams.set("id", id);
  url.searchParams.set("column", column);
  url.searchParams.set("value", value ? "true" : "false");
  url.searchParams.set("password", currentPassword);

  const json = await fetchJsonDebug(url.toString());

  if (!json.ok) {
    throw new Error(json.error || "Erreur API write");
  }

  return true;
}

// ======================
// CHECKBOX FACTORY
// ======================
function createCheckbox({ id, column, checked }) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  input.disabled = !isWriteEnabled;

  input.addEventListener("change", async () => {

    if (!isWriteEnabled) return;

    const newValue = input.checked;
    const previousValue = !newValue;

    try {
      setStatus("Sauvegarde…");
      await apiWriteCell({ id, column, value: newValue });
      setStatus("Enregistré ✅");
    } catch (err) {
      input.checked = previousValue;
      setStatus("Erreur : " + err.message, true);
      console.error(err);
    }
  });

  return input;
}

// ======================
// INIT
// ======================
async function init() {
  try {
    setStatus("Chargement…");

    // 1️⃣ Charger la liste
    const listRes = await fetch("data.json", { cache: "no-store" });
    const rows = await listRes.json();

    if (!Array.isArray(rows)) {
      throw new Error("data.json doit être un tableau []");
    }

    // 2️⃣ Charger état depuis Google Sheets
    const state = await apiReadState();

    tbody.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (const row of rows) {
      const tr = document.createElement("tr");

      const tdLabel = document.createElement("td");
      tdLabel.textContent = row.label || row.id;
      tr.appendChild(tdLabel);

      const tdA = document.createElement("td");
      tdA.style.textAlign = "center";
      tdA.appendChild(createCheckbox({
        id: row.id,
        column: "A",
        checked: state[row.id]?.A
      }));
      tr.appendChild(tdA);

      const tdB = document.createElement("td");
      tdB.style.textAlign = "center";
      tdB.appendChild(createCheckbox({
        id: row.id,
        column: "B",
        checked: state[row.id]?.B
      }));
      tr.appendChild(tdB);

      fragment.appendChild(tr);
    }

    tbody.appendChild(fragment);

    updateCheckboxState();

    setStatus("Prêt.");

  } catch (err) {
    setStatus("Erreur : " + err.message, true);
    console.error(err);
  }
}

init();
