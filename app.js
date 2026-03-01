// ======================
// CONFIG
// ======================
const API_URL = "https://script.google.com/macros/s/AKfycbz1I-qr2PeVPNdkwRO6sUDny89OK5xIFjAXASV4-I_nS6WYAI0Yy6YvTxc6FSZEXobX/exec";

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

  if (pw.toLowerCase() !== "louise") {
    authStatus.textContent = "Mot de passe incorrect";
    return;
  }

  currentPassword = pw;
  isWriteEnabled = true;

  authStatus.textContent = "Écriture activée";
  updateCheckboxState();
});

// ======================
// FETCH UTIL (avec timestamp)
// ======================
async function fetchJson(url) {
  const u = new URL(url);

  // 🔥 Anti-cache (Safari/iPhone)
  u.searchParams.set("_ts", Date.now().toString());

  const res = await fetch(u.toString(), {
    method: "GET",
    cache: "no-store",
    redirect: "follow"
  });

  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Réponse non JSON");
  }

  if (!res.ok) {
    throw new Error("HTTP " + res.status);
  }

  return json;
}

// ======================
// API
// ======================
async function apiReadState() {
  const json = await fetchJson(`${API_URL}?action=read`);
  if (!json.ok) throw new Error(json.error || "Erreur read");
  return json.data || {};
}

async function apiWriteCell({ id, column, value }) {
  const u = new URL(API_URL);

  u.searchParams.set("action", "write");
  u.searchParams.set("id", id);
  u.searchParams.set("column", column);
  u.searchParams.set("value", value ? "true" : "false");
  u.searchParams.set("password", currentPassword);

  const json = await fetchJson(u.toString());

  if (!json.ok) {
    throw new Error(json.error || "Erreur write");
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

    const listRes = await fetch("data.json", { cache: "no-store" });
    const rows = await listRes.json();

    const state = await apiReadState();

    tbody.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (const row of rows) {
      const tr = document.createElement("tr");

      const tdLabel = document.createElement("td");
      tdLabel.textContent = row.label;
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
  }
}

init();
