(function () {
  const CHART_W = 1040;
  const CHART_H = 320;
  const PAD = { top: 16, right: 8, bottom: 26, left: 44 };

  let yearsIndex = {};
  let sortKey = "year";
  let sortDir = "desc";

  fetch("data/index.json")
    .then((r) => r.json())
    .then((index) => {
      yearsIndex = index;
      renderStats(index);
      renderChart(index);
      renderTable(index);
      wireControls(index);
    })
    .catch((err) => {
      console.error("Failed to load data/index.json", err);
      document.getElementById("years-table-body").innerHTML =
        '<tr><td colspan="5">Could not load tornado data.</td></tr>';
    });

  function renderStats(index) {
    const years = Object.keys(index).map(Number).sort((a, b) => a - b);
    let totalCount = 0, totalFatal = 0, totalInjuries = 0;
    let deadliestYear = null, deadliestFatal = -1;

    years.forEach((y) => {
      const rec = index[y];
      totalCount += rec.count;
      totalFatal += rec.fatalities;
      totalInjuries += rec.injuries;
      if (rec.fatalities > deadliestFatal) {
        deadliestFatal = rec.fatalities;
        deadliestYear = y;
      }
    });

    const stats = [
      ["Tornadoes recorded", formatNumber(totalCount)],
      ["Years covered", `${years[0]}–${years[years.length - 1]}`],
      ["Fatalities", formatNumber(totalFatal)],
      ["Injuries", formatNumber(totalInjuries)],
      ["Deadliest year", `${deadliestYear} (${formatNumber(deadliestFatal)})`],
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

  function renderChart(index) {
    const years = Object.keys(index).map(Number).sort((a, b) => a - b);
    const counts = years.map((y) => index[y].count);
    const maxCount = Math.max(...counts);
    const niceMax = Math.ceil(maxCount / 500) * 500;

    const plotW = CHART_W - PAD.left - PAD.right;
    const plotH = CHART_H - PAD.top - PAD.bottom;
    const band = plotW / years.length;
    const barW = Math.max(2, Math.min(24, band * 0.7));

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${CHART_W} ${CHART_H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Tornadoes recorded per year, 1950 to 2025");

    // Gridlines at nice steps (4 lines).
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = (niceMax / steps) * i;
      const y = PAD.top + plotH - (val / niceMax) * plotH;
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", PAD.left);
      line.setAttribute("x2", CHART_W - PAD.right);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("class", "chart-gridline");
      svg.appendChild(line);

      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", PAD.left - 8);
      label.setAttribute("y", y + 4);
      label.setAttribute("text-anchor", "end");
      label.setAttribute("class", "chart-axis-label");
      label.textContent = formatNumber(val);
      svg.appendChild(label);
    }

    // Baseline.
    const baseline = document.createElementNS(svgNS, "line");
    baseline.setAttribute("x1", PAD.left);
    baseline.setAttribute("x2", CHART_W - PAD.right);
    baseline.setAttribute("y1", PAD.top + plotH);
    baseline.setAttribute("y2", PAD.top + plotH);
    baseline.setAttribute("class", "chart-baseline");
    svg.appendChild(baseline);

    // Bars.
    years.forEach((y, i) => {
      const count = index[y].count;
      const barH = (count / niceMax) * plotH;
      const x = PAD.left + i * band + (band - barW) / 2;
      const yPos = PAD.top + plotH - barH;

      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", yPos);
      rect.setAttribute("width", barW);
      rect.setAttribute("height", Math.max(barH, 1));
      rect.setAttribute("rx", 3);
      rect.setAttribute("class", "chart-bar");
      rect.setAttribute("tabindex", "0");
      rect.dataset.year = y;
      rect.dataset.count = count;
      svg.appendChild(rect);
    });

    // Decade tick labels.
    years.forEach((y, i) => {
      if (y % 10 !== 0) return;
      const x = PAD.left + i * band + band / 2;
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", x);
      label.setAttribute("y", CHART_H - 6);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("class", "chart-axis-label");
      label.textContent = y;
      svg.appendChild(label);
    });

    const card = document.getElementById("chart-card");
    card.appendChild(svg);

    const tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    tooltip.innerHTML = '<span class="tt-value"></span><span class="tt-label"></span>';
    card.appendChild(tooltip);

    let hovered = null;
    function showTooltip(rect, evt) {
      if (hovered) hovered.classList.remove("is-hovered");
      hovered = rect;
      hovered.classList.add("is-hovered");
      tooltip.querySelector(".tt-value").textContent = formatNumber(Number(rect.dataset.count));
      tooltip.querySelector(".tt-label").textContent = `tornadoes in ${rect.dataset.year}`;
      const cardRect = card.getBoundingClientRect();
      const barRect = rect.getBoundingClientRect();
      tooltip.style.left = `${barRect.left - cardRect.left + barRect.width / 2}px`;
      tooltip.style.top = `${barRect.top - cardRect.top}px`;
      tooltip.classList.add("is-visible");
    }
    function hideTooltip() {
      if (hovered) hovered.classList.remove("is-hovered");
      hovered = null;
      tooltip.classList.remove("is-visible");
    }

    svg.addEventListener("pointermove", (evt) => {
      const target = evt.target.closest(".chart-bar");
      if (target) showTooltip(target, evt);
    });
    svg.addEventListener("pointerleave", hideTooltip);
    svg.addEventListener("focusin", (evt) => {
      const target = evt.target.closest(".chart-bar");
      if (target) showTooltip(target, evt);
    });
    svg.addEventListener("focusout", hideTooltip);
    svg.addEventListener("click", (evt) => {
      const target = evt.target.closest(".chart-bar");
      if (target) window.location.href = `years/index.html?y=${target.dataset.year}`;
    });
  }

  function renderTable(index) {
    sortAndRenderRows(index);
  }

  function sortAndRenderRows(index) {
    const filterVal = (document.getElementById("year-filter") || {}).value || "";
    let rows = Object.keys(index).map((y) => ({ year: Number(y), ...index[y] }));

    if (filterVal.trim()) {
      rows = rows.filter((r) => String(r.year).includes(filterVal.trim()));
    }

    rows.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "strongest") {
        av = magnitudeRank(a.strongest);
        bv = magnitudeRank(b.strongest);
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    const tbody = document.getElementById("years-table-body");
    tbody.innerHTML = "";
    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "empty-state";
      td.textContent = "No years match your search.";
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.className = "is-link";
        tr.addEventListener("click", () => {
          window.location.href = `years/index.html?y=${r.year}`;
        });

        const yearTd = document.createElement("td");
        const a = document.createElement("a");
        a.href = `years/index.html?y=${r.year}`;
        a.textContent = r.year;
        yearTd.appendChild(a);

        const countTd = document.createElement("td");
        countTd.textContent = formatNumber(r.count);

        const fatalTd = document.createElement("td");
        fatalTd.textContent = formatNumber(r.fatalities);

        const injTd = document.createElement("td");
        injTd.textContent = formatNumber(r.injuries);

        const magTd = document.createElement("td");
        const pill = document.createElement("span");
        pill.className = "magnitude-pill" + (magnitudeRank(r.strongest) >= 4 ? " mag-strong" : "");
        pill.textContent = r.strongest;
        magTd.appendChild(pill);

        tr.appendChild(yearTd);
        tr.appendChild(countTd);
        tr.appendChild(fatalTd);
        tr.appendChild(injTd);
        tr.appendChild(magTd);
        tbody.appendChild(tr);
      });
    }

    document.getElementById("result-count").textContent =
      `${rows.length} year${rows.length === 1 ? "" : "s"}`;

    document.querySelectorAll("table.data-table thead th").forEach((th) => {
      th.classList.remove("sorted");
      th.removeAttribute("data-dir");
      if (th.dataset.key === sortKey) {
        th.classList.add("sorted");
        th.setAttribute("data-dir", sortDir === "asc" ? "▲" : "▼");
      }
    });
  }

  function wireControls(index) {
    document.getElementById("year-filter").addEventListener("input", () => {
      sortAndRenderRows(index);
    });

    document.querySelectorAll("table.data-table thead th").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        if (sortKey === key) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortKey = key;
          sortDir = key === "year" ? "desc" : "desc";
        }
        sortAndRenderRows(index);
      });
    });
  }
})();
