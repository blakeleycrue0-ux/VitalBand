export function formatPrice(cents, currency = 'EUR', locale = 'en-IE') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format((cents || 0) / 100);
}

export function starString(rating) {
  const rounded = Math.round(rating);
  return '★★★★★'.slice(0, rounded) + '☆☆☆☆☆'.slice(0, 5 - rounded);
}
