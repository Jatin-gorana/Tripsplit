/**
 * Formats paise (integer) to Indian Rupee (INR) string with Indian digit grouping.
 * e.g., 150050 paise => ₹1,500.50
 * e.g., 150000 paise => ₹1,500
 */
export function formatRupees(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) {
    return '₹0';
  }

  const rupees = Number(paise) / 100;
  const hasDecimals = paise % 100 !== 0;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  }).format(rupees);
}

/**
 * Parses user input decimal string (e.g., "120.50" or "1200") to integer paise.
 */
export function parseRupeesToPaise(rupeeString) {
  if (!rupeeString) return 0;
  const cleaned = String(rupeeString).replace(/[^0-9.]/g, '');
  const val = parseFloat(cleaned);
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}

/**
 * Formats YYYY-MM-DD date string to localized short date.
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}
