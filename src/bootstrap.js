(() => {
  "use strict";

  const showFatalStartupError = (message) => {
    const overlay = document.getElementById("loading-overlay");
    const text = document.getElementById("loading-message");
    const status = document.getElementById("status-text");
    const statusPill = document.getElementById("status-pill");
    if (overlay) {
      overlay.classList.add("failed");
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-busy", "false");
    }
    if (text) text.textContent = `STARTUP FAILED — ${message}`;
    if (status) status.textContent = "STARTUP ERROR";
    if (statusPill) statusPill.className = "status-pill error";
  };

  window.addEventListener("error", (event) => {
    if (event?.error) {
      console.error("[MOCAP] Uncaught error:", event.error);
    }
    const message = event?.message || "A required script or module failed to load. Check the browser console and network access, then reload.";
    if (!window.__MOCAP_BOOT_COMPLETE__) showFatalStartupError(message);
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[MOCAP] Unhandled promise rejection:", event.reason);
    const message = event?.reason?.message || String(event?.reason || "Unhandled startup promise rejection.");
    if (!window.__MOCAP_BOOT_COMPLETE__) showFatalStartupError(message);
  });
})();
