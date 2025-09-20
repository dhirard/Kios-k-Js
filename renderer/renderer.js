// Common utility functions for all renderer pages

// Format currency to Indonesian Rupiah
function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Show notification to user
function showNotification(message, type = "info", duration = 3000) {
  const notification = document.getElementById("notification");
  const notificationText = document.getElementById("notification-text");

  if (!notification || !notificationText) {
    console.warn("Notification elements not found");
    return;
  }

  notificationText.textContent = message;
  notification.className = `notification show ${type}`;

  // Auto hide after specified duration
  setTimeout(() => {
    notification.classList.remove("show");
  }, duration);
}

// Navigate to different pages
function navigateTo(page) {
  window.location.href = page;
}

// Debounce function to limit rapid function calls
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function to limit function calls
function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Validate if element exists
function elementExists(id) {
  return document.getElementById(id) !== null;
}

// Safe element getter
function getElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id '${id}' not found`);
  }
  return element;
}

// Add loading state to button
function setButtonLoading(buttonId, isLoading, originalText = "") {
  const button = getElement(buttonId);
  if (!button) return;

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = "Memuat...";
    button.disabled = true;
    button.style.cursor = "not-allowed";
  } else {
    button.textContent = button.dataset.originalText || originalText;
    button.disabled = false;
    button.style.cursor = "pointer";
  }
}

// Handle image load errors
function handleImageError(img) {
  img.src = "https://via.placeholder.com/300x200/e0e0e0/666?text=No+Image";
  img.onerror = null; // Prevent infinite loop
}

// Format date to Indonesian locale
function formatDate(date) {
  return new Date(date).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Validate quantity input
function validateQuantity(quantity) {
  const qty = parseInt(quantity);
  return !isNaN(qty) && qty > 0 ? qty : 1;
}

// Create loading spinner element
function createSpinner() {
  const spinner = document.createElement("div");
  spinner.className = "spinner";
  return spinner;
}

// Show/hide loading overlay
function toggleLoadingOverlay(show, containerId = "loading") {
  const loadingElement = getElement(containerId);
  if (loadingElement) {
    loadingElement.style.display = show ? "flex" : "none";
  }
}

// Confirm dialog
function showConfirmDialog(message, onConfirm, onCancel = null) {
  if (confirm(message)) {
    onConfirm();
  } else if (onCancel) {
    onCancel();
  }
}

// Local storage helpers
const Storage = {
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  },

  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error("Failed to read from localStorage:", error);
      return defaultValue;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Failed to remove from localStorage:", error);
    }
  },

  clear() {
    try {
      localStorage.clear();
    } catch (error) {
      console.error("Failed to clear localStorage:", error);
    }
  },
};

// Error handling wrapper
function safeExecute(fn, errorMessage = "Terjadi kesalahan") {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error("Error in safeExecute:", error);
      showNotification(errorMessage, "error");
      return null;
    }
  };
}

// Common API wrapper with error handling
const API = {
  async call(method, ...args) {
    try {
      if (!window.electronAPI || !window.electronAPI[method]) {
        throw new Error(`API method ${method} not available`);
      }
      return await window.electronAPI[method](...args);
    } catch (error) {
      console.error(`API call failed for ${method}:`, error);
      throw error;
    }
  },
};

// Initialize common event listeners
function initializeCommonEvents() {
  // Close notification on click
  const notificationClose = getElement("notification-close");
  if (notificationClose) {
    notificationClose.addEventListener("click", () => {
      const notification = getElement("notification");
      if (notification) {
        notification.classList.remove("show");
      }
    });
  }

  // Handle keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // ESC to close modals
    if (e.key === "Escape") {
      const modals = document.querySelectorAll(".modal");
      modals.forEach((modal) => {
        if (modal.style.display !== "none") {
          modal.style.display = "none";
        }
      });
    }
  });

  // Handle image loading errors globally
  document.addEventListener(
    "error",
    (e) => {
      if (e.target.tagName === "IMG") {
        handleImageError(e.target);
      }
    },
    true
  );
}

// Auto-initialize when DOM is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeCommonEvents);
} else {
  initializeCommonEvents();
}

// Export functions for use in other scripts
window.FloristUtils = {
  formatCurrency,
  showNotification,
  navigateTo,
  debounce,
  throttle,
  elementExists,
  getElement,
  setButtonLoading,
  handleImageError,
  formatDate,
  validateQuantity,
  createSpinner,
  toggleLoadingOverlay,
  showConfirmDialog,
  Storage,
  safeExecute,
  API,
};
