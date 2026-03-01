// ====== CONFIG ======
const API_URL = "https://script.google.com/macros/s/AKfycbxwM_jr9YWSJeiLibhH0U_1EDFxitguJmFTbLJVFof1T9TYyEojaDa-GaLCJPOr96dz/exec";
const PW_SESSION_KEY = "gs-write-password";

// ====== DOM ======
const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");

// ====== UI ======
function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "crimson" : "inherit";
}

// ====== PASSWORD ======
function getPassword() {
  return sessionStorage.getItem(PW_SESSION_KEY) || "";
}
function setPassword(pw) {
  sessionStorage.setItem(PW_SESSION_KEY, pw);
}
function clearPassword() {
  sessionStorage.removeItem(PW_SESSION_KEY);
}
function ensurePassword() {
  let pw = getPassword();
  if (!pw) {
    pw = prompt("Mot de passe pour enregistrer :") || "";
    if (!pw) throw new Error("Mot de passe requis");
    setPassword(pw);
  }
  return pw;
}

// ====== API ======
async function apiReadState() {
  const res = await fetch(`${API_URL}?action=read`, { cache: "no-store" });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("Réponse non-JSON (read)"); }
  if (!json.ok) throw new Error(json.error || "Erreur API (read)");
  return json.data || {};
}

async function apiWriteCell({ id, column, value }) {
  const password = ensurePassword();

  const url = new URL(API_URL);
  url.searchParams.set("action", "write");
  url.searchParams.set("id", id);
  url.searchParams.set("column", column);
  url.searchParams.set("value", value ? "true" : "false");
  url.searchParams.set("password", password);

  const res = await fetch(url.toString(), { cache: "no-store" });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("Réponse non-JSON (write)"); }

  if (!json.ok) {
    const err = String(json.error || "Erreur API (write)");
    if (err.toLowerCase().includes("unauthorized")) clearPassword();
    throw new Error(err);
  }
  return true;
}

// ====== CHECKBOX ======
function createCheckbox({ id, column, checked }) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;

  input.addEventListener("change", async () => {
    const newValue = input.checked;
    const previousValue = !newValue;

    try {
      setStatus("Sauvegarde…");
      await apiWriteCell({ id, column, value: newValue });
      setStatus("Enregistré ✅");
    } catch (err) {
      input.checked = previousValue;
      setStatus(`Erreur: ${err.message}`, true);
    }
  });

  return input;
}

// ====== INIT ======
async function init() {
  try {
    setStatus("Chargement…");

    const listRes = await fetch("data.json", { cache: "no-store" });
    const rows = await listRes.json();
    if (!Array.isArray(rows)) throw new Error("data.json doit être un tableau []");

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
      tdA.appendChild(createCheckbox({ id: row.id, column: "A", checked: state[row.id]?.A }));
      tr.appendChild(tdA);

      const tdB = document.createElement("td");
      tdB.style.textAlign = "center";
      tdB.appendChild(createCheckbox({ id: row.id, column: "B", checked: state[row.id]?.B }));
      tr.appendChild(tdB);

      fragment.appendChild(tr);
    }

    tbody.appendChild(fragment);
    setStatus("Prêt.");
  } catch (err) {
    setStatus(`Erreur: ${err.message}`, true);
  }
}

init();
