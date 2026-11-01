import { useState } from "react";
import { ExternalLink, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { ProductCardItem } from "@/lib/product-cards";

function ProductImage({ item }: { item: ProductCardItem }) {
  const [failed, setFailed] = useState(false);
  if (!item.image || failed) {
    return (
      <div className="flex h-28 items-center justify-center bg-inset text-[22px] font-semibold text-ink-secondary/60">
        {(item.store ?? item.title).slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={item.image}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-28 w-full bg-white object-contain p-2"
    />
  );
}

/** A compact comparison card. "Buy now" is an outbound link to the merchant,
 * not a payment flow. */
export function ProductCards({ items }: { items: ProductCardItem[] }) {
  const { t } = useI18n();
  return (
    <div className="my-2 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article
          key={`${item.url}:${item.title}`}
          className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-hairline/40 bg-card"
        >
          <ProductImage item={item} />
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-3">
            <div className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{item.title}</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-secondary">
              {item.price && <span className="font-semibold text-ink">{item.price}</span>}
              {item.store && <span className="truncate">{item.store}</span>}
              {item.rating !== undefined && (
                <span className="inline-flex items-center gap-0.5" title={`${item.rating} / 5`}>
                  <Star size={11} className="fill-current" /> {item.rating.toFixed(1)}
                  {item.reviews !== undefined && <span className="text-ink-secondary/70">({item.reviews})</span>}
                </span>
              )}
            </div>
            {item.note && <div className="line-clamp-2 text-[11.5px] leading-relaxed text-ink-secondary">{item.note}</div>}
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="mt-auto inline-flex w-fit items-center gap-1 rounded-lg bg-raised px-2.5 py-1.5 text-[11.5px] font-medium text-ink hover:bg-raised-hover"
            >
              {t("Buy now")} <ExternalLink size={11} />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
