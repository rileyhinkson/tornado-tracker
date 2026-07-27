// Shared header/theme behavior across all pages.
// Two phosphor themes: green (default, no attribute) and amber.
(function () {
  const root = document.documentElement;
  const stored = localStorage.getItem("theme");
  if (stored === "amber") {
    root.setAttribute("data-theme", "amber");
  }

  function currentTheme() {
    return root.getAttribute("data-theme") === "amber" ? "amber" : "green";
  }

  function updateToggleLabel(btn) {
    btn.textContent = currentTheme() === "amber" ? "PHOSPHOR: AMBER" : "PHOSPHOR: GREEN";
  }

  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    updateToggleLabel(btn);
    btn.addEventListener("click", function () {
      const next = currentTheme() === "amber" ? "green" : "amber";
      if (next === "amber") {
        root.setAttribute("data-theme", "amber");
      } else {
        root.removeAttribute("data-theme");
      }
      localStorage.setItem("theme", next);
      updateToggleLabel(btn);
    });
  });
})();

// Shared helpers.
function formatNumber(n) {
  return n.toLocaleString("en-US");
}

function magnitudeRank(label) {
  if (!label || label === "Unrated") return -1;
  return parseInt(label.replace(/[^0-9]/g, ""), 10);
}
