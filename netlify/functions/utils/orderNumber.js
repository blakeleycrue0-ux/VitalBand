// Human-friendly, reasonably collision-resistant order number. Uniqueness is
// still enforced at the database level (orders.order_number has a unique
// constraint) so a collision simply results in a retry, never a silent clash.
export function generateOrderNumber() {
  const timePart = Date.now().toString(36).toUpperCase();
  const randPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VB-${timePart}-${randPart}`;
}
