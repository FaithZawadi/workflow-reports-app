// Money helpers for quotations.

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

function threeDigitsToWords(n) {
  let out = "";
  if (n >= 100) {
    out += ONES[Math.floor(n / 100)] + " Hundred";
    n %= 100;
    if (n) out += " ";
  }
  if (n >= 20) {
    out += TENS[Math.floor(n / 10)];
    if (n % 10) out += "-" + ONES[n % 10];
  } else if (n > 0) {
    out += ONES[n];
  }
  return out;
}

// 52200 -> "Fifty-Two Thousand Two Hundred"
export function numberToWords(num) {
  const n = Math.floor(Math.abs(num));
  if (n === 0) return "Zero";
  const groups = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    parts.push(threeDigitsToWords(groups[i]) + (SCALES[i] ? " " + SCALES[i] : ""));
  }
  return parts.join(" ");
}

// Full "amount in words" line for a currency, e.g.
// amountInWords(52200, "KES") -> "Kenyan Shilling Fifty-Two Thousand Two Hundred Only"
const CURRENCY_WORD = { KES: "Kenyan Shilling", USD: "US Dollar", EUR: "Euro", GBP: "Pound Sterling" };
export function amountInWords(amount, currency = "KES") {
  const word = CURRENCY_WORD[currency] || currency;
  const whole = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - whole) * 100);
  let out = `${word} ${numberToWords(whole)}`;
  if (cents > 0) out += ` and Cents ${numberToWords(cents)}`;
  return out + " Only";
}

// Compute quotation totals from line items + vat + freight.
export function quoteTotals(items, vatRate, freight) {
  const list = Array.isArray(items) ? items : [];
  const subtotal = list.reduce((sum, it) => {
    const qty = Number(it?.qty) || 0;
    const price = Number(it?.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const fr = Number(freight) || 0;
  const rate = Number(vatRate) || 0;
  const vatAmount = ((subtotal + fr) * rate) / 100;
  const grandTotal = subtotal + fr + vatAmount;
  return {
    subtotal: round2(subtotal),
    vatAmount: round2(vatAmount),
    grandTotal: round2(grandTotal),
  };
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
