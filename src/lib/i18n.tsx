// A small, dependency-free UI translator.
//
// English source strings are the keys, so a missing translation is still
// readable English rather than a bare identifier. Only static UI copy goes
// through t(); names, messages, engine output and server errors stay in their
// original language. The choice is local to this client and survives restarts.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "bg";

export const LOCALE_OPTIONS: ReadonlyArray<{ id: Locale; label: string }> = [
  { id: "en", label: "English" },
  { id: "bg", label: "Български" },
];

const STORAGE_KEY = "kodbot.locale";
const BULGARIAN: Record<string, string> = {
  // App shell
  "Open bot list": "Отвори списъка с ботове",
  "No bots yet": "Още няма ботове",
  "Connecting to the bot server…": "Свързване със сървъра за ботове…",
  "Start it with": "Стартирайте го с",

  // Common actions and states
  "Settings": "Настройки",
  "Close settings": "Затвори настройките",
  "Cancel": "Отказ",
  "Name this connection": "Име на връзката",
  "Give this {service} connection a name you will recognize. It appears in Connected apps and in each bot's access list.":
    "Дай на тази връзка с {service} име, което ще разпознаваш. То се показва в Свързани приложения и в списъка с достъп на всеки бот.",
  "Connection name": "Име на връзката",
  "e.g. Work {service}": "напр. Работен {service}",
  "Continue to sign in": "Продължи към вход",
  "Close": "Затвори",
  "Back": "Назад",
  "Save": "Запази",
  "Saving…": "Запазване…",
  "Delete": "Изтрий",
  "Archive": "Архивирай",
  "Retry": "Опитай отново",
  "Refresh": "Обнови",
  "Search": "Търсене",
  "Send": "Изпрати",
  "Stop": "Спри",
  "Unread": "Непрочетено",
  "About": "Относно",
  "KodBot": "KodBot",
  "Local-first agent harness": "Local-first agent harness",
  "Desktop app": "Desktop приложение",
  "The Electron shell around this window.": "Electron обвивката около този прозорец.",
  "Desktop and server versions differ.": "Desktop и сървърът са с различни версии.",
  "External engines": "Външни двигатели",
  "Agent CLIs this harness can run.": "Agent CLI-та, които този harness може да пуска.",
  "No engine CLIs detected.": "Не са открити engine CLI-та.",
  "Version unknown": "Версия неизвестна",
  "not signed in": "без вход",
  "Speech to text": "Реч към текст",
  "Text to speech": "Текст към реч",
  "Installed": "Инсталирано",
  "Version": "Версия",
  "Platform": "Платформа",
  "Local speech components used by the composer and voice notes.":
    "Локални гласови компоненти за composer-а и voice notes.",
  "Saved": "Записано",
  "Downloading…": "Сваляне…",
  "Download interrupted": "Свалянето е прекъснато",
  "Show in folder": "Покажи в папката",
  "Rename": "Преименувай",
  "Right-click a task to rename, archive, or delete it.":
    "Десен клик върху задача за преименуване, архивиране или изтриване.",
  "Public address": "Публичен адрес",
  "How other devices reach this server. Used in page links and when a bot opens a page in the browser.":
    "Как други устройства достигат този сървър. Използва се в линковете към страници и когато бот отваря страница в браузъра.",
  "Leave empty to use the address this window was opened with ({origin}).":
    "Остави празно, за да се използва адресът, с който е отворен този прозорец ({origin}).",
  "Couldn't save the address.": "Адресът не можа да се запази.",
  "See full run": "Виж пълния отчет",
  "Restore": "Възстанови",
  "Restore all": "Възстанови всички",
  "Restoring…": "Възстановяване…",
  "Working…": "Работи…",
  "Working": "Работи",
  "Loading…": "Зареждане…",
  "Bot": "Бот",
  "Agent": "Агент",
  "Room": "Стая",
  "You": "Ти",
  "Today": "Днес",
  "Yesterday": "Вчера",

  // Navigation and sidebar
  "New or share": "Ново или споделяне",
  "New Bot": "Нов бот",
  "New Room": "Нова стая",
  "Exporting…": "Експортиране…",
  "Export all bots": "Експортирай всички ботове",
  "Teams": "Екипи",
  "Archived bots": "Архивирани ботове",
  "Search bots and messages": "Търсене на ботове и съобщения",
  "Search everything": "Търсене навсякъде",
  "Bots, rooms, teams, automations, connected apps, settings and messages":
    "Ботове, стаи, екипи, автоматизации, свързани приложения, настройки и съобщения",
  "Search bots, rooms and messages": "Търсене на ботове, стаи и съобщения",
  "Search bots, rooms and message history": "Търсене на ботове, стаи и история на съобщенията",
  "bots": "бота",
  "Disabled": "Изключено",
  "Type at least two characters to search messages": "Въведете поне два символа за търсене в съобщенията",
  "No bots or rooms match “{query}”": "Няма ботове или стаи за „{query}“",
  "Clear search": "Изчисти търсенето",
  "Close search": "Затвори търсенето",
  "Nothing matches “{query}”": "Няма съвпадения за „{query}“",
  "Automations": "Автоматизации",
  "Approval timeout": "Таймер за одобрение",
  "What this means": "Какво означава това",
  "Why it needs approval": "Защо е нужно разрешение",
  "Local (free)": "Локално (безплатно)",
  "ElevenLabs": "ElevenLabs",
  "Local voice": "Локален глас",
  "Hold to talk": "Задръж, за да говориш",
  "Click to talk": "Щракни, за да говориш",
  "Microphone unavailable": "Микрофонът не е достъпен",
  "Microphone needs HTTPS. Open {url} or use the desktop app.":
    "Микрофонът изисква HTTPS. Отвори {url} или използвай desktop app-а.",
  "This browser can't record audio.": "Този браузър не може да записва аудио.",
  "Voice test": "Тест на гласа",
  "Check the microphone and the spoken voice before you rely on them in a chat.":
    "Провери микрофона и гласа, преди да разчиташ на тях в чат.",
  "Test microphone": "Тествай микрофона",
  "Stop and transcribe": "Спри и транскрибирай",
  "Transcribing…": "Транскрибиране…",
  "Transcribing your voice…": "Транскрибиране на гласа…",
  "This can take a minute on CPU.": "Това може да отнеме до минута на CPU.",
  "Starting…": "Стартиране…",
  "No speech detected.": "Не беше разпозната реч.",
  "Transcript": "Транскрипт",
  "Play test": "Пусни тест",
  "Recognition language": "Език за разпознаване",
  "Auto-detect": "Автоматично",
  "Bulgarian": "Български",
  "English": "Английски",
  "Choose Bulgarian when the microphone keeps mishearing Bulgarian words.":
    "Избери „Български“, когато микрофонът често разбира грешно български думи.",
  "Record voice note": "Запиши гласово съобщение",
  "Stop voice note": "Спри гласовото съобщение",
  "Stop and send voice note": "Спри и приготви гласовото",
  "Preparing voice note…": "Подготвя се гласово съобщение…",
  "Recording voice note…": "Записва се гласово съобщение…",
  "Voice note": "Гласово съобщение",
  "Play voice note": "Пусни гласовото",
  "Nothing was recorded. Try again.": "Нищо не беше записано. Опитай отново.",
  "Stop dictation first.": "Първо спри диктовката.",
  "Remove voice note": "Премахни гласовото съобщение",
  "Auto (BG / EN)": "Автоматично (BG / EN)",
  "Read replies aloud and turn speech into text with local models. No audio leaves this computer.":
    "Чети отговорите на глас и превръщай реч в текст с локални модели. Никакво аудио не напуска компютъра.",
  "Local voice is not installed on the harness yet. Run scripts/setup-local-voice.sh on the server, then refresh.":
    "Локалният глас още не е инсталиран на сървъра. Пусни scripts/setup-local-voice.sh на сървъра и опресни.",
  "Requested action": "Заявено действие",
  "The timer expired, but the bot is still waiting. You can answer now and it will continue.":
    "Таймерът изтече, но ботът все още чака. Можеш да отговориш сега и той ще продължи.",
  "How long a bot waits for your answer before the request is marked overdue. The card stays answerable, so a late Allow still runs the action.":
    "Колко време ботът чака отговор, преди заявката да бъде маркирана като закъсняла. Картата остава отговорна, така че късно Allow пак изпълнява действието.",
  "Wait until I answer": "Изчакай до мой отговор",
  "5 min": "5 мин",
  "15 min": "15 мин",
  "30 min": "30 мин",
  "4 hours": "4 часа",
  "The bot keeps waiting after the timer; the notification is a reminder, not a denial. Choose “Wait until I answer” to hide the timer entirely.":
    "Ботът продължава да чака след таймера; известието е напомняне, не отказ. Избери „Изчакай до мой отговор“, за да няма таймер.",
  "{count} failed runs need attention": "{count} неуспешни задачи чакат внимание",
  "Connected apps": "Свързани приложения",
  "App settings": "Настройки на приложението",
  "Waiting for you…": "Чака теб…",
  "Screen frame": "Кадър от екрана",
  "{name} is working…": "{name} работи…",
  "No messages yet": "Още няма съобщения",
  "You: {text}": "Ти: {text}",
  "Keep at least one active bot": "Оставете поне един активен бот",
  "Choose another Chief of Staff first": "Първо изберете друг главен координатор",
  "Archive {name}": "Архивирай {name}",
  "Close archived bots": "Затвори архивираните ботове",
  "{count} archived": "{count} архивирани",
  "Conversations are kept until you choose to delete a bot.":
    "Разговорите се запазват, докато не изберете да изтриете бот.",
  "Copy conversation ID": "Копирай ID на разговора",
  "Copy failed": "Копирането не успя",
  "Identifies this transcript in logs and API requests. It is not a share link.":
    "Идентифицира този разговор в логовете и API заявките. Това не е линк за споделяне.",
  "Delete Room": "Изтрий стаята",
  "Room name (optional)": "Име на стаята (по избор)",
  "Create a bot first — rooms are made of bots.": "Първо създайте бот — стаите са съставени от ботове.",
  "Create Room": "Създай стая",
  "Create Room · {count} bots": "Създай стая · {count} бота",
  "Pin": "Закачи",
  "Unpin": "Откачи",
  "Make Chief of Staff": "Направи главен координатор",
  "Remove Chief of Staff": "Премахни главния координатор",
  "Choose a Claude or ACP engine first": "Първо изберете Claude или ACP двигател",
  "Move to new section": "Премести в нова секция",
  "Coming soon": "Очаквайте скоро",
  "Mark as Unread": "Маркирай като непрочетено",
  "Edit Profile": "Редактирай профила",
  "Duplicate": "Дублирай",
  "New Room title": "Нова стая",
  "Version {version} available — download": "Версия {version} е налична — изтегли",
  "Starting download…": "Започва изтегляне…",
  "Downloading… {percent}%": "Изтегляне… {percent}%",
  "Version {version} ready — restart to update":
    "Версия {version} е готова — рестартирайте за актуализация",
  "Restarting to update…": "Рестартиране за актуализация…",
  "Checking for updates…": "Проверка за актуализации…",
  "You're up to date": "Имате най-новата версия",
  "Check for updates": "Провери за актуализации",

  // Chat
  "Bot settings": "Настройки на бота",
  "Chief of Staff": "Главен координатор",
  "Stop this turn": "Спри този ход",
  "Bot's computer": "Компютърът на бота",
  "Inspector": "Инспектор",
  "Inspector — runtime events and raw protocol for this thread":
    "Инспектор — събития по време на изпълнение и суров протокол за този разговор",
  "Copy message": "Копирай съобщението",
  "Edit message": "Редактирай съобщението",
  "Regenerate response": "Генерирай отговора отново",
  "Webhook task": "Задача от webhook",
  "View event payload": "Покажи данните на събитието",
  "Show full message": "Покажи цялото съобщение",
  "Show less": "Покажи по-малко",
  "Queued — sends when this turn finishes": "На опашка — изпраща се след края на хода",
  "Previous version": "Предишна версия",
  "Next version": "Следваща версия",
  "Open the conversation with {name}": "Отвори разговора с {name}",
  "Bot's screen": "Екранът на бота",
  "Send a message to start the conversation.": "Изпратете съобщение, за да започнете разговора.",
  "Thinking…": "Мисли…",
  "Thought process": "Процес на мислене",
  "Working for {seconds}s": "Работи от {seconds} сек.",
  "Show earlier messages ({count} more)": "Покажи по-стари съобщения (още {count})",
  "Show later messages ({count} more)": "Покажи по-нови съобщения (още {count})",
  "Jump to latest messages": "Към последните съобщения",
  "Conversation with {name}": "Разговор с {name}",

  // Composer
  "Queued — sends when {name} finishes: “{text}”":
    "На опашка — ще се изпрати, когато {name} приключи: „{text}“",
  "Send now": "Изпрати сега",
  "Send now — joins the running turn when the engine supports it":
    "Изпрати сега — влиза в текущия ход, когато engine-ът го поддържа",
  "Discard queued message": "Изхвърли съобщението от опашката",
  "Tag a bot": "Спомени бот",
  "Answer the approval above to continue": "Отговорете на заявката по-горе, за да продължите",
  "Listening…": "Слуша…",
  "{name} is working — Enter queues your message":
    "{name} работи — Enter поставя съобщението на опашка",
  "{name} is working — sends when this turn finishes":
    "{name} работи — ще се изпрати след края на хода",
  "Message {name} — {hint}": "Съобщение до {name} — {hint}",
  "Message {name}": "Съобщение до {name}",
  "Stop dictation": "Спри диктовката",
  "Start dictation": "Стартирай диктовка",
  "Stop dictation (Esc)": "Спри диктовката (Esc)",
  "Dictate": "Диктувай",
  "Queue message": "Постави на опашка",
  "Send message": "Изпрати съобщение",
  "Sends when the current turn finishes": "Ще се изпрати след края на текущия ход",
  "Dictation is only available on macOS for now.": "Диктовката засега е достъпна само на macOS.",
  "Dictation needs Microphone + Speech Recognition access — System Settings → Privacy & Security.":
    "Диктовката изисква достъп до микрофон и разпознаване на реч — Системни настройки → Поверителност и сигурност.",
  "Dictation isn't available in this build.": "Диктовката не е достъпна в тази версия.",

  // App settings
  "General": "Общи",
  "Connections": "Връзки",
  "Developer mode": "Режим за разработчици",
  "Show token counts, API keys, working folders, and the Inspector.":
    "Показва броячи на токени, API ключове, работни папки и Inspector.",
  "Technical details are visible.": "Техническите детайли са видими.",
  "Technical details are hidden.": "Техническите детайли са скрити.",
  "Interface": "Интерфейс",
  "Daily": "Ежедневно",
  "Interval": "На интервал",
  "Repeat every": "Повтаряй на всеки",
  "Only between certain hours": "Само между определени часове",
  "Every hour": "На всеки час",
  "Every {count} hours": "На всеки {count} часа",
  "Every {count} min": "На всеки {count} мин",
  ", weekdays": ", делнични дни",
  ", {days}": ", {days}",
  ", {start}–{end}": ", {start}–{end}",
  "Reply to message": "Отговори на съобщението",
  "Cancel reply": "Отмени отговора",
  "Message": "Съобщение",
  "Copy code": "Копирай кода",
  "Copy failed — select the text and press Ctrl+C":
    "Копирането не успя — маркирай текста и натисни Ctrl+C",
  "The browser blocked clipboard access — select the command and copy it manually.":
    "Браузърът блокира достъпа до клипборда — маркирай командата и я копирай ръчно.",
  "The browser blocked clipboard access — select the link and copy it manually.":
    "Браузърът блокира достъпа до клипборда — маркирай линка и го копирай ръчно.",
  "Help and guide": "Помощ и ръководство",
  "Loading your workspace…": "Зареждане на работното пространство…",
  "Loading chat…": "Зареждане на чата…",
  "The transcripts are large; this can take a few seconds.":
    "Транскриптите са големи; това може да отнеме няколко секунди.",
  "The server has not answered yet. Check that it is running and reachable.":
    "Сървърът още не отговаря. Провери дали работи и е достъпен.",
  "A bilingual guide to bots, tasks, rooms, automations, pages, and troubleshooting.":
    "Двуезично ръководство за ботове, задачи, стаи, автоматизации, страници и проблеми.",
  "Open guide": "Отвори ръководството",
  "KodBot guide": "Ръководство за KodBot",
  "Guide topic": "Тема от ръководството",
  "Task": "Задача",
  "New task": "Нова задача",
  "Let this turn finish first": "Изчакай текущия ход",
  "New task — a fresh context on this bot": "Нова задача — нов контекст за този бот",
  "Switch task": "Смени задачата",
  "Switch task · {usage} ({input} in · {output} out)":
    "Смени задачата · {usage} ({input} вх. · {output} изх.)",
  "Click to switch · double-click to rename": "Клик за смяна · двойно кликване за преименуване",
  "Delete task": "Изтрий задачата",
  "Delete this task and its conversation": "Изтрий задачата и разговора ѝ",
  "{input} in · {output} out": "{input} вх. · {output} изх.",
  "React {emoji}": "Реагирай с {emoji}",
  "Minimize": "Минимизирай",
  "Maximize": "Увеличи",
  "code": "код",
  "needs approval": "иска одобрение",
  "has a question": "има въпрос",
  "is waiting for you": "чака те",
  "has a failed scheduled run": "има неуспешна планирана задача",
  "missed a scheduled run": "пропусна планирана задача",
  "Open": "Отвори",
  "Group chats": "Групови чатове",
  "Show group chats": "Показвай груповите чатове",
  "Show rooms and team conversations in the sidebar.":
    "Показвай стаите и разговорите на екипите в страничната лента.",
  "Group chats are visible.": "Груповите чатове са видими.",
  "Group chats are hidden.": "Груповите чатове са скрити.",
  "Engines": "Двигатели",
  "Companion": "Компаньон",
  "Managed on the remote server": "Управлява се от отдалечения сървър",
  "Local VM": "Локална VM",
  "Voice": "Глас",
  "Usage": "Използване",
  "Profile": "Профил",
  "Shown in the sidebar. Saved as you go.": "Показва се в страничната лента. Запазва се автоматично.",
  "Your name": "Вашето име",
  "Updates": "Актуализации",
  "Checking…": "Проверка…",
  "{version} available": "{version} е налична",
  "Downloading {percent}%": "Изтегляне {percent}%",
  "{version} ready — restart to apply": "{version} е готова — рестартирайте, за да се приложи",
  "Check failed: {message}": "Проверката се провали: {message}",
  "unknown error": "неизвестна грешка",
  "You're on the latest version we know of.": "Използвате най-новата известна версия.",
  "Download": "Изтегли",
  "Restart and install": "Рестартирай и инсталирай",
  "Server": "Сървър",
  "Run the agents on this computer, or connect this window to a KodBot server that stays on 24/7.":
    "Стартирайте агентите на този компютър или свържете този прозорец към KodBot сървър, който работи денонощно.",
  "Could not reach {url}. Using this computer until you fix the address.":
    "Не може да се свърже с {url}. Използва се този компютър, докато адресът не бъде поправен.",
  "Using remote server {url}": "Използва се отдалечен сървър {url}",
  "Using the server on this computer.": "Използва се сървърът на този компютър.",
  "Connecting…": "Свързване…",
  "Connect to remote server": "Свържи към отдалечен сървър",
  "Use this computer": "Използвай този компютър",
  "Where should your bots run?": "Къде да работят ботовете?",
  "Choose now. You can change this later in App Settings → General → Server.":
    "Избери сега. Можеш да промениш това по-късно от App Settings → General → Server.",
  "Create a local server": "Създай локален сървър",
  "KodBot and the agents run on this computer. The server is built in; install the agent CLIs you want here. Best for one machine.":
    "KodBot и агентите работят на този компютър. Сървърът е вграден; инсталирай agent CLI-тата, които искаш, тук. Най-добре за една машина.",
  "Connect to a remote server": "Свържи към отдалечен сървър",
  "Use KodBot on another computer or a cloud VM. Bots, engines, keys, files and memory stay there. This computer only needs network access.":
    "Използвай KodBot на друг компютър или cloud VM. Ботовете, engine-ите, ключовете, файловете и паметта остават там. Този компютър се нуждае само от мрежов достъп.",
  "Remote server address": "Адрес на отдалечения сървър",
  "Enter the remote server address.": "Въведи адреса на отдалечения сървър.",
  "Enter an address like https://kodbot.example.com or http://192.168.1.50:8799.":
    "Въведи адрес като https://kodbot.example.com или http://192.168.1.50:8799.",
  "Creating the local server…": "Създаване на локалния сървър…",
  "The remote machine must already be running KodBot.":
    "Отдалечената машина трябва вече да изпълнява KodBot.",
  "The server runs on Linux, Windows and macOS. A remote server can be a cloud VM or a machine on your LAN/Tailscale. Use the harness port 8799 (not the phone companion port 8810); HTTPS is best.":
    "Сървърът работи на Linux, Windows и macOS. Отдалеченият сървър може да е cloud VM или машина в LAN/Tailscale. Използвай harness порта 8799 (не companion порта 8810); HTTPS е за предпочитане.",
  "Switching…": "Превключване…",
  "The remote machine must be reachable over your LAN or Tailscale and must be running KodBot. Keys, engines, and the companion stay on that machine. The app will restart when you switch.":
    "Отдалечената машина трябва да е достъпна през локалната мрежа или Tailscale и да изпълнява KodBot. Ключовете, двигателите и компаньонът остават на нея. Приложението ще се рестартира при превключване.",
  "Connections subtitle":
    "Свързаните приложения работят автоматично в инсталираното приложение. Останалите ключове за услуги остават на този компютър.",
  "Connected apps service is ready": "Услугата за свързани приложения е готова",
  "Self-host connected apps": "Свързани приложения със собствен сървър",
  "Engine CLIs": "CLI на двигателите",
  "Which binary each engine runs. Saved as you go.":
    "Кой изпълним файл използва всеки двигател. Запазва се автоматично.",
  "Language": "Език",
  "Choose the language for the app. Changes apply immediately.":
    "Изберете език за приложението. Промените се прилагат веднага.",
  "More languages can be added later.": "Още езици могат да бъдат добавени по-късно.",

  // Per-bot settings
  "Reset": "Нулирай",
  "Expression": "Изражение",
  "Color": "Цвят",
  "Name": "Име",
  "Title": "Заглавие",
  "Describe what your agent does": "Опишете какво прави вашият агент",
  "Description": "Описание",
  "What this agent is for": "За какво е този агент",
  "One per workspace": "Един на работно пространство",
  "This bot still holds the role, but its current engine cannot contact teammates. Choose a Claude or ACP engine to restore coordination.":
    "Този бот все още изпълнява ролята, но текущият му двигател не може да се свързва с други ботове. Изберете Claude или ACP двигател, за да възстановите координацията.",
  "This is your primary contact. It can coordinate the other bots and combine their work into one answer.":
    "Това е основният ви контакт. Той може да координира другите ботове и да обедини работата им в един отговор.",
  "Choose a Claude or ACP engine to let this bot coordinate teammates.":
    "Изберете Claude или ACP двигател, за да може този бот да координира други ботове.",
  "Make this bot your primary contact and hand the role over from {name}.":
    "Направете този бот основен контакт и прехвърлете ролята от {name}.",
  "Make this bot your primary contact for work that may involve several bots.":
    "Направете този бот основен контакт за работа, която може да включва няколко бота.",
  "Ask me before contacting other bots": "Питай ме преди връзка с други ботове",
  "This bot will stop and ask before it reaches out to another bot.":
    "Този бот ще спре и ще попита, преди да се свърже с друг бот.",
  "Let this bot talk to teammates on its own, without a confirmation step.":
    "Позволете на този бот да общува с други ботове без потвърждение.",
  "This engine cannot contact other bots": "Този двигател не може да се свързва с други ботове",
  "Connect apps in App Settings before giving this bot access.":
    "Свържете приложения в настройките, преди да дадете достъп на този бот.",
  "This bot's current engine cannot use connected apps.":
    "Текущият двигател на този бот не може да използва свързани приложения.",
  "Let this bot use your connected Gmail, Calendar, Slack, and other apps.":
    "Позволете на този бот да използва свързаните Gmail, Calendar, Slack и други приложения.",
  "Keep your connected apps unavailable to this bot.":
    "Оставете свързаните приложения недостъпни за този бот.",
  "Allow this bot to use connected apps": "Разреши на този бот да използва свързани приложения",
  "Connect apps in App Settings first": "Първо свържете приложения в настройките",
  "This engine cannot use connected apps": "Този двигател не може да използва свързани приложения",
  "Model": "Модел",
  "Which provider and model this bot runs on": "Доставчик и модел, на които работи този бот",
  "Effort": "Усилие",
  "How hard this bot thinks": "Колко усилено мисли този бот",
  "Default": "По подразбиране",
  "X-High": "Много високо",
  "Computer": "Компютър",
  "Where this bot's computer runs": "Къде работи компютърът на този бот",
  "currently: auto": "в момента: автоматично",
  "cloud": "облак",
  "vm": "локална VM",
  "local": "локално",
  "off": "изключено",
  "All bots →": "Всички ботове →",
  "Turns": "Ходове",
  "Tokens": "Токени",
  "Cost": "Цена",
  "This engine doesn't report a price; tokens are counted.":
    "Този двигател не отчита цена; токените се броят.",
  "Working folder": "Работна папка",
  "Where this bot runs its shell and file tools.":
    "Къде този бот изпълнява shell и файловите си инструменти.",
  "Private bot workspace": "Лично работно пространство на бота",
  "Choose…": "Избери…",
  "Memory": "Памет",
  "Notes this bot keeps between tasks — plain files you can edit.":
    "Бележки, които ботът пази между задачите — обикновени файлове, които можете да редактирате.",
  "Nothing remembered yet. The bot writes durable notes here — or add your own.":
    "Още нищо не е запомнено. Ботът записва трайни бележки тук — или добавете свои.",
  "Bot memory": "Памет на бота",
  "Over the budget — only the top of this file loads each turn.":
    "Над лимита — при всеки ход се зарежда само началото на файла.",
  "Topic files": "Тематични файлове",
  "Auto mode": "Автоматичен режим",
  "Keeps going on its own — you'll still be asked about anything destructive, and about questions it asks you.":
    "Продължава самостоятелно — все още ще бъдете питани за опасни действия и за въпросите, които ботът задава.",
  "Approve each action yourself. Turn on to let this bot keep working without stopping to ask.":
    "Одобрявайте всяко действие сами. Включете, за да работи ботът без спиране за въпроси.",
  "Bot voice": "Глас на бота",
  "Use a distinct voice for calls and spoken replies, or inherit the app default":
    "Използвайте отделен глас за разговори и озвучени отговори или наследете този на приложението",
  "App default": "По подразбиране за приложението",
  "Current bot voice": "Текущ глас на бота",
  "Loading voices…": "Зареждане на гласовете…",
  "Read replies aloud": "Озвучавай отговорите",
  "Speak this bot's answers as they arrive, even when you're in another chat":
    "Озвучавайте отговорите на бота, докато пристигат, дори когато сте в друг разговор",
  "Read this bot's replies aloud": "Озвучавай отговорите на този бот",
  "Notifications": "Известия",
  "Get notified when this agent finishes or needs input":
    "Получавайте известие, когато агентът приключи или се нуждае от отговор",

  // Model picker
  "Free": "Безплатен",
  "Loaded": "Зареден",
  "Search models": "Търсене на модели",
  "Search local models": "Търсене на локални модели",
  "Choose model": "Избор на модел",
  "Cloud": "Облак",
  "Local": "Локални",
  "Loaded now": "Заредени сега",
  "No local models found": "Няма намерени локални модели",
  "Use a local model": "Използвай локален модел",
  "No model providers are available.": "Няма налични доставчици на модели.",
  "Not installed": "Не е инсталиран",
  "Sign-in required": "Изисква се вход",
  "Ready": "Готов",
  "Local models": "Локални модели",
  "Run this agent with a model already on your machine.":
    "Стартирайте този агент с модел, който вече е на компютъра ви.",
  "Choose a model for this bot.": "Изберете модел за този бот.",
  "Back to {name} models": "Назад към моделите на {name}",
  "{count} models will appear after setup.": "Ще се появят {count} модела след настройка.",
  "Local models will appear as soon as the agent is installed.":
    "Локалните модели ще се появят веднага щом агентът бъде инсталиран.",
  "{count} results": "{count} резултата",
  "All models · {count}": "Всички модели · {count}",
  "Suggested": "Предложени",
  "Show all {count} models": "Покажи всички {count} модела",
  "Show suggested only": "Покажи само предложените",
  "Use a local model ({count} available)": "Използвай локален модел ({count} налични)",
  "{count} available": "{count} налични",

  // Remaining chat and settings strings
  "A bot": "Бот",
  "The bot": "Ботът",
  "Jump to latest": "Към последните",
  "Setting up this bot's computer…": "Подготовка на компютъра на бота…",
  "Working folder: {folder}": "Работна папка: {folder}",
  "Clear": "Изчисти",
  "Private bot workspace — or an absolute path":
    "Лично работно пространство на бота — или абсолютен път",
  "New tasks start here. This task is pinned to {where} — start a new task to use the new folder.":
    "Новите задачи започват тук. Тази задача е закачена към {where} — започнете нова задача, за да използвате новата папка.",
  "the home folder": "домашната папка",
  "Use {name} expression": "Използвай изражение {name}",
  "Use {name} mascot color": "Използвай цвят {name}",
  "Cost {caption}.": "Цена {caption}.",
  "(Default: no level is sent)": "(По подразбиране: не се изпраща ниво)",
  "{name}'s voice": "Гласът на {name}",
  "Start oMLX, Ollama, Unsloth, LM Studio, or EXO, then reopen this picker.":
    "Стартирайте oMLX, Ollama, Unsloth, LM Studio или EXO, след което отворете този избор отново.",

  // Onboarding
  "Welcome to KodBot": "Добре дошли в KodBot",
  "Bots that do real work on their own computer. Tell us who you are and we’ll let you know when big things ship.":
    "Ботове, които вършат истинска работа на собствения си компютър. Кажете ни кой сте и ще ви уведомяваме за големите новости.",
  "Continue": "Продължи",
  "Maybe later": "Може би по-късно",
  "Your engines": "Вашите двигатели",
  "Bots run on AI tools installed on this computer — here’s what we found.":
    "Ботовете работят с AI инструменти, инсталирани на този компютър — ето какво открихме.",
  "Ready engines": "Готови двигатели",
  "Needs setup": "Нужна е настройка",
  "Permissions": "Разрешения",
  "Optional, and only ever used when you ask for the feature.":
    "По избор и се използват само когато поискате съответната функция.",
  "Microphone & speech": "Микрофон и реч",
  "Voice dictation into the composer, transcribed on-device.":
    "Гласово въвеждане в полето за съобщения, разпознато на устройството.",
  "Open Settings": "Отвори настройките",
  "Enable": "Включи",
  "Start using KodBot": "Започнете да използвате KodBot",
  "Skip for now": "Пропусни засега",
  "Installed — ready for a local model.": "Инсталиран — готов за локален модел.",
  "Installed — ready to power bots.": "Инсталиран — готов да задвижва ботове.",

  // Command palette
  "Command palette": "Командна палитра",
  "Search bots, rooms, messages…": "Търсене на ботове, стаи, съобщения…",
  "Nothing to switch to yet": "Още няма към какво да превключите",
  "Bots": "Ботове",
  "Rooms": "Стаи",
  "Messages": "Съобщения",

  // Companion settings
  "The companion runs as its own process, which only the desktop app can start. Open KodBot on this computer to turn it on.":
    "Компаньонът работи като отделен процес, който само настолното приложение може да стартира. Отворете KodBot на този компютър, за да го включите.",
  "Let a phone open your chats, answer approvals, and send new work. Off by default: your bots run commands on this computer, so only pair a device you trust, on a network you trust.":
    "Позволете на телефон да отваря разговорите ви, да отговаря на заявки и да изпраща нови задачи. По подразбиране е изключено: ботовете изпълняват команди на този компютър, затова свързвайте само устройство, на което имате доверие, в мрежа, на която имате доверие.",
  "On": "Включен",
  "Off": "Изключен",
  "Nothing on this computer is reachable from the network.":
    "Нищо на този компютър не е достъпно от мрежата.",
  "Listening on port {port} — no network address yet.": "Слуша на порт {port} — още няма мрежов адрес.",
  "Enter {address}:{port} on your phone — that works from anywhere on your tailnet, on any network.":
    "Въведете {address}:{port} на телефона си — работи отвсякъде във вашия tailnet, във всяка мрежа.",
  "Your phone will find this computer as “{name}”, or you can enter {address}:{port}.":
    "Телефонът ви ще намери този компютър като „{name}“, или можете да въведете {address}:{port}.",
  "Listening on {address}:{port} — enter that on your phone.":
    "Слуша на {address}:{port} — въведете това на телефона си.",
  "On this network only: {address}:{port}": "Само в тази мрежа: {address}:{port}",
  "You're on a tailnet, but this computer's MagicDNS name couldn't be read from the Tailscale app — either MagicDNS is off, or the Tailscale command line tool isn't where we looked. iPhones can't connect to a bare tailnet address, so check the KodBot log for which paths were tried.":
    "Намирате се в tailnet, но името MagicDNS на този компютър не може да бъде прочетено от приложението Tailscale — или MagicDNS е изключен, или инструментът за команден ред Tailscale не е там, където го търсихме. iPhone не може да се свързва с гол адрес в tailnet, затова проверете в лога на KodBot кои пътища са опитани.",
  "Only reachable on this network. Install Tailscale on both this computer and your phone to reach it from anywhere — including networks that stop devices from seeing each other.":
    "Достъпно само в тази мрежа. Инсталирайте Tailscale както на този компютър, така и на телефона си, за да го достигате отвсякъде — включително в мрежи, които пречат на устройствата да се виждат.",
  "Connect a phone": "Свържете телефон",
  "Install KodBot, open it, and tap Scan pairing QR. You can also enter the code below.":
    "Инсталирайте KodBot, отворете го и натиснете Сканирай QR за свързване. Можете също да въведете кода по-долу.",
  "Open KodBot, choose this computer or enter the address shown here, then enter the code.":
    "Отворете KodBot, изберете този компютър или въведете показания адрес, след което въведете кода.",
  "Open a short, single-use pairing window for a trusted phone.":
    "Отворете кратък прозорец за еднократно свързване за доверен телефон.",
  "This turns on Companion and opens a short, single-use pairing window in one step.":
    "Това включва Компаньон и отваря кратък прозорец за еднократно свързване с една стъпка.",
  "Phone pairing QR code": "QR код за свързване на телефон",
  "Signed in as {email} on this KodBot server.":
    "Влязъл си като {email} на този KodBot сървър.",
  "This hosted workspace is isolated to your account. A paired phone sees only your bots and rooms.":
    "Това hosted работно пространство е изолирано за твоя акаунт. Свързаният телефон вижда само твоите ботове и стаи.",
  "Scan the QR with the KodBot Android app, or enter the server address and code manually.":
    "Сканирай QR с KodBot Android app или въведи адреса на сървъра и кода ръчно.",
  "Removing a device signs it out immediately.":
    "Премахването на устройство го отписва веднага.",
  "Remove this device?": "Да се премахне ли това устройство?",
  "Remove this device": "Премахни това устройство",
  "Owner": "Собственик",
  "Member": "Член",
  "Signed in as {email} ({role}).": "Влязъл си като {email} ({role}).",
  "Sign out": "Изход",
  "Manual code": "Ръчен код",
  "Expires in {seconds}s": "Изтича след {seconds} сек.",
  "Or open the mobile app and choose “{name}” under On this network.":
    "Или отворете мобилното приложение и изберете „{name}“ под В тази мрежа.",
  "Preparing…": "Подготовка…",
  "Pair another phone": "Свържете друг телефон",
  "Set up a phone": "Настройте телефон",
  "Paired devices": "Свързани устройства",
  "Cloud desktop is full interactive access. Enable it only for a phone you trust; removing a device signs it out immediately.":
    "Облачният работен плот дава пълен интерактивен достъп. Включвайте го само за телефон, на който имате доверие; премахването на устройство го отписва веднага.",
  "No phones are paired yet.": "Още няма свързани телефони.",
  "Last seen {time}": "Последно виждан {time}",
  "Cloud desktop": "Облачен работен плот",
  "Cloud desktop access for {name}": "Достъп до облачния работен плот за {name}",
  "Remove {name}": "Премахни {name}",
  "just now": "току-що",
  "{count} min ago": "преди {count} мин.",
  "{count} h ago": "преди {count} ч.",
  "{count} d ago": "преди {count} дни",

  // Usage and voice
  "Tokens and cost per bot, added up from every settled turn. Only engines that report a price show one.":
    "Токени и цена за всеки бот, сумирани от всеки приключил ход. Показва се цена само при двигатели, които я отчитат.",
  "Nothing spent yet — figures appear after a bot's first turn.":
    "Още няма разходи — данните се появяват след първия ход на бот.",
  "All bots": "Всички ботове",
  "Cost is {caption}.": "Цената е {caption}.",
  "as each engine reports it — on a subscription it's an equivalent, not a charge":
    "както я отчита всеки двигател — при абонамент това е еквивалент, а не такса",
  "Read replies aloud and talk to your bots, using your own ElevenLabs account. Billed per character by ElevenLabs.":
    "Озвучавайте отговорите и говорете с ботовете си чрез собствения си акаунт в ElevenLabs. Таксува се за знак от ElevenLabs.",
  "ElevenLabs key": "Ключ за ElevenLabs",
  "Connected": "Свързано",
  "••••••••  (paste to replace)": "••••••••  (поставете нов, за да замените)",
  "Paste your ElevenLabs API key": "Поставете своя API ключ за ElevenLabs",
  "Get a key from ElevenLabs": "Вземете ключ от ElevenLabs",
  "Pick a voice": "Изберете глас",
  "Hear this voice": "Чуйте този глас",
  "Pick a voice first": "Първо изберете глас",
  "Try": "Опитай",

  // Automations — schedules
  "Run CREW tasks on a schedule.": "Изпълнявайте задачи на CREW по график.",
  "Run CREW tasks when an event arrives.": "Изпълнявайте задачи на CREW при настъпване на събитие.",
  "{count} active": "{count} активни",
  "{count} need attention": "{count} изискват внимание",
  "{count} paused": "{count} на пауза",
  "New schedule": "Нов график",
  "Schedules": "Графици",
  "Webhooks": "Уебхукове",
  "Previous dates": "Предишни дати",
  "Next dates": "Следващи дати",
  "All CREWes": "Всички CREW",
  "Day": "Ден",
  "3 days": "3 дни",
  "Week": "Седмица",
  "Put your CREW team on a rhythm": "Дайте ритъм на вашия екип CREW",
  "Plan research briefs, daily check-ins, recurring reviews, or one-time work. Every run becomes a separate task with its own result.":
    "Планирайте проучвания, ежедневни проверки, повтарящи се прегледи или еднократна работа. Всяко изпълнение става отделна задача със собствен резултат.",
  "Create your first schedule": "Създайте първия си график",
  "Create a bot first, then come back to schedule it.":
    "Първо създайте бот, след което се върнете, за да го планирате.",
  "Routine": "Рутина",
  "Every day at {time}": "Всеки ден в {time}",
  "Weekdays at {time}": "В делнични дни в {time}",
  "{days} at {time}": "{days} в {time}",
  "Queued": "На опашка",
  "Running": "Изпълнява се",
  "Needs you": "Нуждае се от вас",
  "Completed": "Завършено",
  "Failed": "Неуспешно",
  "Missed": "Пропуснато",
  "Cancelled": "Отменено",
  "Scheduled": "Планирано",
  "Edit schedule": "Редактирай графика",
  "Give a CREW scheduled work with a calendar you can trust.":
    "Дайте на CREW работа по график с календар, на който можете да разчитате.",
  "Schedule name": "Име на графика",
  "Morning research brief": "Сутрешен преглед на проучвания",
  "Where does it run?": "Къде се изпълнява?",
  "This computer": "Този компютър",
  "Uses this CREW's selected model and computer setting.":
    "Използва избрания модел и настройка на компютъра за този CREW.",
  "Cloud VM": "Облачна VM",
  "Runs the CREW and its tools inside its Box virtual machine.":
    "Изпълнява CREW и инструментите му във виртуалната му машина Box.",
  "The VM wakes automatically for each run. Keep KodBot running so its scheduler can launch the job.":
    "VM се събужда автоматично за всяко изпълнение. Оставете KodBot отворен, за да може планировчикът да стартира задачата.",
  "Cloud VM needs a working Box API key in App Settings before this routine can run.":
    "Облачната VM изисква работещ API ключ за Box в настройките, преди тази рутина да може да се изпълни.",
  "Who does it?": "Кой го изпълнява?",
  "Worker bot": "Работен бот",
  "Same bot — runs in a separate task": "Същият бот — изпълнява се в отделна задача",
  "The owner bot keeps this automation and receives the result in a Results task. The worker runs it in its own task, so the owner’s chat never changes.":
    "Ботът собственик запазва автоматизацията и получава резултата в задача „Резултати“. Работният бот я изпълнява в своя задача, така че чатът на собственика никога не се променя.",
  "worker": "работен",
  "Each request runs on the worker and reports back to the owner.":
    "Всяка заявка се изпълнява от работния бот и връща резултата на собственика.",
  "Worker: {name}": "Работен бот: {name}",
  "Worker": "Работен бот",
  "Results go to": "Резултатите отиват при",
  "Copy this command into Terminal and press Return. It starts a real task on the worker {name}; the result comes back here.":
    "Копирайте тази команда в Терминал и натиснете Enter. Тя стартира истинска задача при работния бот {name}; резултатът се връща тук.",
  "Archive task": "Архивирай задачата",
  "Archive this task — keep its messages, hide it from this list":
    "Архивирай тази задача — съобщенията остават, но задачата се скрива от списъка",
  "Archived tasks": "Архивирани задачи",
  "Hide archived": "Скрий архивираните",
  "Restore this task": "Възстанови тази задача",
  "Assigned from Computer": "Зададен от Компютър",
  "What should this CREW do?": "Какво да направи този CREW?",
  "Check the latest project activity, summarize what changed, and call out anything that needs my attention…":
    "Проверете последната активност по проекта, обобщете какво се е променило и отбележете всичко, което изисква вниманието ми…",
  "When?": "Кога?",
  "Repeating": "Повтарящ се",
  "Once": "Еднократно",
  "Calendar block": "Блок в календара",
  "{count} min": "{count} мин.",
  "1 hour": "1 час",
  "{count} hours": "{count} часа",
  "Save changes": "Запази промените",
  "Create schedule": "Създай график",
  "Schedule": "График",
  "Runs on": "Изпълнява се на",
  "CREW setup": "Настройка на CREW",
  "Duration": "Продължителност",
  "Triggered by": "Задействано от",
  "Delivery ID": "ID на доставка",
  "Instructions": "Инструкции",
  "Webhook event data": "Данни от уебхук събитието",
  "Last output": "Последен резултат",
  "This CREW needs your answer. Open its task to continue the run.":
    "Този CREW се нуждае от вашия отговор. Отворете задачата му, за да продължи изпълнението.",
  "Run now": "Изпълни сега",
  "Open task": "Отвори задачата",
  "Other tasks": "Други задачи",
  "Cancel run": "Отмени изпълнението",
  "Pause": "Пауза",
  "Resume": "Възобнови",
  "Edit": "Редактирай",
  "Delete routine": "Изтрий рутината",
  "Delete “{name}”? Its past run receipts will stay in the calendar.":
    "Да се изтрие ли „{name}“? Записите от минали изпълнения ще останат в календара.",
  "Paused routines": "Рутини на пауза",
  "They keep their history and will not create new runs.":
    "Запазват историята си и няма да създават нови изпълнения.",
  "Deleted CREW": "Изтрит CREW",
  "Delete “{name}”?": "Да се изтрие ли „{name}“?",

  // Automations — webhooks
  "Webhook": "Уебхук",
  "Local beta": "Локална бета",
  "Send a task to a CREW when another tool reports an event.":
    "Изпращайте задача към CREW, когато друг инструмент съобщи за събитие.",
  "Receiver running": "Приемникът работи",
  "Receiver unavailable": "Приемникът е недостъпен",
  "New webhook": "Нов уебхук",
  "Create your first webhook": "Създайте първия си уебхук",
  "Choose a CREW, copy one command, and every request becomes a new task in its chat.":
    "Изберете CREW, копирайте една команда и всяка заявка ще стане нова задача в разговора му.",
  "Create local webhook": "Създай локален уебхук",
  "Create a CREW first, then come back here.": "Първо създайте CREW, след което се върнете тук.",
  "Your webhooks": "Вашите уебхукове",
  "Waiting for test": "Чака тест",
  "Ready to enable": "Готово за включване",
  "Active": "Активен",
  "Paused": "На пауза",
  "No upcoming run": "Няма предстоящо изпълнение",
  "Edit settings": "Редактирай настройките",
  "Setup": "Настройка",
  "Activity": "Активност",
  "Scheduled and delegated work, and what needs you.": "Планирана и делегирана работа и какво чака теб.",
  "Needs attention": "Чакат внимание",
  "Done": "Готово",
  "Delegated": "Делегирано",
  "Live": "На живо",
  "Waiting for you": "Чака теб",
  "No background work here.": "Тук няма фонова работа.",
  "Scheduled runs, webhooks, delegations, and live turns will appear here.": "Планирани run-ове, webhooks, делегации и активни ходове ще се показват тук.",
  "Send a task": "Изпрати задача",
  "Copy this command into Terminal and press Return. It starts a real task in the chat with {name}; edit the task text for whatever you want done.":
    "Копирайте тази команда в Терминал и натиснете Enter. Тя стартира истинска задача в разговора с {name}; редактирайте текста на задачата според това, което искате да се направи.",
  "this CREW": "този CREW",
  "Terminal": "Терминал",
  "Copied": "Копирано",
  "Copy command": "Копирай командата",
  "Rotate private URL": "Смени частния URL",
  "The private URL is shown once. Generate a replacement to copy your webhook command; any older command for this webhook will stop working.":
    "Частният URL се показва само веднъж. Генерирайте заместител, за да копирате командата за уебхука; всяка по-стара команда за този уебхук ще спре да работи.",
  "Generate new private URL": "Генерирай нов частен URL",
  "Local only for now. Keep KodBot open while sending the request.":
    "Засега само локално. Оставете KodBot отворен, докато изпращате заявката.",
  "Request received": "Заявката е получена",
  "Empty payload": "Празни данни",
  "Turn on": "Включи",
  "Tasks go to": "Задачите отиват при",
  "Advanced": "Разширени",
  "Default instruction:": "Инструкция по подразбиране:",
  "The task or message sent with each request becomes the CREW instruction.":
    "Задачата или съобщението, изпратени с всяка заявка, стават инструкция за CREW.",
  "Accepted events:": "Приемани събития:",
  "All event types are accepted.": "Приемат се всички типове събития.",
  "Recent deliveries": "Последни доставки",
  "Accepted and rejected requests update automatically.":
    "Приетите и отхвърлените заявки се обновяват автоматично.",
  "No requests yet. Use the command in Setup to send one.":
    "Още няма заявки. Използвайте командата в Настройка, за да изпратите една.",
  "Accepted": "Прието",
  "Rejected": "Отхвърлено",
  "Ignored": "Игнорирано",
  "Test received": "Тестът е получен",
  "Duplicate request": "Дублирана заявка",
  "Rejected request": "Отхвърлена заявка",
  "Webhook event": "Уебхук събитие",
  "Open chat": "Отвори разговора",
  "Open this execution in the CREW chat": "Отвори това изпълнение в разговора на CREW",
  "Never": "Никога",
  "Just now": "Току-що",
  "{count}m ago": "преди {count} мин.",
  "{count}h ago": "преди {count} ч.",
  "Edit webhook": "Редактирай уебхука",
  "New local webhook": "Нов локален уебхук",
  "Each request starts a new task in the CREW chat.":
    "Всяка заявка стартира нова задача в разговора на CREW.",
  "Who receives the tasks?": "Кой получава задачите?",
  "Send the task in the request:": "Изпратете задачата в заявката:",
  "The CREW keeps its model, tools, permissions, and computer setup.":
    "CREW запазва своя модел, инструменти, разрешения и настройки на компютъра.",
  "Advanced options": "Разширени опции",
  "· optional": "· по избор",
  "Default instructions": "Инструкции по подразбиране",
  "For every event, summarize what happened and suggest the next step…":
    "За всяко събитие обобщете какво се е случило и предложете следващата стъпка…",
  "Use this only when every event needs the same handling rule. Otherwise the request’s task is used.":
    "Използвайте това само когато всяко събитие изисква едно и също правило за обработка. В противен случай се използва задачата от заявката.",
  "Run on": "Изпълнявай на",
  "Only accept event types": "Приемай само типове събития",
  "Comma-separated values from the sender’s event-type header.":
    "Стойности, разделени със запетая, от заглавката за тип събитие на изпращача.",
  "{name} webhook": "уебхук на {name}",
  "Delete “{name}”? Existing task history will stay available.":
    "Да се изтрие ли „{name}“? Историята на задачите ще остане достъпна.",
  "Send a request before turning this webhook on":
    "Изпратете заявка, преди да включите този уебхук",
  "Replace this private URL? Every previously copied command will stop working.":
    "Да се замени ли този частен URL? Всички предишни копирани команди ще спрат да работят.",
  "Could not create a terminal command": "Не може да се създаде команда за терминала",

  // Connected apps
  "Connect the apps your bots can use.":
    "Свържете приложенията, които ботовете ви могат да използват.",
  "Refresh connection status": "Обнови състоянието на връзките",
  "Check status": "Провери състоянието",
  "Check connection status": "Провери състоянието на връзката",
  "Could not read connection status. Check that the server is reachable, then retry.":
    "Състоянието на връзките не може да бъде прочетено. Проверете дали сървърът е достъпен и опитайте отново.",
  "Retry status": "Провери отново",
  "{count} bot(s) cannot use connected apps yet.":
    "{count} бота още нямат достъп до свързаните приложения.",
  "Connected apps are granted per bot. This turns them on for every bot that supports them.":
    "Свързаните приложения се разрешават за всеки бот поотделно. Това ги включва за всеки бот, който ги поддържа.",
  "Allow for all bots": "Разреши за всички ботове",
  "Allowing…": "Разрешаване…",
  "Close connected apps": "Затвори свързаните приложения",
  "Connected apps view": "Изглед на свързаните приложения",
  "Marketplace": "Пазар",
  "Marketplace and accounts": "Пазар и акаунти",
  "Connected tab": "Свързани",
  "Search apps": "Търсене на приложения",
  "Connected apps are temporarily unavailable. You can retry after restarting, or configure your own connection service.":
    "Свързаните приложения временно не са достъпни. Можете да опитате отново след рестартиране или да настроите собствена услуга за връзки.",
  "Open settings": "Отвори настройките",
  "Showing featured apps.": "Показват се препоръчани приложения.",
  "Update your Composio key": "Актуализирайте ключа си за Composio",
  "for the full catalog.": "за пълния каталог.",
  "Loading catalog…": "Зареждане на каталога…",
  "Checking connections…": "Проверка на връзките…",
  "Your connections": "Вашите връзки",
  "Search results": "Резултати от търсенето",
  "Available apps": "Налични приложения",
  "Finish setup in your browser": "Завършете настройката в браузъра си",
  "Authorization expired — try again": "Разрешението изтече — опитайте отново",
  "Disconnect {name}": "Прекъсни връзката с {name}",
  "Connect": "Свържи",
  "No connected apps yet": "Още няма свързани приложения",
  "No apps found": "Няма намерени приложения",
  "Connect an app from Marketplace and it will appear here.":
    "Свържете приложение от Пазара и то ще се появи тук.",
  "Try a different search.": "Опитайте с друго търсене.",
  "Your browser blocked the connection page. Click Continue to open it.":
    "Браузърът ви блокира страницата за свързване. Натиснете Продължи, за да я отворите.",
  "Your browser blocked the connection page. Allow pop-ups, then try again.":
    "Браузърът ви блокира страницата за свързване. Разрешете изскачащи прозорци и опитайте отново.",
  "Connected securely. Your bot is continuing the task.":
    "Свързано сигурно. Ботът продължава задачата.",
  "Connected securely. Continue the paused task when you're ready.":
    "Свързано сигурно. Продължете спряната задача, когато сте готови.",
  "Sign in or enter the app key on the secure connection page — never in chat.":
    "Влезте или въведете ключа за приложението на сигурната страница за свързване — никога в чата.",
  "Not now": "Не сега",
  "Waiting for sign-in…": "Чакане на вход…",
  "Ready to use": "Готово за използване",
  "Requested by your bot": "Заявено от вашия бот",
  "Open again": "Отвори отново",
  "Try again": "Опитай отново",
  "Connect securely": "Свържи сигурно",
  "Continue task": "Продължи задачата",
  "Continuing": "Продължава",
  "Details": "Детайли",
  "View account details": "Виж детайлите на акаунта",
  "{count} active account(s)": "{count} активни акаунта",
  "Accounts need attention — open details": "Акаунтите изискват внимание — отворете детайлите",
  "Authorization expired — open details": "Разрешението изтече — отворете детайлите",
  "Account": "Акаунт",
  "Accounts": "Акаунти",
  "Service alias": "Служебен псевдоним",
  "Unknown status": "Неизвестно състояние",
  "Reconnect": "Свържи отново",
  "Reconnect this account": "Свържи отново този акаунт",
  "Remove this account": "Премахни този акаунт",
  "Remove this account?": "Да се премахне ли този акаунт?",
  "Add a friendly label": "Добавете разпознаваемо име",
  "Save label": "Запази името",
  "Close details": "Затвори детайлите",
  "{count} account(s)": "{count} акаунта",
  "No account details are visible yet. Connect an account to see it here.":
    "Още няма видими детайли за акаунт. Свържете акаунт, за да го видите тук.",
  "This host uses the managed connected-apps service. Account labels are local; disconnecting removes this app connection.":
    "Този хост използва управляваната услуга за свързани приложения. Имената на акаунтите са локални; прекъсването премахва връзката на приложението.",
  "Add another account": "Добави друг акаунт",
  "Disconnect app": "Прекъсни връзката на приложението",
  "Disconnect every account for {name}?": "Да се прекъснат ли всички акаунти за {name}?",
  "Not connected": "Не е свързано",

  // Bot roles
  "Role": "Роля",
  "Auto": "Автоматично",
  "Coordinator": "Координатор",
  "Researcher": "Изследовател",
  "Builder": "Разработчик",
  "Designer": "Дизайнер",
  "Writer": "Писател",
  "Operator": "Оператор",
  "Analyst": "Анализатор",
  "Guide": "Помощник",
  "Owns the outcome and keeps the team moving": "Поема резултата и движи екипа напред",
  "Finds sources, checks facts, and maps the ground": "Намира източници, проверява факти и проучва",
  "Writes code, fixes systems, and ships changes": "Пише код, поправя системи и пуска промени",
  "Shapes interfaces, visuals, and the feel of things": "Оформя интерфейси, визия и усещане",
  "Drafts, edits, and turns notes into clear prose": "Пише, редактира и превръща бележките в ясен текст",
  "Watches systems, handles incidents, and keeps uptime": "Следи системи, реагира при инциденти и пази uptime",
  "Reads the numbers and explains what they mean": "Чете числата и обяснява какво означават",
  "Onboards people, answers questions, and supports": "Обучава, отговаря на въпроси и помага",
  "Suggested from the bot's title: {name}": "Предложено от заглавието на бота: {name}",
  "Suggested: {name}": "Предложено: {name}",
  "Pick the job this bot presents as. It changes the badge and idle motion.":
    "Изберете професията, с която ботът се представя. Тя променя значката и движението в покой.",
  "Choose a role": "Изберете роля",
  // Memory import
  "Bring context from ChatGPT, Claude, or another assistant.":
    "Пренесете контекст от ChatGPT, Claude или друг асистент.",
  "Import memory": "Импортирай памет",
  "Copy the prompt into your other assistant, then paste its answer here.":
    "Копирайте подканата в другия асистент, след което поставете отговора тук.",
  "1. Get the summary": "1. Вземете обобщението",
  "Copy prompt": "Копирай подканата",
  "2. Paste the answer": "2. Поставете отговора",
  "Paste the memory summary here…": "Поставете обобщението на паметта тук…",
  "3. Where should it go?": "3. Къде да отиде?",
  "Append to MEMORY.md": "Добави към MEMORY.md",
  "Replace MEMORY.md": "Замени MEMORY.md",
  "Save as a topic file": "Запази като тематичен файл",
  "imported-memory": "imported-memory",
  "Topic file name": "Име на тематичния файл",
  "Importing…": "Импортиране…",
  "Import": "Импортирай",
  "Replace the current MEMORY.md with this text? This cannot be undone.":
    "Да се замени ли текущият MEMORY.md с този текст? Това не може да бъде отменено.",
  "The browser blocked clipboard access. Select the prompt and copy it manually.":
    "Браузърът блокира достъпа до клипборда. Изберете подканата и я копирайте ръчно.",
  // Pages
  "Pages": "Страници",
  "Open page": "Отвори страницата",
  "Open in KodBot": "Отвори в KodBot",
  "Private page": "Частна страница",
  "Dashboards, checklists, and reports the bot builds as private web pages.":
    "Табла, списъци и отчети, които ботът създава като частни уеб страници.",
  "Pages run in a sandbox and cannot read your chat or credentials.":
    "Страниците се изпълняват в пясъчник и не могат да четат чата или идентификационните ви данни.",
  "No pages yet. Ask this bot to build a dashboard, checklist, or report — it will appear here.":
    "Още няма страници. Помолете бота да създаде табло, списък или отчет — те ще се появят тук.",
  "Open {name}": "Отвори {name}",
  "Copy link": "Копирай връзката",
  "Delete {name}": "Изтрий {name}",
  "Tip: ask for “a dashboard with our open orders” or “a checklist I can share with the team”.":
    "Съвет: поискайте „табло с отворените поръчки“ или „списък, който да споделя с екипа“.",
  "Delete the page “{name}”?": "Да се изтрие ли страницата „{name}“?",
  "Open in a new window": "Отвори в нов прозорец",
  "Close page": "Затвори страницата",
  "The browser blocked clipboard access; open the page and copy its URL.":
    "Браузърът блокира достъпа до клипборда; отворете страницата и копирайте URL адреса ѝ.",
  "Copy from page": "Копиране от страница",
  "The page asked to put this text on your clipboard.":
    "Страницата поиска да постави този текст в клипборда ви.",
  "Text from page": "Текст от страницата",
  "Copy": "Копирай",
  "Select all": "Избери всичко",
  "The browser blocked the clipboard. The text is selected — press Ctrl+C or ⌘C.":
    "Браузърът блокира клипборда. Текстът е избран — натиснете Ctrl+C или ⌘C.",
  // Auto model
  "Auto model": "Автоматичен модел",
  "The picker shows the last routed model; the next task is routed again.":
    "Изборът показва последния използван модел; следващата задача се маршрутизира отново.",
  "Pick the strongest available model for each task. A short question stays on that model unless Economy mode is on.":
    "Избира най-силния наличен модел за всяка задача. Краткият въпрос остава на него, освен ако икономичният режим е включен.",
  "Economy mode": "Икономичен режим",
  "Short, simple questions use a faster or free model. Code and the screen stay on a strong one.":
    "Кратките и прости въпроси ползват по-бърз или безплатен модел. Кодът и екранът остават на силен модел.",
  // Work alone
  "Work alone": "Работи самостоятелно",
  "When a turn stops with work still open, the bot continues once by itself. It still asks before anything destructive, secret, sudo, or outbound.":
    "Когато ходът спре с незавършена работа, ботът продължава веднъж сам. Пак пита преди нещо разрушително, тайно, sudo или изходящо.",
  // Keyboard shortcuts
  "Keyboard shortcuts": "Клавишни комбинации",
  "Work faster with the keyboard. These shortcuts work anywhere in KodBot.":
    "Работете по-бързо с клавиатурата. Тези комбинации работят навсякъде в KodBot.",
  "Every app-wide chord in one place.": "Всички глобални комбинации на едно място.",
  "Show all shortcuts": "Покажи всички комбинации",
  "Navigation": "Навигация",
  "Jump to a bot": "Към бот",
  "Previous bot": "Предишен бот",
  "Next bot": "Следващ бот",
  "Chat": "Чат",
  "New line": "Нов ред",
  "Edit last message when the box is empty": "Редактирай последното съобщение, когато полето е празно",
  "Send a room bulletin": "Публикувай бюлетин в стая",
  "Close a panel or dialog": "Затвори панел или диалог",
  "Close keyboard shortcuts": "Затвори клавишните комбинации",
  "Press Esc to close": "Натиснете Esc за затваряне",
  // Composer and remote paths
  "Dismiss": "Отхвърли",
  "Uploading attachment": "Качване на прикачен файл",
  "Uploading attachment…": "Качване на прикачен файл…",
  "This folder is on the remote server.": "Тази папка е на отдалечения сървър.",
  // Composer attachments
  "Attach files": "Прикачи файлове",
  "Could not attach {names}. Choose a file saved on this computer.":
    "Неуспешно прикачване на {names}. Изберете файл, записан на този компютър.",
  // Connected-app account details
  "About connected accounts": "Относно свързаните акаунти",
  "Each row is one connected account. Active means KodBot can use it. Expired means the sign-in has ended — remove that row, then connect the account again. Waiting for sign-in means the provider page is still open or unfinished. When the address is hidden, the provider will reveal it after the account is active again.":
    "Всеки ред е един свързан акаунт. „Активен“ означава, че KodBot може да го използва. „Изтекъл“ означава, че входът е приключил — премахнете реда и свържете акаунта отново. „Чака вход“ означава, че страницата на доставчика е още отворена или незавършена. Когато адресът е скрит, доставчикът ще го покаже, след като акаунтът отново стане активен.",
  "Expired — sign in again": "Изтекъл — влезте отново",
  "Waiting for sign-in": "Чака вход",
  "Checking the signed-in address…": "Проверка на адреса за вход…",
  "Signed in as": "Влязъл като",
  "Address unavailable: {reason}": "Адресът е недостъпен: {reason}",
  "The address is hidden until this account is active again.":
    "Адресът е скрит, докато акаунтът отново не стане активен.",
  "Technical details": "Технически данни",
  "Start a fresh sign-in. Remove this expired row after the new one works.":
    "Стартирайте нов вход. Премахнете изтеклия ред, след като новият работи.",
  "Sign in again": "Влезте отново",
  "Remove": "Премахни",
  "Remove the {service} account “{name}”? KodBot will lose access to it. You can connect it again later.":
    "Да се премахне ли {service} акаунтът „{name}“? KodBot ще загуби достъп до него. Можете да го свържете отново по-късно.",
  "Labels are stored only in KodBot. Removing a row revokes KodBot's access to that connection; it does not delete the account with the provider.":
    "Етикетите се пазят само в KodBot. Премахването на ред отнема достъпа на KodBot до тази връзка; не изтрива акаунта при доставчика.",
  // Mascot body shapes
  "Shape": "Форма",
  "Use the shape suggested by this bot's role": "Използвай формата, подсказана от ролята на бота",
  "Use {name} body shape": "Използвай форма „{name}“",
  "Orb": "Сфера",
  "Bubble": "Балон",
  "Pill": "Капсула",
  "Hex": "Шестоъгълник",
  "Diamond": "Диамант",
  "Star": "Звезда",
  "Drop": "Капка",
  "Shield": "Щит",
  "Ghost": "Духче",
  "Classic": "Класическа",
  // Product cards
  "Buy now": "Купи сега",
  // Connected apps hover help
  "Connect this app to let bots use its tools.":
    "Свържете това приложение, за да могат ботовете да използват инструментите му.",
  // Bot teams
  "Team name": "Име на екипа",
  "Other bots": "Други ботове",
  // Model capability badges
  "Text": "Текст",
  "Vision": "Зрение",
  "Audio": "Звук",
  "Image generation": "Генериране на изображения",
  "Video generation": "Генериране на видео",
  "Reasoning": "Разсъждение",
  // Auto model pool
  "Auto model pool": "Набор за автоматичен модел",
  "Choose which models Auto mode may use. Only this list is considered; nothing else is sent to another provider.":
    "Изберете кои модели може да използва автоматичният режим. Разглежда се само този списък; нищо друго не се изпраща към друг доставчик.",
  "Choose models": "Избери модели",
  "{count} models in the auto pool": "{count} модела в автоматичния набор",
  "Using all models from the current engine.": "Използват се всички модели от текущия engine.",
  "Use current engine only": "Само текущият engine",
  "{count} selected": "{count} избрани",
  "Save pool": "Запази набора",
  "No available models. Install or sign in to an engine first.":
    "Няма налични модели. Първо инсталирайте или влезте в engine.",
  "All": "Всички",
  // Teams
  "Manage teams": "Управление на екипи",
  "Team library": "Библиотека с екипи",
  "Create team": "Създай екип",
  "Create a team": "Създаване на екип",
  "Team leader": "Лидер на екипа",
  "Lead: {name}": "Лидер: {name}",
  "Choose a bot…": "Изберете бот…",
  "No ungrouped bots": "Няма ботове без екип",
  "Every bot is already in a team. Leave a team before creating another.":
    "Всеки бот вече е в екип. Напуснете екип, преди да създадете нов.",
  "No teams yet.": "Още няма екипи.",
  "Create teams with an ungrouped bot as leader. Members can join one team at a time; a new leader must be chosen before the current one leaves.":
    "Създавайте екипи с бот без екип като лидер. Членовете могат да са в един екип; преди лидерът да напусне, трябва да бъде избран нов.",
  "Leader": "Лидер",
  "Make leader": "Направи лидер",
  "No leader": "Без лидер",
  "{count} members": "{count} членове",
  "No members.": "Няма членове.",
  "Remove {name} from the team": "Премахни {name} от екипа",
  "Remove from team": "Премахни от екипа",
  "Remove {name} from this team?": "Да се премахне ли {name} от този екип?",
  "Rename team": "Преименувай екипа",
  "Delete team": "Изтрий екипа",
  "Delete the team “{name}”? Bots become ungrouped.":
    "Да се изтрие ли екипът „{name}“? Ботовете остават без екип.",
  "Bot to add": "Бот за добавяне",
  "Add a bot…": "Добави бот…",
  "Add": "Добави",
  "Open team room": "Отвори стаята на екипа",
  "Create team room": "Създай стая за екипа",
  "Leave team": "Напусни екипа",
  "Choose a new leader first": "Първо изберете нов лидер",
  "Leave this team": "Напусни този екип",
  "Create a team with this bot as leader": "Създай екип с този бот като лидер",
  "Team": "Екип",
  "Not in a team": "Не е в екип",
  "Join a team": "Присъедини се към екип",
  "Join a team…": "Присъедини се към екип…",
  "Choose a new leader in Manage teams": "Изберете нов лидер от Manage teams",
  "Create a team from Manage teams.": "Създайте екип от Manage teams.",

  // Approvals and pending actions
  "Pending approval": "Чака одобрение",
  "{index} of {count}": "{index} от {count}",
  "Command approval requested": "Поискано е одобрение за команда",
  "Tool approval requested": "Поискано е одобрение за инструмент",
  "File-read approval requested": "Поискано е одобрение за четене на файл",
  "File-change approval requested": "Поискано е одобрение за промяна на файл",
  "Approval requested": "Поискано е одобрение",
  "What this means:": "Какво означава:",
  "Why it needs approval:": "Защо е нужно одобрение:",
  "Task: {purpose}": "Задача: {purpose}",
  "Cancel turn": "Отмени хода",
  "Deny": "Откажи",
  "Always allow": "Винаги разрешавай",
  "Allow once": "Разреши веднъж",
  "Stop asking {name} about {key}": "Спри да питаш {name} за {key}",
  "Wants to": "Иска да",
  "{name} wants to": "{name} иска да",
  "an action": "действие",
  "run a command": "изпълни команда",
  "use a tool": "използва инструмент",
  "read a file": "прочете файл",
  "write a file": "запише файл",
  "edit a file": "редактира файл",
  "fetch a web page": "изтегли уеб страница",
  "search the web": "търси в мрежата",
  "Allowed": "Разрешено",
  "Denied": "Отказано",
  "Waiting for your answer below": "Чака отговора ви по-долу",

  // Server-authored cards
  "This still needs you": "Това още има нужда от вас",
  "One follow-up already tried the rest. A person has to decide the next step.":
    "Едно продължение вече опита остатъка. Човек трябва да реши следващата стъпка.",
  "I'll take it from here": "Продължавам аз",
  "Continuing the unfinished work once": "Продължаване на незавършената работа веднъж",

  // Rooms and working folder
  "Plain messages go to every room member; @mentions override this":
    "Обикновените съобщения отиват до всички в стаята; @споменаванията ги заместват",
  "Only explicitly @mentioned bots respond": "Отговарят само ботовете, изрично @споменати",
  "Plain messages go to {name}; @mentions override this":
    "Обикновените съобщения отиват до {name}; @споменаванията ги заместват",
  "the lead bot": "водещия бот",
  "Default responder": "Отговарящ по подразбиране",
  "Room lead": "Лидер на стаята",
  "Room behavior": "Поведение на стаята",
  "Everyone responds": "Всички отговарят",
  "Mentions only": "Само споменати",
  "Where every bot in this room runs its shell and file tools.":
    "Където всеки бот в тази стая изпълнява shell и файловите си инструменти.",
  "Each bot's own folder": "Собствената папка на всеки бот",
  "Fixed after this room's first turn. Create a new room and choose its folder before sending the first message to work somewhere else.":
    "Фиксира се след първия ход на стаята. Създайте нова стая и изберете папката ѝ преди първото съобщение, за да работите другаде.",
  "Each bot's own folder — or an absolute path": "Собствената папка на всеки бот — или абсолютен път",
  "Room working folder": "Работна папка на стаята",

  // Update banner
  "KodBot {version} is available": "Налична е KodBot {version}",
  "Downloading {version}…": "Сваляне на {version}…",
  "{version} is ready": "{version} е готов",
  "Update check failed": "Проверката за обновления не успя",
  "A newer version is ready to download.": "Налична е по-нова версия за сваляне.",
  "Restart to finish updating.": "Рестартирайте, за да завърши обновяването.",
  "KodBot will reopen in a moment.": "KodBot ще се отвори отново след момент.",
  "Restart to update": "Рестартирай за обновяване",
  "No update has been published for this platform yet.": "Още няма публикувано обновление за тази платформа.",
  "update": "обновление",
  "Restarting…": "Рестартиране…",
  "Later": "По-късно",
  "Couldn't reach the update server.": "Сървърът за обновления не е достъпен.",
  "Something went wrong.": "Нещо се обърка.",
  "Drop to attach — the bot gets the file path": "Пусни, за да прикачиш — ботът получава пътя до файла",
  "Undo": "Отмени",
  "Install an AI engine to get started": "Инсталирайте AI engine, за да започнете",
  "KodBot doesn't ship a model of its own — your bots run on an AI CLI installed on this computer, using your existing login. Set up any one of these and your bots come alive.":
    "KodBot не включва собствен модел — ботовете работят с AI CLI, инсталиран на този компютър, с вашия съществуващ вход. Настройте един от тези и ботовете оживяват.",
  "Check again": "Провери отново",
  "Optional": "Незадължително",
  "Remove the saved key": "Премахни запазения ключ",
  "Terminal opened": "Терминалът е отворен",
  "Paste the command and press Enter.": "Поставете командата и натиснете Enter.",
  "The command is copied when Terminal opens.": "Командата се копира при отваряне на Terminal.",
  "Command copied": "Командата е копирана",
  "Run this command on the remote server, not this laptop.":
    "Изпълнете тази команда на отдалечения сървър, не на този лаптоп.",
  "Sign in to {name}": "Вход в {name}",
  "Install {name}": "Инсталирай {name}",
  "Finish the account sign-in in Terminal. Reopen this menu afterward and we'll check again.":
    "Завършете входа в акаунта в Terminal. Отворете това меню отново и ще проверим пак.",
  "Install the agent once, then you can run it with local models—no cloud sign-in required.":
    "Инсталирайте агента веднъж, после може да го пускате с локални модели — без вход в облака.",
  "Install the command-line app once. Models will appear here as soon as it's ready.":
    "Инсталирайте command-line приложението веднъж. Моделите ще се появят тук, щом е готово.",
  "Sign-in may follow.": "Може да последва вход.",
  "{name} isn't ready": "{name} не е готов",
  "This engine is not available on this machine.": "Този engine не е наличен на тази машина.",
  "There isn't a one-line installer for this platform. Use the setup guide below.":
    "Няма еднократен installer за тази платформа. Използвайте ръководството по-долу.",
  "Requires Node.js and": "Изисква Node.js и",
  "View setup guide": "Виж ръководството за настройка",
  "Open sign-in in Terminal": "Отвори входа в Terminal",
  "Open install in Terminal": "Отвори инсталацията в Terminal",
  "Call unavailable": "Разговорът не е наличен",
  "Open Voice settings": "Отвори настройките за глас",
  "Try microphone again": "Опитай микрофона отново",
  "Interrupt": "Прекъсни",
  "Hang up": "Затвори",
  "Hold Control + Option to talk · Space interrupts · Esc hangs up":
    "Задръжте Control + Option, за да говорите · Space прекъсва · Esc затваря",
  "Hang up on {name}": "Затвори разговора с {name}",
  "Save this as a routine?": "Да се запази ли това като рутина?",
  "Edit the prompt and the time. It stays paused until you turn it on.":
    "Редактирайте текста и часа. Остава на пауза, докато не я включите.",
  "Save as a paused routine": "Запази като рутина на пауза",
  "Prompt": "Текст",
  "Time": "Час",
  "Share the cloud computer with the team": "Сподели облачния компютър с екипа",
  "{name}'s screen": "Екранът на {name}",
  "Open the shared Local VM desktop": "Отвори споделения Local VM десктоп",
  "this computer": "този компютър",
  "Waiting for the first frame…": "Чакане на първия кадър…",
  "Capturing the Local VM screen…": "Снимане на екрана на Local VM…",
  "No frames yet — the preview needs Screen Recording permission. After granting, relaunch the app.":
    "Още няма кадри — прегледът иска разрешение за запис на екрана. След разрешаване рестартирайте приложението.",
  "Capturing this computer's screen…": "Снимане на екрана на този компютър…",
  "Open Local VM setup": "Отвори настройката на Local VM",
  "Add a Box API key to give this bot a cloud computer — it spins up right here.":
    "Добавете Box API ключ, за да дадете на бота облачен компютър — той се вдига тук.",
  "Open desktop": "Отвори десктопа",
  "Put the computer to sleep": "Приспи компютъра",
  "Sleep": "Приспи",
  "Auto uses a cloud box when one exists, then this computer, then the prepared Local VM.":
    "Auto използва облачен box, ако има такъв, после този компютър, после подготвения Local VM.",
  "Auto uses a cloud box when one is configured, then the prepared Local VM; otherwise computer use stays off.":
    "Auto използва облачен box, ако е конфигуриран, после подготвения Local VM; иначе computer use остава изключен.",
  "Pick where this bot's computer lives.": "Изберете къде живее компютърът на този бот.",
  "is a Cua-controlled Linux desktop in a container on this machine — free and separate from your own desktop. Set it up in App Settings → Local VM.":
    "е Cua Linux десктоп в контейнер на тази машина — безплатен и отделен от вашия десктоп. Настройте го в App Settings → Local VM.",
  "Schedule work for {name}. Use its current setup, or run the whole job inside its cloud VM.":
    "Планирайте работа за {name}. Използвайте текущата настройка или пуснете цялата задача в облачния VM.",
  "Scheduled tasks on this computer will not have desktop access while this is Off. Choose Cloud VM in the schedule editor to run the whole job there.":
    "Планираните задачи на този компютър няма да имат достъп до десктопа, докато това е изключено. Изберете Cloud VM в редактора на графика, за да пуснете цялата задача там.",
  "Open schedules": "Отвори графиците",
  "Scheduled tasks": "Планирани задачи",
  "Select a detected binary…": "Изберете открит binary…",
  "Enter path manually…": "Въведете пътя ръчно…",
  "Test failed": "Тестът не успя",
  "Register this path anyway?": "Да се регистрира ли този път въпреки това?",
  "Test passed": "Тестът мина",
  "Save anyway": "Запази въпреки това",
  "Edit path": "Редактирай пътя",
  "Set CLI…": "Задай CLI…",
  "No CLI engines detected yet.": "Още не са открити CLI engine-и.",
  "Delete the Local VM? Files and browser sign-ins in its durable workspace will remain.":
    "Да се изтрие ли Local VM? Файловете и входовете в браузъра в трайния workspace ще останат.",
  "Replace the existing Local VM with the pinned image and safety limits? Files and browser sign-ins in its durable workspace will remain.":
    "Да се замени ли Local VM с фиксирания image и лимити за сигурност? Файловете и входовете в браузъра в трайния workspace ще останат.",
  "Status unavailable": "Статусът е недостъпен",
  "Not ready": "Не е готов",
  "Re-check": "Провери отново",
  "Open computer": "Отвори компютъра",
  "Install a container runtime": "Инсталирайте container runtime",
  "Podman and Colima are free. Docker Desktop may require a paid licence for larger companies and government use.":
    "Podman и Colima са безплатни. Docker Desktop може да изисква платен лиценз за по-големи компании и държавна употреба.",
  "Open the Podman installation guide": "Отвори ръководството за инсталация на Podman",
  "Open and start {runtime}": "Отвори и стартирай {runtime}",
  "Start the container runtime": "Стартирай container runtime",
  "Open the installed runtime and start its engine, then re-check.":
    "Отворете инсталирания runtime, стартирайте engine-а му и проверете отново.",
  "Prepare the Cua desktop (one-time download and build)": "Подгответе Cua десктопа (еднократно сваляне и build)",
  "Prepare Cua desktop": "Подготви Cua десктопа",
  "Show base-image download": "Покажи свалянето на base image",
  "Replace the older or unsafe VM": "Замени по-стария или несигурен VM",
  "Create and start the Local VM": "Създай и стартирай Local VM",
  "Delete and recreate": "Изтрий и създай наново",
  "Prepare the pinned Cua desktop above before replacing this VM.":
    "Подгответе фиксирания Cua десктоп по-горе, преди да замените този VM.",
  "Start Local VM": "Стартирай Local VM",
  "Waiting for the desktop…": "Чакане на десктопа…",
  "Create Local VM": "Създай Local VM",
  "Show command": "Покажи командата",
  "KodBot could not inspect the container runtime. Re-check, or review the app logs.":
    "KodBot не можа да провери container runtime. Проверете отново или прегледайте логовете.",
  "Delete VM": "Изтрий VM",
  "Durable workspace:": "Траен workspace:",
  "not created": "не е създаден",
  "Cua Driver:": "Cua Driver:",
  "Local image:": "Локален image:",
  "not prepared": "не е подготвен",
  "Sent to {name}.": "Изпратено до {name}.",
  "Couldn't start the recording": "Записът не можа да стартира",
  "Couldn't stop the recording": "Записът не можа да спре",
  "You and the bot share this desktop. Use it normally; ask the bot to take a screenshot when you want it to observe.":
    "Ти и ботът споделяте този десктоп. Използвай го нормално; поискай screenshot от бота, когато искаш да наблюдава.",
  "Stop and save the workflow recording": "Спри и запази записа на workflow-а",
  "Stop & save": "Спри и запази",
  "Record a workflow the bot can learn from": "Запиши workflow, от който ботът да се учи",
  "Record": "Запиши",
  "Exit full screen": "Изход от цял екран",
  "Full screen": "Цял екран",
  "Open in a new tab": "Отвори в нов таб",
  "Workflow saved.": "Workflow-ът е запазен.",
  "Analyze with {name}": "Анализирай с {name}",
  "Open a bot chat to analyze it.": "Отвори чат с бот, за да го анализира.",
  "Name this workflow": "Име на workflow-а",
  "The viewer records your clicks, keys, and periodic screenshots. The bot can turn them into a reusable workflow.":
    "Viewer-ът записва кликовете, клавишите и периодични screenshot-и. Ботът може да ги превърне в повтаряем workflow.",
  "Workflow name": "Име на workflow",
  "Start recording": "Стартирай записа",
  "Back to teams": "Назад към екипите",
  "{count} ready-to-load bots": "{count} бота, готови за зареждане",
  "Start with a complete team or bring your own.": "Започнете с готов екип или донесете свой.",
  "Open the community teams repository": "Отвори хранилището с общностни екипи",
  "Community repo": "Общностно хранилище",
  "Close teams": "Затвори екипите",
  "Team members": "Членове на екипа",
  "Replaces your {count} current {bots}. They'll be archived with conversations intact.":
    "Заменя текущите ви {count} {bots}. Те ще бъдат архивирани с разговорите си.",
  "bot": "бот",
  "Add alongside instead": "Добави до тях",
  "This team will be added alongside your current bots.": "Този екип ще бъде добавен до текущите ви ботове.",
  "Replace current team instead": "Замени текущия екип",
  "No room is created—you can make one later if you want.": "Не се създава стая — можете да създадете по-късно.",
  "Explore": "Разгледай",
  "Search teams": "Търси екипи",
  "Community teams": "Общностни екипи",
  "Loading teams…": "Зареждане на екипи…",
  "{bots} bots · {skills} playbooks": "{bots} бота · {skills} playbook-а",
  "Loading": "Зареждане",
  "Load": "Зареди",
  "No teams found": "Няма намерени екипи",
  "Bring your own team": "Донесете свой екип",
  "Choose a team file": "Изберете файл с екип",
  "or drop a .crewteam.json here": "или пуснете .crewteam.json тук",
  "Load from GitHub": "Зареди от GitHub",
  "Paste a public repo or a direct team JSON link.": "Поставете публично repo или директен линк към team JSON.",
  "GitHub team URL": "URL на екипа в GitHub",
  "Close the Inspector": "Затвори Inspector",
  "Knowledge": "Знание",
  "Shared knowledge": "Споделено знание",
  "One place for who you are, the mission, projects, skills, and the people around the work. Every bot gets the compact core each turn and can read the full topics from its workspace. Team books are visible only to that team.":
    "Едно място за това кой си, мисията, проектите, уменията и хората около работата. Всеки бот получава компактния core всеки ход и може да чете пълните теми от workspace-а си. Екипните книги се виждат само от този екип.",
  "Loading knowledge…": "Зареждане на знанието…",
  "Core": "Core",
  "Short and durable: owner, mission, active projects, skills, and preferences. This is sent with every turn.":
    "Кратко и трайно: собственик, мисия, активни проекти, умения и предпочитания. Изпраща се с всеки ход.",
  "Topics": "Теми",
  "Full notes a bot reads only when relevant: a project brief, a glossary, a family routine, a skill guide.":
    "Пълни бележки, които ботът чете само при нужда: brief за проект, речник, семейна рутина, ръководство за умение.",
  "Add topic": "Добави тема",
  "No topics yet. The core is enough to start.": "Още няма теми. Core-ът е достатъчен за начало.",
  "Topic title": "Заглавие на темата",
  "Remove topic": "Премахни темата",
  "The full text a bot reads on demand…": "Пълният текст, който ботът чете при нужда…",
  "Secrets never belong here. Knowledge is context, not permissions.":
    "Тайните никога не принадлежат тук. Знанието е контекст, не разрешения.",
  "Save knowledge": "Запази знанието",
  "Saved. The next turn picks it up.": "Запазено. Следващият ход ще го използва.",
  "Public changelog": "Публичен changelog",
  "Suggest routines": "Предлагай рутини",
  "After a finished multi-step turn, offer to save it as a paused routine. Off by default.":
    "След завършен ход с няколко стъпки предложи да се запази като рутина на пауза. Изключено по подразбиране.",
  "After a finished multi-step turn, offer to save it as a paused routine. Off by default; a bot can override this in its own settings.":
    "След завършен ход с няколко стъпки предложи да се запази като рутина на пауза. Изключено по подразбиране; ботът може да го промени в своите настройки.",
  "Routine offers are on by default.": "Предложенията за рутини са включени по подразбиране.",
  "Routine offers are off by default.": "Предложенията за рутини са изключени по подразбиране.",
  "Use app default": "Използвай настройката на приложението",
  "Daily limits": "Дневни лимити",
  "Hard caps for this bot. Empty or 0 = off; the running turn always finishes.":
    "Твърди лимити за този бот. Празно или 0 = изключено; текущият ход винаги завършва.",
  "Today: {tokens} tokens · {cost}": "Днес: {tokens} токена · {cost}",
  "Tokens / day": "Токени / ден",
  "USD / day": "USD / ден",
  "Monthly limits": "Месечни лимити",
  "Hard caps for the whole app. Empty or 0 = off; the running turn always finishes.":
    "Твърди лимити за цялото приложение. Празно или 0 = изключено; текущият ход винаги завършва.",
  "This month: {tokens} tokens · {cost}": "Този месец: {tokens} токена · {cost}",
  "Tokens / month": "Токени / месец",
  "USD / month": "USD / месец",
  "After a finished multi-step turn, offer to save it as a paused routine. Off by default; follows the app setting unless changed here.":
    "След завършен ход с няколко стъпки предложи да се запази като рутина на пауза. Изключено по подразбиране; следва настройката на приложението, освен ако не се промени тук.",
  "That team no longer exists.": "Този екип вече не съществува.",
  "Save to knowledge": "Запази в знанието",
  "Save this to shared knowledge?": "Да се запази ли в споделеното знание?",
  "A person decides what becomes durable company or team knowledge. Secrets never belong here.":
    "Човек решава кое става трайно знание за компанията или екипа. Тайните никога не принадлежат тук.",
  "Off keeps this bot's cloud computer private. On, teammates use the same machine and browser logins.":
    "Изключено пази облачния компютър на този бот личен. Включено значи, че съотборниците ползват същата машина и същите входове в браузъра.",

  // Admin (gateway owner only)
  "Admin": "Админ",
  "Owner-only controls for the hosted KodBot gateway. Members never see these screens.":
    "Контроли само за собственика на hosted KodBot gateway. Членовете никога не виждат тези екрани.",
  "Signed in as the owner.": "Влязъл си като собственик.",
  "Temporary password": "Временна парола",
  "Share it with {email} once, then ask them to change it.":
    "Дай я на {email} веднъж и после го помоли да я смени.",
  "Invite code": "Код за покана",
  "Send this to {email} or to the person you want to invite.":
    "Изпрати това на {email} или на човека, когото искаш да поканиш.",
  "the invited person": "поканения човек",
  "Expires {when}.": "Изтича на {when}.",
  "Users": "Потребители",
  "Accounts on this gateway. Only the owner can administer them.":
    "Акаунти в този gateway. Само собственикът може да ги управлява.",
  "Created {when}": "Създаден на {when}",
  "Reset password": "Нулирай парола",
  "Sign out sessions": "Изход от сесиите",
  "Invites": "Покани",
  "KodBot is invite-only. Create a one-time code; it is shown once.":
    "KodBot е само с покани. Създай еднократен код; показва се веднъж.",
  "Email (optional)": "Имейл (по избор)",
  "any email": "всеки имейл",
  "Days": "Дни",
  "Create invite": "Създай покана",
  "Pending invites": "Чакащи покани",
  "No pending invites.": "Няма чакащи покани.",
  "Any email": "Всеки имейл",
  "Expires {when}": "Изтича на {when}",
  "Revoke": "Отмени",
  "Disable": "Изключи",
  "Disable {email}? Their sessions will be signed out.":
    "Да се изключи ли {email}? Сесиите му ще бъдат прекратени.",
  "Sign out every session for {email}?": "Да се прекратят ли всички сесии на {email}?",
  "Sessions signed out for {email}.": "Сесиите на {email} са прекратени.",
  "Revoke this invite?": "Да се отмени ли тази покана?",
  "Resetting the owner password signs out this session too. Continue?":
    "Нулирането на паролата на собственика ще прекрати и тази сесия. Да продължа ли?",

  // KodBot Solo / Business
  "How will you use KodBot?": "Как ще използваш KodBot?",
  "Choose now. You can change this later in App Settings → General → Usage mode.":
    "Избери сега. Можеш да го промениш по-късно в Настройки на приложението → Общи → Режим на използване.",
  "KodBot Solo": "KodBot Solo",
  "KodBot Business": "KodBot Business",
  "Local, private, no account.": "Локално, поверително, без акаунт.",
  "Everything stays on this computer: bots, conversations, memory, files, and keys. KodBot runs its own server here.":
    "Всичко остава на този компютър: ботове, разговори, памет, файлове и ключове. KodBot пуска собствения си сървър тук.",
  "Your keys never leave this machine.": "Ключовете ти никога не напускат тази машина.",
  "Preparing this computer…": "Подготовка на този компютър…",
  "For organizations": "За организации",
  "Accounts, invitations, administration.": "Акаунти, покани, администриране.",
  "Connect to your organization's KodBot server and sign in with your browser. Your bots, keys, and memory stay in your own workspace on that server.":
    "Свържи се със сървъра на KodBot на твоята организация и влез през браузъра. Ботовете, ключовете и паметта ти остават в твоето работно пространство на този сървър.",
  "KodBot Solo is free and open source. KodBot Business is the same app connected to your organization's server, with accounts and administration.":
    "KodBot Solo е безплатен и с отворен код. KodBot Business е същото приложение, свързано със сървъра на организацията, с акаунти и администриране.",
  "Shared bots, shared teams.": "Споделени ботове, споделени екипи.",
  "Connect to your organization's KodBot server and sign in with your browser. Bots and teams are shared there, and each person uses their own key or the organization's.":
    "Свържи се със сървъра на KodBot на твоята организация и влез през браузъра. Ботовете и екипите са споделени там, а всеки използва своя ключ или ключа на организацията.",
  "Organization server address": "Адрес на сървъра на организацията",
  "Continue to sign-in": "Продължи към вход",
  "Enter the organization server address.": "Въведи адреса на сървъра на организацията.",
  "Enter an address like https://kodbot.example.com or http://192.168.1.50:8780.":
    "Въведи адрес като https://kodbot.example.com или http://192.168.1.50:8780.",
  "The server must already be running KodBot Business. A personal server without accounts keeps you in Solo.":
    "Сървърът трябва вече да работи с KodBot Business. Личен сървър без акаунти те оставя в Solo.",
  "KodBot Solo is free and open source. KodBot Business is the same app connected to your organization's server; it adds shared teams, administration, and organization billing.":
    "KodBot Solo е безплатен и с отворен код. KodBot Business е същото приложение, свързано със сървъра на организацията; добавя споделени екипи, администриране и фактуриране за организацията.",
  "Usage mode": "Режим на използване",
  "KodBot Solo is free, local and private. KodBot Business connects to your organization's server.":
    "KodBot Solo е безплатен, локален и поверителен. KodBot Business се свързва със сървъра на твоята организация.",
  "Using your own server at {url}.": "Използваш собствения си сървър на {url}.",
  "Using the server at {origin}.": "Използваш сървъра на {origin}.",
  "Signed in on your organization's server at {origin}.":
    "Влязъл си в сървъра на организацията на {origin}.",
  "Connect to server": "Свържи се със сървър",
  "Use this computer (Solo)": "Използвай този компютър (Solo)",
  "An organization server signs you in with your browser. A personal server without accounts stays Solo. The app will restart when you switch.":
    "Сървърът на организацията те вписва през браузъра. Личен сървър без акаунти остава Solo. Приложението ще се рестартира при смяна.",
  "To switch to KodBot Solo, open the app on your computer.":
    "За да преминеш към KodBot Solo, отвори приложението на своя компютър.",
  "Connecting moves this window to that server. An organization gateway shows its sign-in page; a personal server stays Solo.":
    "Свързването премества този прозорец на онзи сървър. Организационният gateway показва своята страница за вход; личният сървър остава Solo.",

  // Shared bots (KodBot Business)
  "Shared bots": "Споделени ботове",
  "Publish a bot for the organization. Each member who installs it gets their own copy; turns run in their workspace with their own key.":
    "Публикувай бот за организацията. Всеки член, който го инсталира, получава свое копие; ходовете се изпълняват в неговото работно пространство с неговия ключ.",
  "Bot to publish": "Бот за публикуване",
  "Publishing…": "Публикуване…",
  "Publish to organization": "Публикувай за организацията",
  "Show queued messages": "Покажи чакащите съобщения",
  "Hide queued messages": "Скрий чакащите съобщения",
  "Only the name, title, description, and MEMORY.md are shared. Common secrets are redacted; review the memory before publishing.":
    "Споделят се само името, заглавието, описанието и MEMORY.md. Разпознаваемите тайни се редактират; прегледай паметта преди публикуване.",
  "Every member of the organization can see and install a shared bot.":
    "Всеки член на организацията може да види и инсталира споделен бот.",
  "Install a shared bot to get your own copy in this workspace.":
    "Инсталирай споделен бот, за да получиш свое копие в това работно пространство.",
  "Published bots": "Публикувани ботове",
  "A published bot stores the persona and redacted core memory. Installed copies are independent.":
    "Публикуваният бот пази персоната и редактираната основна памет. Инсталираните копия са независими.",
  "No shared bots yet.": "Още няма споделени ботове.",
  "Published {when}": "Публикуван на {when}",
  "Adding…": "Добавяне…",
  "Add to my workspace": "Добави в моето пространство",
  "Remove shared bot": "Премахни споделения бот",
  "Remove {name} from shared bots? Copies already installed stay in their workspaces.":
    "Да се премахне ли {name} от споделените ботове? Вече инсталираните копия остават в техните пространства.",
  "Published {name}. Every member of the organization can install a copy.":
    "Публикуван е {name}. Всеки член на организацията може да инсталира копие.",
  "{name} was added to your workspace. It runs here, with your key and quota.":
    "{name} е добавен в твоето пространство. Работи тук, с твоя ключ и лимити.",
};

function initialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "bg") return saved;
  } catch {
    /* private browsing can deny storage; the OS language still works */
  }
  const languages = window.navigator.languages?.length
    ? window.navigator.languages
    : [window.navigator.language];
  return languages.some((language) => language.toLowerCase().split("-")[0] === "bg") ? "bg" : "en";
}

/** Whether the Bulgarian dictionary carries an entry for this source string. */
export function hasBulgarianTranslation(source: string): boolean {
  return Object.hasOwn(BULGARIAN, source);
}

/** Pure translation, exported so it can be tested without a DOM. */
export function translate(source: string, locale: Locale, vars?: Record<string, string | number>): string {
  let text = locale === "bg" ? (BULGARIAN[source] ?? source) : source;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (source: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* the in-memory choice still applies for this session */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (source: string, vars?: Record<string, string | number>) => translate(source, locale, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
