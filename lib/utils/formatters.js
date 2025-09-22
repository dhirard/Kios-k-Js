/**
 * Utility functions untuk formatting
 */

// Currency formatter used across printing flows
function formatIDR(n) {
  const num = Number(n) || 0;
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  } catch (_) {
    return `Rp${num.toLocaleString("id-ID")}`;
  }
}

// Helper for centering text for raw printing
function centerText(text, width = 32) {
  if (!text) return "";
  const padSize = Math.floor((width - text.length) / 2);
  if (padSize <= 0) return text;
  return " ".repeat(padSize) + text;
}

// Helper for two-column layout for raw printing
function twoColsText(left, right, width = 32) {
  const space = width - left.length - right.length;
  if (space <= 0) return `${left}${right}`;
  return `${left}${" ".repeat(space)}${right}`;
}

// Helper function untuk dua kolom layout
function twoCols(left, right, width) {
  const l = String(left);
  const r = String(right);
  const space = Math.max(1, width - l.length - r.length);
  return l + " ".repeat(space) + r;
}

module.exports = {
  formatIDR,
  centerText,
  twoColsText,
  twoCols,
};
