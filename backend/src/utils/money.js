// Rounds to paise. Prices and cash are stored as rupee floats, so every
// computed amount is rounded before it's stored or compared.
export const roundMoney = (value) => Math.round(value * 100) / 100;

export const percentChange = (from, to) => (from ? ((to - from) / from) * 100 : 0);
