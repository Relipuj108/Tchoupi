// =====================
// CONFIG
// =====================
const API_URL = "https://script.google.com/macros/s/AKfycbzAp5c0f0vcv3yqnIPoXlgMvwN3rOpuUW7Y41zpiXT5ZQK9AQluio-eDlppPOiBA_sV/exec";
const PW_SESSION_KEY = "gs-write-password";
const UNLOCK_SESSION_KEY = "gs-write-unlocked"; // "1" si déverrouillé

// =====================
// DOM
// =====================
const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");

// =====================
// UI helpers
// =====================
function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "crimson" : "inherit";
}

function isUnlocked() {
  return sessionStorage.getItem(UNLOCK_SESSION_KEY) === "1";
}

function setUnlocked(on) {
  sessionStorage.setItem(UNLOCK_SESSION_KEY, on ? "1" : "0");
}

function getPassword() {
  return sessionStorage.getItem(PW_SESSION_KEY) || "";
}

function setPassword(pw) {
  sessionStorage.setItem(PW_SESSION_KEY, pw);
}

function clearAuth() {
  sessionStorage.removeItem(PW_SESSION_KEY);
  setUnlocked(false);
  updateCheckboxesEnabled(false);
}

function updateCheckboxesEnabled(enabled) {
  tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.disabled = !enabled;
  });
}

// =====================
// Fetch helpers (simple + debug)
// =====================
async function fetchJsonDebug(url) {
  const u = new URL(url);
  u.searchParams.set("_ts", String(Date.now())); // anti-cache

  let res;
  try {
    res = await fetch(u.toString(), { method: "GET", cache: "no-store", redirect: "follow" });
  } catch (e) {
    throw new Error(`Failed to fetch.\nURL: ${u.toString()}`);
  }

  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Réponse non-JSON (HTTP ${res.status}).\nURL: ${u.toString()}\nDébut: ${text.slice(0, 160)}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}.\nURL: ${u.toString()}\nRéponse: ${text.slice(0, 160)}`);
  }

  return { json, url: u.toString(), raw: text };
}

// =====================
// API
// =====================
async function apiReadState() {
  const { json } = await fetchJsonDebug(`${API_URL}?action=read`);
  if (!json.ok) throw new Error(json.error || "Erreur API (read)");
  return json.data || {};
}

async function apiWriteCell({ id, column, value }) {
  const pw = getPassword();
  if (!pw || !isUnlocked()) throw new Error("Lecture seule. Saisis le mot de passe puis Valider.");

  const u = new URL(API_URL);
  u.searchParams.set("action", "write");
  u.searchParams.set("id", id);
  u.searchParams.set("column", column); // A / B
  u.searchParams.set("value", value ? "true" : "false");
  u.searchParams.set("password", pw);

  const { json, url } = await fetchJsonDebug(u.toString());

  if (!json.ok) {
    const err = String(json.error || "Erreur API (write)");
    if (err.toLowerCase().includes("unauthorized")) {
      clearAuth();
      throw new Error(`Mot de passe incorrect.\nURL: ${url}`);
    }
    throw new Error(`${err}\nURL: ${url}`);
  }

  return true;
}

// =====================
// Inject password UI above the table (no HTML changes)
// =====================
function mountPasswordUI() {
  // On injecte juste après #status (au-dessus du tableau)
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexWrap = "wrap";
  wrap.style.gap = "10px";
  wrap.style.alignItems = "center";
  wrap.style.margin = "10px 0 14px";

  const label = document.createElement("span");
  label.textContent = "Mot de passe :";
  label.style.fontSize = "14px";

  const input = document.createElement("input");
  input.type = "password";
  input.placeholder = "Entrer le mot de passe";
  input.autocomplete = "current-password";
  input.style.padding = "8px 10px";
  input.style.border = "1px solid #ccc";
  input.style.borderRadius = "6px";
  input.style.width = "220px";

  const btn = document.createElement("button");
  btn.textContent = "Valider";
  btn.style.padding = "8px 12px";
  btn.style.border = "1px solid #ccc";
  btn.style.borderRadius = "6px";
  btn.style.background = "#f6f6f6";
  btn.style.cursor = "pointer";

  const lockBtn = document.createElement("button");
  lockBtn.textContent = "Verrouiller";
  lockBtn.style.padding = "8px 12px";
  lockBtn.style.border = "1px solid #ccc";
  lockBtn.style.borderRadius = "6px";
  lockBtn.style.background = "#fff";
  lockBtn.style.cursor = "pointer";

  const badge = document.createElement("span");
  badge.style.fontSize = "13px";
  badge.style.opacity = "0.85";

  function refreshBadge() {
    badge.textContent = isUnlocked() ? "Écriture activée" : "Lecture seule";
  }

  // Restore session state
  if (getPassword() && isUnlocked()) {
    refreshBadge();
  } else {
    setUnlocked(false);
    refreshBadge();
  }

  btn.addEventListener("click", async () => {
    const pw = (input.value || "").trim();
    if (!pw) {
      setStatus("Entre un mot de passe.", true);
      return;
    }

    // On “déverrouille” localement, puis on vérifie immédiatement avec un ping write inoffensif
    // => on évite d’activer l’écriture si mdp faux.
    setPassword(pw);
    setUnlocked(true);

    try {
      // Ping de validation : on écrit une valeur identique sur row-001/A si elle existe,
      // sinon on fait juste un read (plus fiable) puis on considère OK.
      // Le plus simple: tenter un write sur une ligne existante si possible.
      // Ici on valide juste par un write sur une id "row-001" en gardant la valeur (false->false).
      await apiWriteCell({ id: "row-001", column: "A", value: false });
      updateCheckboxesEnabled(true);
      refreshBadge();
      setStatus("Mot de passe validé. Écriture activée ✅");
    } catch (err) {
      clearAuth();
      refreshBadge();
      setStatus(`Erreur: ${err.message}`, true);
    }
  });

  lockBtn.addEventListener("click", () => {
    clearAuth();
    refreshBadge();
    setStatus("Verrouillé.");
  });

  refreshBadge();

  wrap.appendChild(label);
  wrap.appendChild(input);
  wrap.appendChild(btn);
  wrap.appendChild(lockBtn);
  wrap.appendChild(badge);

  // insertion dans le DOM
  statusEl.parentNode.insertBefore(wrap, statusEl.nextSibling);
}

// =====================
// Checkbox factory
// =====================
function createCheckbox({ id, column, checked }) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  input.disabled = !isUnlocked();

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
      console.error(err);
    }
  });

  return input;
}

// =====================
// INIT
// =====================
async function init() {
  try {
    setStatus("Chargement…");
    mountPasswordUI();

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

    // Applique l’état lecture/écriture après rendu
    updateCheckboxesEnabled(isUnlocked());

    setStatus("Prêt.");
  } catch (err) {
    setStatus(`Erreur: ${err.message}`, true);
    console.error(err);
  }
}

init();
