function renderAll() {
  renderDashboard();
  renderInstructors();
  renderRequests();
  renderSchedule();
  renderSettlement();
  renderSettings();
  renderAdmin();
  enhanceSortableTables(document);
  refreshAlertBadge();
}
function bootstrap() {
  if (typeof applyRequestHashView === "function") applyRequestHashView();
  const loggedIn = !!getCurrentUser();
  document.getElementById("loginModal").classList.toggle("hidden", loggedIn);
  document.getElementById("currentUser").textContent = loggedIn ? `${getCurrentUser().name} (${roleLabel(getCurrentUser().role)})` : "";
  document.querySelectorAll(".menu-btn").forEach((btn) => {
    const menu = btn.dataset.view;
    btn.style.display = loggedIn && canAccessMenu(menu) ? "" : "none";
  });
  if (!canAccessMenu(view)) view = "dashboard";
  syncDispatchesFromSchedules();
  saveState();
  renderAll();
  openPage(view);
}

document.querySelectorAll(".menu-btn").forEach((btn) => btn.addEventListener("click", () => openPage(btn.dataset.view)));
document.addEventListener("click", (e) => {
  const panel = document.getElementById("alertPanel");
  const btn = document.getElementById("alertBtn");
  if (!panel || !btn) return;
  const target = e.target;
  if (panel.contains(target) || btn.contains(target)) return;
  panel.classList.add("hidden");
  alertPanelOpen = false;
});
bootstrap();
