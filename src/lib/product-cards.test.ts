import { describe, expect, it } from "vitest";

import { parseProductCards } from "./product-cards";

describe("product cards", () => {
  it("parses and bounds a real product list", () => {
    const parsed = parseProductCards(
      JSON.stringify([
        {
          title: "  Noise cancelling headphones  ",
          url: "https://shop.example/headphones",
          image: "https://cdn.example/headphones.png",
          price: "$199",
          store: "Example Shop",
          rating: 4.6,
          reviews: 218,
          note: "Long battery life",
        },
      ]),
    );
    expect(parsed).toEqual([
      {
        title: "Noise cancelling headphones",
        url: "https://shop.example/headphones",
        image: "https://cdn.example/headphones.png",
        price: "$199",
        store: "Example Shop",
        rating: 4.6,
        reviews: 218,
        note: "Long battery life",
      },
    ]);
  });

  it("drops unusable entries and rejects non-http links", () => {
    expect(parseProductCards(JSON.stringify([
      { title: "No link", url: "javascript:alert(1)" },
      { title: "Valid", url: "https://example.com/item", image: "file:///etc/passwd" },
    ]))).toEqual([
      { title: "Valid", url: "https://example.com/item", image: undefined, price: undefined, store: undefined, rating: undefined, reviews: undefined, note: undefined },
    ]);
    expect(parseProductCards("not json")).toBeNull();
    expect(parseProductCards(JSON.stringify([{ title: "No url" }]))).toBeNull();
  });

  it("caps the number of cards", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ title: `Item ${i}`, url: `https://example.com/${i}` }));
    expect(parseProductCards(JSON.stringify(items))).toHaveLength(12);
  });
});
