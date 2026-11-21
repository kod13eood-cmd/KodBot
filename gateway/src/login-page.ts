// Standalone login/register page. Keeping auth outside the React app means
// the existing single-user UI stays untouched and a failed auth cannot leave
// a half-booted app shell on screen.
import type { GatewayConfig } from "./config.ts";

export type GatewayLang = "en" | "bg";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const COPY = {
  en: {
    ownerTitle: "Create the owner account",
    registerTitle: "Create your account",
    loginTitle: "Sign in",
    ownerSubtitle: "This gateway is empty. The first account becomes the owner and keeps the existing KodBot data.",
    registerSubtitle: "KodBot is invite-only. Use the invite code the operator gave you.",
    loginSubtitle: "Sign in to your KodBot workspace.",
    email: "Email",
    password: "Password",
    confirm: "Confirm password",
    invite: "Invite code",
    create: "Create account",
    signIn: "Sign in",
    ownerHint: "The first account owns the existing ~/.kodbot data.",
    already: "Already have an account?",
    haveInvite: "Have an invite?",
    createLink: "Create an account",
    signInLink: "Sign in",
    mismatch: "Passwords do not match.",
    language: "Language",
  },
  bg: {
    ownerTitle: "Създай акаунта на собственика",
    registerTitle: "Създай своя акаунт",
    loginTitle: "Вход",
    ownerSubtitle: "Този gateway е празен. Първият акаунт става собственик и запазва съществуващите данни на KodBot.",
    registerSubtitle: "KodBot е само с покани. Използвай кода за покана, който операторът ти даде.",
    loginSubtitle: "Влез в своето работно пространство KodBot.",
    email: "Имейл",
    password: "Парола",
    confirm: "Потвърди паролата",
    invite: "Код за покана",
    create: "Създай акаунт",
    signIn: "Вход",
    ownerHint: "Първият акаунт притежава съществуващите данни в ~/.kodbot.",
    already: "Вече имаш акаунт?",
    haveInvite: "Имаш покана?",
    createLink: "Създай акаунт",
    signInLink: "Вход",
    mismatch: "Паролите не съвпадат.",
    language: "Език",
  },
} as const;

const ERROR_BG: Record<string, string> = {
  "Enter a valid email address.": "Въведи валиден имейл адрес.",
  "Password must be at least 10 characters.": "Паролата трябва да е поне 10 символа.",
  "Password must be at most 200 characters.": "Паролата трябва да е най-много 200 символа.",
  "An account with that email already exists.": "Вече има акаунт с този имейл.",
  "The owner account has not been created yet. Ask the operator for an invite.":
    "Акаунтът на собственика още не е създаден. Поискай покана от оператора.",
  "An invite code is required.": "Нужен е код за покана.",
  "That invite is invalid or has expired.": "Поканата е невалидна или изтекла.",
  "That invite belongs to a different email address.": "Поканата е за друг имейл адрес.",
  "That invite has already been used.": "Тази покана вече е използвана.",
  "The owner account already exists.": "Акаунтът на собственика вече съществува.",
  "Email or password is wrong.": "Имейлът или паролата са грешни.",
  "Too many sign-in attempts. Try again later.": "Твърде много опити за вход. Опитай по-късно.",
  "Passwords do not match.": "Паролите не съвпадат.",
  "No account with that email.": "Няма акаунт с този имейл.",
};

export function translateGatewayError(message: string, lang: GatewayLang): string {
  return lang === "bg" ? (ERROR_BG[message] ?? message) : message;
}

export function loginPage(input: {
  config: GatewayConfig;
  hasUsers: boolean;
  error?: string;
  mode?: "login" | "register";
  lang?: GatewayLang;
}): string {
  const { config, hasUsers, error, lang = "en" } = input;
  const copy = COPY[lang];
  const bootstrap = config.bootstrap && !hasUsers;
  const register = input.mode === "register" || bootstrap;
  const title = bootstrap ? copy.ownerTitle : register ? copy.registerTitle : copy.loginTitle;
  const subtitle = bootstrap
    ? copy.ownerSubtitle
    : register
      ? copy.registerSubtitle
      : copy.loginSubtitle;
  const shownError = error ? translateGatewayError(error, lang) : undefined;
  const errorBlock = shownError
    ? `<div class="error" role="alert">${escapeHtml(shownError)}</div>`
    : "";
  const switchLink = (target: GatewayLang) => {
    const params = new URLSearchParams({ lang: target });
    if (register) params.set("mode", "register");
    return `/login?${params.toString()}`;
  };
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · KodBot</title>
<style>
  :root { color-scheme: dark; --bg:#0b0d10; --panel:#15181d; --card:#1c2027; --line:#2a2f38; --text:#f2f4f7; --muted:#98a2b3; --accent:#28c46b; --danger:#ff6b6b; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:radial-gradient(circle at 50% 0%, #173027 0%, var(--bg) 55%); color:var(--text); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; padding:24px; }
  .shell { width:100%; max-width:420px; }
  .brand { display:flex; align-items:center; gap:10px; justify-content:center; margin-bottom:22px; }
  .logo { width:42px; height:42px; border-radius:12px; background:linear-gradient(145deg,#2ee27a,#159b52); display:grid; place-items:center; font-weight:800; color:#04130a; box-shadow:0 10px 30px #0008; }
  h1 { font-size:22px; letter-spacing:-.02em; margin:0; text-align:center; }
  .sub { color:var(--muted); text-align:center; margin:8px 0 20px; font-size:13px; }
  .card { background:linear-gradient(180deg, var(--panel), #121519); border:1px solid var(--line); border-radius:18px; padding:22px; box-shadow:0 24px 80px #0009; }
  label { display:block; font-size:12px; color:var(--muted); margin:0 0 6px; }
  input { width:100%; border:1px solid var(--line); background:#0f1216; color:var(--text); border-radius:10px; padding:11px 12px; font:inherit; outline:none; margin-bottom:14px; }
  input:focus { border-color:#3b8f63; box-shadow:0 0 0 3px #28c46b22; }
  button { width:100%; border:0; border-radius:10px; padding:11px 14px; font:inherit; font-weight:600; cursor:pointer; background:var(--accent); color:#04130a; }
  button:hover { filter:brightness(1.06); }
  .error { background:#3a171a; border:1px solid #6b2a30; color:#ffb4b4; border-radius:10px; padding:9px 11px; font-size:12.5px; margin-bottom:14px; }
  .switch { text-align:center; margin-top:16px; color:var(--muted); font-size:12.5px; }
  a { color:#67d99a; text-decoration:none; }
  .hint { margin-top:14px; color:#6f7a89; font-size:11.5px; text-align:center; }
  .lang { margin-top:18px; color:#6f7a89; font-size:11.5px; text-align:center; }
</style>
</head>
<body>
<div class="shell">
  <div class="brand"><div class="logo">K</div></div>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">${escapeHtml(subtitle)}</p>
    ${errorBlock}
    <form method="post" action="/api/auth/${register ? "register" : "login"}?lang=${lang}" id="auth-form">
      <label for="email">${copy.email}</label>
      <input id="email" name="email" type="email" autocomplete="email" required autofocus>
      <label for="password">${copy.password}</label>
      <input id="password" name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" minlength="${register ? 10 : 1}" required>
      ${
        register
          ? `<label for="confirm">${copy.confirm}</label>
      <input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="10" required>
      ${bootstrap ? "" : `<label for="invite">${copy.invite}</label>
      <input id="invite" name="invite" type="text" autocomplete="off" required>`}`
          : ""
      }
      <button type="submit">${register ? copy.create : copy.signIn}</button>
    </form>
    ${
      bootstrap
        ? `<div class="hint">${copy.ownerHint}</div>`
        : `<div class="switch">${register ? `${copy.already} <a href="/login?lang=${lang}">${copy.signInLink}</a>` : `${copy.haveInvite} <a href="/login?mode=register&lang=${lang}">${copy.createLink}</a>`}</div>`
    }
    <div class="lang" aria-label="${copy.language}">
      <a href="${switchLink("en")}" lang="en">English</a> · <a href="${switchLink("bg")}" lang="bg">Български</a>
    </div>
  </div>
</div>
<script>
  const form = document.getElementById('auth-form');
  form?.addEventListener('submit', (event) => {
    const password = form.querySelector('[name=password]');
    const confirm = form.querySelector('[name=confirm]');
    if (confirm && password && confirm.value !== password.value) {
      event.preventDefault();
      confirm.setCustomValidity(${JSON.stringify(copy.mismatch)});
      confirm.reportValidity();
    }
  });
</script>
</body>
</html>`;
}
