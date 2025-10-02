// Global Navigation Handler - Simple and Effective Version
console.log("🚀 Navigation.js loaded");

// Main navigation function
function navigateToPage(page) {
  console.log("🔗 Navigating to:", page);

  // If already exiting, ignore rapid clicks
  if (document.body.classList.contains("page-exiting")) {
    console.log("⏳ Already exiting, ignoring extra click");
    return;
  }

  const doNavigate = () => {
    // Always route via splash to show intro before entering target page
    const target = page;
    const viaSplash = (() => {
      // Normalize if already a splash
      if (/splash\.html$/i.test(target)) return target;
      // Build splash URL with next query (keep relative to renderer root)
      const url = new URL(window.location.origin + window.location.pathname);
      const base = url.pathname.replace(/[^\/]*$/, ""); // directory of current page
      // Use relative path so electronAPI.navigateTo works consistently
      return `splash.html?next=${encodeURIComponent(target)}`;
    })();
    try {
      if (window.electronAPI && window.electronAPI.navigateTo) {
        console.log("✅ Using electronAPI");
        window.electronAPI.navigateTo(viaSplash);
        return;
      }
      console.log("⚡ Using standard navigation");
      window.location.href = viaSplash;
    } catch (error) {
      console.error("❌ Navigation error:", error);
      window.location.assign(viaSplash);
    }
  };

  // Add exit class for CSS fade-out
  document.body.classList.add("page-exiting");
  // Remove loaded state (optional) to allow re-trigger
  document.body.classList.remove("page-loaded");

  // Delay navigation to allow animation (match CSS .55s, use 420ms for snappy feel)
  setTimeout(doNavigate, 420);
}

// Make function global
window.navigateToPage = navigateToPage;

// Enhanced event listeners
document.addEventListener("DOMContentLoaded", function () {
  console.log("🎯 Setting up enhanced navigation");
  // Trigger page-loaded (allow next frame so initial styles apply)
  requestAnimationFrame(() => document.body.classList.add("page-loaded"));

  // Safety: ensure scroll is enabled on every fresh page
  try {
    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
    if (document.documentElement) {
      document.documentElement.style.overflow = "";
    }
  } catch (_) {}

  // Method 1: Direct onclick handlers (most reliable)
  const navLinks = document.querySelectorAll('a[href$=".html"]');
  console.log("📍 Found navigation links:", navLinks.length);

  navLinks.forEach((link, index) => {
    console.log(`🔧 Setting up link ${index + 1}:`, link.href);

    // Remove existing onclick to avoid conflicts
    link.removeAttribute("onclick");

    // Add new click handler
    link.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const href = this.getAttribute("href");
      console.log("👆 Link clicked:", href);
      navigateToPage(href);
    });

    // Ensure link is visually clickable
    link.style.cursor = "pointer";
    link.style.userSelect = "none";
  });

  // Method 2: Global fallback click handler
  document.body.addEventListener("click", function (e) {
    const link = e.target.closest('a[href$=".html"]');
    if (link && !link.dataset.handled) {
      e.preventDefault();
      console.log("🔄 Fallback navigation triggered");
      navigateToPage(link.getAttribute("href"));
    }
  });

  console.log("✨ Navigation setup complete");
});

// Test functions
window.testNav = function (page) {
  console.log("🧪 Testing navigation to:", page);
  navigateToPage(page);
};

// Emergency navigation function
window.emergencyNav = function (page) {
  console.log("🚨 Emergency navigation to:", page);
  window.location.replace(page);
};
