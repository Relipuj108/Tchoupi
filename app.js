const tbody = document.getElementById("tbody");
const statusEl = document.getElementById("status");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "crimson" : "inherit";
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem("choices");
    const parsed = raw ? JSON.parse(raw) : {};
    // Normalisation minimale
    for (const k of Object.keys(parsed)) {
      parsed[k] = {
        A: !!parsed[k]?.A,
        B: !!parsed[k]?.B
      };
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveLocalState(state) {
  localStorage.setItem("choices", JSON.stringify(state));
}

function makeCheckbox(id, col, checked, onChange) {
  const label = document.createElement("label");
  label.style.display = "inline-flex";
  label.style.alignItems = "center";
  label.style.gap = "8px";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.setAttribute("data-id", id);
  input.setAttribute("data-col", col);
  input.addEventListener("change", onChange);

  const txt = document.createElement("span");
  txt.textContent = col;

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
      // init si absent
      if (!state[r.id]) state[r.id] = { A: false, B: false };

      const tr = document.createElement("tr");

      const tdLabel = document.createElement("td");
      tdLabel.textContent = r.label;
      tr.appendChild(tdLabel);

      const tdA = document.createElement("td");
      const tdB = document.createElement("td");

      tdA.appendChild(
        makeCheckbox(r.id, "A", state[r.id].A, (e) => {
          state[r.id].A = e.target.checked;
          saveLocalState(state);
          setStatus("Enregistré (local) ✅");
        })
      );

      tdB.appendChild(
        makeCheckbox(r.id, "B", state[r.id].B, (e) => {
          state[r.id].B = e.target.checked;
          saveLocalState(state);
          setStatus("Enregistré (local) ✅");
        })
      );

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
