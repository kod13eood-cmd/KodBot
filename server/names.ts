// Bot name generator — a curated local list beats a naming API: instant,
// offline, and every name is on-brand (short, friendly, a little pet-like,
// which suits the Crew). Picks avoid names already in use; when the pool is
// exhausted it falls back to "Name 2", "Name 3", …
//
// Two pools exist because a Bulgarian interface should not introduce a new
// bot as "Scout". The client asks for a language when it creates a bot; the
// default stays English for API callers and existing tests.
export type BotNameLanguage = "english" | "bulgarian";

export const BOT_NAME_POOLS = {
  english: [
    "Scout", "Pixel", "Atlas", "Nova", "Juno", "Koda", "Miso", "Mochi",
    "Biscuit", "Pepper", "Clover", "Ember", "Willow", "Comet", "Orbit", "Echo",
    "Indigo", "Sage", "Zephyr", "Poppy", "Maple", "Cosmo", "Luna", "Otto",
    "Ivy", "Finch", "Wren", "Basil", "Hazel", "Nimbus", "Onyx", "Pearl",
    "Quill", "Rocket", "Sunny", "Tango", "Vega", "Waffle", "Ziggy", "Noodle",
    "Pickle", "Churro", "Panko", "Dumpling", "Pesto", "Olive", "Cocoa", "Taffy",
    "Bramble", "Fig", "Juniper", "Moss", "Pebble", "Rio", "Skye", "Tuli",
    "Ursa", "Yuki", "Zuko", "Momo", "Kiwi", "Plum", "Sprout", "Turnip",
  ],
  bulgarian: [
    "Алекс", "Ася", "Боби", "Борис", "Вера", "Вики", "Габриела", "Гого",
    "Дани", "Дария", "Дидо", "Ева", "Ели", "Жоро", "Зара", "Зори",
    "Иван", "Иво", "Ина", "Йони", "Калина", "Кики", "Кирил", "Коко",
    "Лора", "Лъчезар", "Мая", "Мила", "Миро", "Надя", "Наско", "Ники",
    "Нина", "Оги", "Оля", "Петя", "Поли", "Ради", "Рали", "Руми",
    "Сашо", "Сиси", "Стефан", "Теди", "Тони", "Фили", "Хриси", "Цвети",
    "Чоки", "Шаро", "Юли", "Яна",
  ],
} satisfies Record<BotNameLanguage, readonly string[]>;

export function pickBotName(taken: Iterable<string>, language: BotNameLanguage = "english"): string {
  const pool = BOT_NAME_POOLS[language];
  const used = new Set([...taken].map((n) => n.trim().toLowerCase()));
  const free = pool.filter((n) => !used.has(n.toLowerCase()));
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
  // pool exhausted — number a random base name
  const base = pool[Math.floor(Math.random() * pool.length)];
  for (let i = 2; ; i++) {
    if (!used.has(`${base.toLowerCase()} ${i}`)) return `${base} ${i}`;
  }
}
