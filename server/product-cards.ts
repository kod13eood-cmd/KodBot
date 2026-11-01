/** Prompt guidance for the native product-card block. This is deliberately a
 * presentation contract, not a payment instruction: the card's action opens
 * the merchant page and never claims a checkout happened. */
export function productCardsSystemPrompt(): string {
  return (
    ' When the user asks you to shop, compare products, or recommend a purchase, use real results from your search or connected-app tools and end with a fenced code block labelled "products" containing a JSON array. ' +
    'Each item must have title and url (https) and may have image, price, store, rating (0-5), reviews, and note, for example [{"title":"Product","url":"https://shop.example/item","price":"$99","store":"Example","rating":4.6,"reviews":120}]. ' +
    "Never invent prices, ratings, availability, or merchant data. Never claim you completed a purchase or collected payment; the Buy now link opens the merchant's page."
  );
}
