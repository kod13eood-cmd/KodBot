// Product cards are a small, untrusted data contract between a bot's reply
// and the chat UI. The bot emits a fenced ```products JSON array; the renderer
// only accepts plain fields and safe http(s) links. Checkout stays on the
// merchant's own page — KodBot never pretends to have a payment rail.
export interface ProductCardItem {
  title: string;
  url: string;
  image?: string;
  price?: string;
  store?: string;
  rating?: number;
  reviews?: number;
  note?: string;
}

const MAX_PRODUCTS = 12;

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().replace(/\s+/g, " ");
  return clean ? clean.slice(0, max) : undefined;
}

function webUrl(value: unknown): string | undefined {
  const raw = text(value, 2_000);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Returns null when the block is not a usable product list, so the chat can
 * fall back to showing the original code instead of swallowing it. */
export function parseProductCards(raw: string): ProductCardItem[] | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) return null;
  const items = value.flatMap((entry): ProductCardItem[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const title = text(record.title, 180);
    const url = webUrl(record.url);
    if (!title || !url) return [];
    const rating =
      typeof record.rating === "number" && Number.isFinite(record.rating)
        ? Math.max(0, Math.min(5, record.rating))
        : undefined;
    const reviews =
      typeof record.reviews === "number" && Number.isSafeInteger(record.reviews) && record.reviews >= 0
        ? Math.min(record.reviews, 100_000_000)
        : undefined;
    return [{
      title,
      url,
      image: webUrl(record.image),
      price: text(record.price, 40),
      store: text(record.store, 80),
      rating,
      reviews,
      note: text(record.note, 240),
    }];
  });
  return items.length ? items.slice(0, MAX_PRODUCTS) : null;
}
