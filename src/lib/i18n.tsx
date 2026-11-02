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
  "Nothing matches “{query}”": "Няма съвпадения за „{query}“",
  "Automations": "Автоматизации",
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
  "Close connected apps": "Затвори свързаните приложения",
  "Connected apps view": "Изглед на свързаните приложения",
  "Marketplace": "Пазар",
  "Connected tab": "Свързани",
  "Search apps": "Търсене на приложения",
  "Connected apps are temporarily unavailable. You can retry after restarting, or configure your own connection service.":
    "Свързаните приложения временно не са достъпни. Можете да опитате отново след рестартиране или да настроите собствена услуга за връзки.",
  "Open settings": "Отвори настройките",
  "Showing featured apps.": "Показват се препоръчани приложения.",
  "Update your Composio key": "Актуализирайте ключа си за Composio",
  "for the full catalog.": "за пълния каталог.",
  "Loading catalog…": "Зареждане на каталога…",
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
  // Auto model
  "Auto model": "Автоматичен модел",
  "Pick the best available model for each task. Complex work gets the strongest engine; short requests get the fastest one.":
    "Избира най-добрия наличен модел за всяка задача. Сложната работа получава най-силния двигател; кратките заявки — най-бързия.",
  "The picker shows the last routed model; the next task is routed again.":
    "Изборът показва последния използван модел; следващата задача се маршрутизира отново.",
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
  "Each row is one connected account. Active means KodBot can use it. Expired means the sign-in has ended — remove that row, then connect the account again. Waiting for sign-in means the Google page is still open or unfinished. When the address is hidden, Google will reveal it after the account is active again.":
    "Всеки ред е един свързан акаунт. „Активен“ означава, че KodBot може да го използва. „Изтекъл“ означава, че входът е приключил — премахнете реда и свържете акаунта отново. „Чака вход“ означава, че страницата на Google е още отворена или незавършена. Когато адресът е скрит, Google ще го покаже, след като акаунтът отново стане активен.",
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
  "Labels are stored only in KodBot. Removing a row revokes KodBot's access to that connection; it does not delete the Google account.":
    "Етикетите се пазят само в KodBot. Премахването на ред отнема достъпа на KodBot до тази връзка; не изтрива Google акаунта.",
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
  "Move to team": "Премести в екип",
  "Team name": "Име на екипа",
  "Group bots in the sidebar": "Групирай ботовете в страничната лента",
  "Team": "Екип",
  "Ungrouped": "Без екип",
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
