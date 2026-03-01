const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");

const STORAGE_KEY = "checklist-state";

/* ---------------------------
   UTILITAIRES
--------------------------- */

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "crimson" : "inherit";
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------------------------
   RENDU
--------------------------- */

function createCheckbox(id, column, state) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!state[id]?.[column];

  input.addEventListener("change", () => {
    if (!state[id]) state[id] = { A: false, B: false };

    // Mise à jour indépendante
    state[id][column] = input.checked;

    saveState(state);
    setStatus("Enregistré ✅");
  });

  return input;
}

async function init() {
  try {
    setStatus("Chargement...");

    const res = await fetch("data.json", { cache: "no-store" });
    const rows = await res.json();

    if (!Array.isArray(rows)) {
      throw new Error("data.json doit être un tableau []");
    }

    const state = loadState();

    tbody.innerHTML = "";

    const fragment = document.createDocumentFragment();

    for (const row of rows) {
      const tr = document.createElement("tr");

      // Colonne texte
      const tdLabel = document.createElement("td");
      tdLabel.textContent = row.label;
      tr.appendChild(tdLabel);

      // Colonne A
      const tdA = document.createElement("td");
      tdA.style.textAlign = "center";
      tdA.appendChild(createCheckbox(row.id, "A", state));
      tr.appendChild(tdA);

      // Colonne B
      const tdB = document.createElement("td");
      tdB.style.textAlign = "center";
      tdB.appendChild(createCheckbox(row.id, "B", state));
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
