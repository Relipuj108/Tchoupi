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

function lockWrite() {
  sessionStorage.setItem(UNLOCK_SESSION_KEY, "0");
  updateCheckboxesEnabled(false);
}

function unlockWrite(password) {
  sessionStorage.setItem(PW_SESSION_KEY, password);
  sessionStorage.setItem(UNLOCK_SESSION_KEY, "1");
  updateCheckboxesEnabled(true);
}

function getPassword() {
  return sessionStorage.getItem(PW_SESSION_KEY) || "";
}

function clearPassword() {
  sessionStorage.removeItem(PW_SESSION_KEY);
  sessionStorage.setItem(UNLOCK_SESSION_KEY, "0");
  updateCheckboxesEnabled(false);
}

function updateCheckboxesEnabled(enabled) {
  const inputs = tbody.querySelectorAll('input[type="checkbox"]');
  inputs.forEach(i => (i.disabled = !enabled));
}

// =====================
// Fetch helpers (troubleshoot simple)
// =====================
async function fetchText(url) {
  // Pour éviter les caches et rendre le debug reproductible
  const finalUrl = new URL(url);
  finalUrl.searchParams.set("_ts", String(Date.now()));

  let res;
  try {
    res = await fetch(finalUrl.toString(), { method: "GET", cache: "no-store", redirect: "follow" });
  } catch (e) {
    // typiquement CORS/redirect réseau
    throw new Error(`Failed to fetch.\nURL: ${finalUrl.toString()}`);
  }

  const text = await res.text();
  return { okHttp: res.ok, status: res.status, text, url: finalUrl.toString() };
}

async function fetchJson(url) {
  const { okHttp, status, text, url: usedUrl } = await fetchText(url);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    // si Google renvoie du HTML, on le verra ici
    throw new Error(`Réponse non-JSON (HTTP ${status}).\nURL: ${usedUrl}\nDébut: ${text.slice(0, 160)}`);
  }

  if (!okHttp) {
    throw new Error(`HTTP ${status}.\nURL: ${usedUrl}\nRéponse: ${text.slice(0, 160)}`);
  }

  return { json, usedUrl, raw: text };
}

// =====================
// API
// =====================
async function apiReadState() {
  const url = `${API_URL}?action=read`;
  const { json } = await fetchJson(url);
  if (!json.ok) throw new Error(json.error || "Erreur API (read)");
  return json.data || {};
}

async function apiWriteCell({ id, column, value }) {
  const password = getPassword();
  if (!password) throw new Error("Mot de passe non défini. Clique sur Valider.");

  const url = new URL(API_URL);
  url.searchParams.set("action", "write");
  url.searchParams.set("id", id);
  url.searchParams.set("column", column); // A / B
  url.searchParams.set("value", value ? "true" : "false");
  url.searchParams.set("password", password);

  const { json, usedUrl, raw } = await fetchJson(url.toString());

  // Troubleshoot: si "Unknown action", on veut voir l’URL exacte et la réponse
  if (!json.ok) {
    const err = String(json.error || "Erreur API (write)");
    if (err.toLowerCase().includes("unauthorized")) {
      clearPassword();
    }
    throw new Error(`${err}\nURL: ${usedUrl}\nRéponse brute: ${raw.slice(0, 200)}`);
  }

  return true;
}

// =====================
// UI injection: password + button
// =====================
function mountUnlockUI() {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "10px";
  wrap.style.alignItems = "center";
  wrap.style.margin = "10px 0 14px";

  const pw = document.createElement("input");
  pw.type = "password";
  pw.placeholder = "Mot de passe";
  pw.autocomplete = "current-password";
  pw.style.padding = "8px 10px";
  pw.style.border = "1px solid #ccc";
  pw.style.borderRadius = "6px";
  pw.style.maxWidth = "220px";

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
    badge.textContent = isUnlocked() ? "Mode écriture : ON" : "Mode écriture : OFF";
  }

  btn.addEventListener("click", async () => {
    const pass = (pw.value || "").trim();
    if (!pass) {
      setStatus("Entre un mot de passe.", true);
      return;
    }

    // On déverrouille sans ping serveur.
    // Si le MDP est faux, la 1ère écriture renverra Unauthorized et on reverrouille.
    unlockWrite(pass);
    refreshBadge();
    setStatus("Déverrouillé. Tu peux cocher ✅");
  });

  lockBtn.addEventListener("click", () => {
    clearPassword();
    refreshBadge();
    setStatus("Verrouillé.");
  });

  refreshBadge();

  wrap.appendChild(pw);
  wrap.appendChild(btn);
  wrap.appendChild(lockBtn);
  wrap.appendChild(badge);

  // On insère avant le tableau (dans status container ou juste au-dessus du tableau)
  statusEl.parentNode.insertBefore(wrap, statusEl.nextSibling);
}

// =====================
// Checkbox factory
// =====================
function createCheckbox({ id, column, checked }) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  input.disabled = !isUnlocked(); // read-only tant que non validé

  input.addEventListener("change", async () => {
    // si verrouillé, on annule immédiatement
    if (!isUnlocked()) {
      input.checked = !input.checked;
      setStatus("Lecture seule. Entre le mot de passe puis Valider.", true);
      return;
    }

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
    mountUnlockUI();

    // lignes (data.json)
    const listRes = await fetch("data.json", { cache: "no-store" });
    const rows = await listRes.json();
    if (!Array.isArray(rows)) throw new Error("data.json doit être un tableau []");

    // état depuis Sheets
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

    // Si déjà déverrouillé en session, réactive les checkbox
    updateCheckboxesEnabled(isUnlocked());

    setStatus("Prêt.");
  } catch (err) {
    setStatus(`Erreur: ${err.message}`, true);
    console.error(err);
  }
}

init();
