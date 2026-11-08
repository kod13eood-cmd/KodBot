// Standalone login/register page. Keeping auth outside the React app means
// the existing single-user UI stays untouched and a failed auth cannot leave
// a half-booted app shell on screen.
import type { GatewayConfig } from "./config.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function loginPage(input: {
  config: GatewayConfig;
  hasUsers: boolean;
  error?: string;
  mode?: "login" | "register";
}): string {
  const { config, hasUsers, error } = input;
  const bootstrap = config.bootstrap && !hasUsers;
  const register = input.mode === "register" || bootstrap;
  const title = bootstrap ? "Create the owner account" : register ? "Create your account" : "Sign in";
  const subtitle = bootstrap
    ? "This gateway is empty. The first account becomes the owner and keeps the existing KodBot data."
    : register
      ? "KodBot is invite-only. Use the invite code the operator gave you."
      : "Sign in to your KodBot workspace.";
  const errorBlock = error
    ? `<div class="error" role="alert">${escapeHtml(error)}</div>`
    : "";
  return `<!doctype html>
<html lang="en">
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
  .bilingual { margin-top:18px; color:#6f7a89; font-size:11.5px; text-align:center; }
</style>
</head>
<body>
<div class="shell">
  <div class="brand"><div class="logo">K</div></div>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p class="sub">${escapeHtml(subtitle)}</p>
    ${errorBlock}
    <form method="post" action="/api/auth/${register ? "register" : "login"}" id="auth-form">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required autofocus>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" minlength="${register ? 10 : 1}" required>
      ${
        register
          ? `<label for="confirm">Confirm password</label>
      <input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="10" required>
      ${bootstrap ? "" : `<label for="invite">Invite code</label>
      <input id="invite" name="invite" type="text" autocomplete="off" required>`}`
          : ""
      }
      <button type="submit">${register ? "Create account" : "Sign in"}</button>
    </form>
    ${
      bootstrap
        ? `<div class="hint">The first account owns the existing ~/.kodbot data.</div>`
        : `<div class="switch">${register ? `Already have an account? <a href="/login">Sign in</a>` : `Have an invite? <a href="/login?mode=register">Create an account</a>`}</div>`
    }
    <div class="bilingual">KodBot · English / Български</div>
  </div>
</div>
<script>
  const form = document.getElementById('auth-form');
  form?.addEventListener('submit', (event) => {
    const password = form.querySelector('[name=password]');
    const confirm = form.querySelector('[name=confirm]');
    if (confirm && password && confirm.value !== password.value) {
      event.preventDefault();
      confirm.setCustomValidity('Passwords do not match.');
      confirm.reportValidity();
    }
  });
</script>
</body>
</html>`;
}
