const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "crimson" : "inherit";
}

function loadLocalState() {
  try {
    return JSON.parse(localStorage.getItem("choices") || "{}");
  } catch {
    return {};
  }
}

function saveLocalState(state) {
  localStorage.setItem("choices", JSON.stringify(state));
}

function makeRadio(id, name, value, checked, onChange) {
  const label = document.createElement("label");
  label.style.display = "inline-flex";
  label.style.alignItems = "center";
  label.style.gap = "8px";

  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = checked;
  input.addEventListener("change", onChange);

  const txt = document.createElement("span");
  txt.textContent = value;

  label.appendChild(input);
  label.appendChild(txt);
  return label;
}

async function main() {
  try {
    setStatus("Chargement…");
    const res = await fetch("data.json", { cache: "no-store" });
    const rows = await res.json();

    const state = loadLocalState();

    tbody.innerHTML = "";
    for (const r of rows) {
      const tr = document.createElement("tr");

      const tdLabel = document.createElement("td");
      tdLabel.textContent = r.label;
      tr.appendChild(tdLabel);

      const tdA = document.createElement("td");
      const tdB = document.createElement("td");

      const name = `choice-${r.id}`;
      const saved = state[r.id] || "";

      tdA.appendChild(makeRadio(r.id, name, "A", saved === "A", () => {
        state[r.id] = "A";
        saveLocalState(state);
        setStatus("Enregistré (local) ✅");
      }));

      tdB.appendChild(makeRadio(r.id, name, "B", saved === "B", () => {
        state[r.id] = "B";
        saveLocalState(state);
        setStatus("Enregistré (local) ✅");
      }));

      tr.appendChild(tdA);
      tr.appendChild(tdB);

      tbody.appendChild(tr);
    }

    setStatus("Prêt (sauvegarde locale).");
  } catch (err) {
    setStatus(`Erreur: ${err.message}`, true);
  }
}

main();