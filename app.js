// ====== CONFIG ======
const API_URL = "https://script.google.com/macros/s/AKfycbxBRIgHFpwEMgRDn6gIEu4Zot8yEUb-7xsnThmFuprOfvnHPhI3tNKmqoUvw_TNRDbP/exec";
const PW_SESSION_KEY = "gs-write-password";

// ====== DOM ======
const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");

// ====== UI ======
function setStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "crimson" : "inherit";
}

// ====== PASSWORD (session) ======
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
  const json = await res.json().catch(() => null);
  if (!json || !json.ok) throw new Error(json?.error || "Lecture impossible");
  return json.data || {}; // { "row-001": {A:true,B:false}, ... }
}

async function apiWriteCell({ id, column, value }) {
  const password = ensurePassword();

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "write",
      id,
      column,     // "A" | "B"
      value,      // boolean
      password
    })
  });

  const json = await res.json().catch(() => null);

  if (!json || !json.ok) {
    // si mauvais mdp, on le purge pour forcer une nouvelle saisie
    const err = (json?.error || "Écriture impossible").toString();
    if (err.toLowerCase().includes("unauthorized")) clearPassword();
    throw new Error(err);
  }

  return true;
}

// ====== CHECKBOX FACTORY ======
function createCheckbox({ id, column, checked }) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  input.setAttribute("aria-label", `${id}-${column}`);

  input.addEventListener("change", async () => {
    const newValue = input.checked;       // valeur voulue
    const previousValue = !newValue;      // pour rollback si erreur

    try {
      setStatus("Sauvegarde…");
      await apiWriteCell({ id, column, value: newValue });
      setStatus("Enregistré ✅");
    } catch (err) {
      // rollback visuel
      input.checked = previousValue;
      setStatus(`Erreur: ${err.message}`, true);
    }
  });

  return input;
}

// ====== BOOTSTRAP ======
async function init() {
  try {
    setStatus("Chargement…");

    // 1) Liste statique des lignes
    const listRes = await fetch("data.json", { cache: "no-store" });
    const rows = await listRes.json();

    if (!Array.isArray(rows)) {
      throw new Error("data.json doit être un tableau JSON []");
    }

    // 2) État depuis Google Sheets
    const state = await apiReadState();

    // 3) Render
    tbody.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (const row of rows) {
      const tr = document.createElement("tr");

      const tdLabel = document.createElement("td");
      tdLabel.textContent = row.label || row.id;
      tr.appendChild(tdLabel);

      const tdA = document.createElement("td");
      tdA.style.textAlign = "center";
      tdA.appendChild(
        createCheckbox({
          id: row.id,
          column: "A",
          checked: state[row.id]?.A
        })
      );
      tr.appendChild(tdA);

      const tdB = document.createElement("td");
      tdB.style.textAlign = "center";
      tdB.appendChild(
        createCheckbox({
          id: row.id,
          column: "B",
          checked: state[row.id]?.B
        })
      );
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

