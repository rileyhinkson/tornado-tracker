(function () {
  const params = new URLSearchParams(window.location.search);
  const year = params.get("y");

  let records = [];
  let sortKey = "date";
  let sortDir = "asc";

  if (!year) {
    showError("No year selected.");
    return;
  }

  Promise.all([
    fetch("../data/index.json").then((r) => r.json()),
    fetch(`../data/years/${encodeURIComponent(year)}.json`).then((r) => {
      if (!r.ok) throw new Error("not found");
      return r.json();
    }),
  ])
    .then(([index, yearRecords]) => {
      records = yearRecords;
      renderYearNav(index);
      renderStats(index[year], yearRecords);
      populateFilters(yearRecords);
      wireControls();
      sortAndRenderRows();
    })
    .catch((err) => {
      console.error(err);
      showError(`No data found for ${year}.`);
    });

  function showError(message) {
    document.getElementById("year-title").textContent = "Tornado Tracker";
    document.getElementById("year-body").innerHTML =
      `<div class="empty-state">${escapeText(message)} <a href="../index.html">Back to all years</a></div>`;
  }

  function escapeText(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function renderYearNav(index) {
    const years = Object.keys(index).map(Number).sort((a, b) => a - b);
    const currentIdx = years.indexOf(Number(year));

    document.title = `${year} tornadoes — Tornado Tracker`;
    document.getElementById("year-title").textContent = `${year} tornadoes`;

    const prevYear = currentIdx > 0 ? years[currentIdx - 1] : null;
    const nextYear = currentIdx < years.length - 1 ? years[currentIdx + 1] : null;

    const prevLink = document.getElementById("prev-year");
    const nextLink = document.getElementById("next-year");
    if (prevYear) {
      prevLink.href = `index.html?y=${prevYear}`;
      prevLink.textContent = `← ${prevYear}`;
    } else {
      prevLink.style.visibility = "hidden";
    }
    if (nextYear) {
      nextLink.href = `index.html?y=${nextYear}`;
      nextLink.textContent = `${nextYear} →`;
    } else {
      nextLink.style.visibility = "hidden";
    }

    const select = document.getElementById("year-select");
    years.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      if (y === Number(year)) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      window.location.href = `index.html?y=${select.value}`;
    });
  }

  function renderStats(summary, yearRecords) {
    const stateCounts = {};
    yearRecords.forEach((r) => {
      stateCounts[r.state] = (stateCounts[r.state] || 0) + 1;
    });
    let topState = null, topStateCount = -1;
    Object.entries(stateCounts).forEach(([st, count]) => {
      if (count > topStateCount) {
        topStateCount = count;
        topState = st;
      }
    });

    const stats = [
      ["Tornadoes", formatNumber(summary.count)],
      ["Fatalities", formatNumber(summary.fatalities)],
      ["Injuries", formatNumber(summary.injuries)],
      ["Strongest", summary.strongest],
      ["Most active state", topState ? `${topState} (${topStateCount})` : "—"],
    ];

    const grid = document.getElementById("stat-grid");
    grid.innerHTML = "";
    stats.forEach(([label, value]) => {
      const tile = document.createElement("div");
      tile.className = "stat-tile";
      const l = document.createElement("div");
      l.className = "label";
      l.textContent = label;
      const v = document.createElement("div");
      v.className = "value";
      v.textContent = value;
      tile.appendChild(l);
      tile.appendChild(v);
      grid.appendChild(tile);
    });
  }

  function populateFilters(yearRecords) {
    const states = Array.from(new Set(yearRecords.map((r) => r.state))).sort();
    const stateSelect = document.getElementById("state-filter");
    states.forEach((st) => {
      const opt = document.createElement("option");
      opt.value = st;
      opt.textContent = st;
      stateSelect.appendChild(opt);
    });

    const magnitudes = Array.from(new Set(yearRecords.map((r) => r.magnitude)))
      .sort((a, b) => magnitudeRank(b) - magnitudeRank(a));
    const magSelect = document.getElementById("magnitude-filter");
    magnitudes.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      magSelect.appendChild(opt);
    });
  }

  function wireControls() {
    document.getElementById("state-filter").addEventListener("change", sortAndRenderRows);
    document.getElementById("magnitude-filter").addEventListener("change", sortAndRenderRows);

    document.querySelectorAll("table.data-table thead th").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        if (sortKey === key) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortKey = key;
          sortDir = "asc";
        }
        sortAndRenderRows();
      });
    });
  }

  function sortAndRenderRows() {
    const stateVal = document.getElementById("state-filter").value;
    const magVal = document.getElementById("magnitude-filter").value;

    let rows = records.slice();
    if (stateVal) rows = rows.filter((r) => r.state === stateVal);
    if (magVal) rows = rows.filter((r) => r.magnitude === magVal);

    rows.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "magnitude") {
        av = magnitudeRank(a.magnitude);
        bv = magnitudeRank(b.magnitude);
      }
      if (sortKey === "date") {
        av = `${a.date} ${a.time}`;
        bv = `${b.date} ${b.time}`;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    const tbody = document.getElementById("records-table-body");
    tbody.innerHTML = "";

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 8;
      td.className = "empty-state";
      td.textContent = "No tornadoes match these filters.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        [
          `${r.date} ${r.time.slice(0, 5)}`,
          `${r.stateName} (${r.state})`,
          r.magnitude,
          formatNumber(r.fatalities),
          formatNumber(r.injuries),
          `${r.lengthMiles.toFixed(1)} mi`,
          `${r.widthYards.toFixed(0)} yd`,
          r.propertyLoss,
        ].forEach((val, i) => {
          const td = document.createElement("td");
          if (i === 2) {
            const pill = document.createElement("span");
            pill.className = "magnitude-pill" + (magnitudeRank(val) >= 4 ? " mag-strong" : "");
            pill.textContent = val;
            td.appendChild(pill);
          } else {
            td.textContent = val;
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    document.getElementById("result-count").textContent =
      `${rows.length} tornado${rows.length === 1 ? "" : "es"}`;

    document.querySelectorAll("table.data-table thead th").forEach((th) => {
      th.classList.remove("sorted");
      th.removeAttribute("data-dir");
      if (th.dataset.key === sortKey) {
        th.classList.add("sorted");
        th.setAttribute("data-dir", sortDir === "asc" ? "▲" : "▼");
      }
    });
  }
})();
