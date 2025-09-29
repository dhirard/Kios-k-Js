/**
 * Utility functions untuk formatting
 */

// Currency formatter used across printing flows
function formatIDR(n) {
  const num = Number(n) || 0;
  try {
    // Some locales add NBSP between symbol and number (e.g., "Rp\u00A0123.456")
    // ESC/POS printers can't render NBSP; normalize it to a plain space.
    let s = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
    s = s.replace(/\u00A0/g, " "); // NBSP -> space
    // Ensure a single space after 'Rp'
    s = s.replace(/^Rp\s?/, "Rp ");
    return s;
  } catch (_) {
    // Fallback: build ASCII-safe format
    return `Rp ${num.toLocaleString("id-ID")}`;
  }
}

// Sanitize text for ESC/POS printers: ensure ASCII-only and safe spaces
function sanitizeForEscPos(input) {
  if (!input) return "";
  let s = String(input);
  // Replace known problematic spaces with ASCII space
  s = s.replace(/[\u00A0\u202F\u2007]/g, " "); // NBSP, NARROW NBSP, FIGURE SPACE
  // Remove zero-width and directionality marks
  s = s.replace(/[\u200B-\u200F\u2060\uFEFF]/g, "");
  // Normalize and strip diacritics
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  // Replace common unicode dashes/quotes with ASCII
  s = s
    .replace(/[\u2013\u2014]/g, "-") // en/em dash -> hyphen
    .replace(/[\u2018\u2019]/g, "'") // single quotes
    .replace(/[\u201C\u201D]/g, '"'); // double quotes
  // Finally, drop any remaining non-ASCII printable chars
  s = s.replace(/[^\x20-\x7E]/g, "");
  // Collapse multiple spaces
  s = s.replace(/\s{2,}/g, " ").trimEnd();
  return s;
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
  sanitizeForEscPos,
};
