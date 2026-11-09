/** The bilingual user guide. One source for the in-app help panel and the
 * exported docs; keep every section short enough to scan. */

export type GuideLocale = "en" | "bg";

export interface GuideSection {
  id: string;
  title: { en: string; bg: string };
  body: { en: string; bg: string };
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "start",
    title: { en: "Start here", bg: "Начало" },
    body: {
      en: `# Welcome to KodBot

KodBot is a local-first chat app for running a team of AI agents on your own computer or on a server you control.

- A **bot** is an agent with its own name, role, model, memory, working folder, and computer.
- A **room** is a conversation with several bots; a **team** groups bots and can have a leader.
- Chats, settings, and data stay in \`~/.kodbot\` on the machine that runs the harness.
- Use the sidebar to switch between chats, rooms, and **Automations**.
- The same guide is available to your bots as \`KODBOT-GUIDE.md\` in their workspace. Ask a bot how to do something and it can read the exact steps.

The rest of this guide is organized by topic.`,
      bg: `# Добре дошли в KodBot

KodBot е local-first chat приложение за екип от AI агенти на твоя компютър или на сървър, който контролираш.

- **Бот** е агент със свое име, роля, модел, памет, работна папка и компютър.
- **Стая** е разговор с няколко бота; **екип** групира ботове и може да има лидер.
- Чатовете, настройките и данните стоят в \`~/.kodbot\` на машината, която пуска harness-а.
- От страничната лента сменяш чатове, стаи и **Automations**.
- Същото ръководство е достъпно за ботовете като \`KODBOT-GUIDE.md\` в работната им папка. Попитай бот как се прави нещо и той може да прочете точните стъпки.

Останалата част от ръководството е подредена по теми.`,
    },
  },
  {
    id: "chats",
    title: { en: "Bots, models and chats", bg: "Ботове, модели и чатове" },
    body: {
      en: `## Bots, models and chats

- Create a bot with **+ → New Bot**. Open **Bot settings** from its avatar to change the name, role, model, memory, working folder, voice, and notifications.
- The model picker in the chat header chooses the engine/model for new turns. **Auto** picks from the bot's model pool.
- **Enter** sends; **Shift+Enter** adds a line.
- **Ctrl+Enter** while the bot is busy puts the prompt in the floating queue above the composer. It sends one prompt after the current turn finishes; you can discard an item.
- **Stop** interrupts the running turn. Editing your own message rewinds the conversation and keeps the old version as a branch.
- **Reply** (arrow on a message) quotes that message. The bot receives the quoted excerpt, so it knows which answer you mean.`,
      bg: `## Ботове, модели и чатове

- Създай бот с **+ → New Bot**. Отвори **Bot settings** от аватара му, за да смениш име, роля, модел, памет, работна папка, глас и известия.
- Изборът на модел в хедъра определя engine-а/модела за новите ходове. **Auto** избира от pool-а на бота.
- **Enter** изпраща; **Shift+Enter** добавя нов ред.
- **Ctrl+Enter**, докато ботът е зает, слага промпта в плаващата опашка над composer-а. Изпраща се по един след края на текущия ход; можеш да изхвърлиш елемент.
- **Stop** прекъсва текущия ход. Редакцията на твое съобщение връща разговора назад и пази старата версия като branch.
- **Reply** (стрелката на съобщение) цитира това съобщение. Ботът получава цитата и знае за кой отговор става дума.`,
    },
  },
  {
    id: "reactions",
    title: { en: "Emoji reactions", bg: "Емотикони" },
    body: {
      en: `## Emoji reactions

- Hover a message to see 👍 ❤️ 😂 🎉 👀. Click one to add it, click a chip again to remove it.
- Reactions are saved with the message and visible to everyone using the same account.
- **They are not sent to the bot and have no effect on its answers or behavior.** They are a human annotation, not a steering signal.
- If you need the bot to react or to treat something as important, say it in a normal message.`,
      bg: `## Емотикони

- Задръж върху съобщение, за да видиш 👍 ❤️ 😂 🎉 👀. Клик добавя реакция; клик върху chip-а я маха.
- Реакциите се пазят към съобщението и се виждат от всички с този акаунт.
- **Не се изпращат към бота и не влияят на отговорите или поведението му.** Това е човешка анотация, не сигнал за управление.
- Ако искаш ботът да реагира или да приеме нещо за важно, кажи го в нормално съобщение.`,
    },
  },
  {
    id: "tasks",
    title: { en: "Tasks and branches", bg: "Задачи и разклонения" },
    body: {
      en: `## Tasks and branches

- A **task** is a separate conversation with its own context, provider session, working folder, and token usage. The bot's identity, model, memory, and workspace stay the same.
- The **Task** chip in the header appears when a bot has more than one task. Click it to switch, double-click a name to rename, and use the trash icon to delete (the bot keeps at least one).
- **New task** starts a clean context for a new job; it does not delete the old conversation.
- Routines and webhooks run in **detached tasks**, so unattended work does not mix with your main chat.
- Branches (‹ 2/3 ›) are versions inside one task. Switching a branch does not switch tasks.
- A running turn stays on its task; switching tasks does not stop it.`,
      bg: `## Задачи и разклонения

- **Задача** е отделен разговор със свой контекст, provider сесия, работна папка и изразходвани токени. Самоличността, моделът, паметта и workspace-ът на бота остават същите.
- Chip-ът **Task** в хедъра се появява, когато ботът има повече от една задача. Клик сменя, двойно кликване преименува, кошчето трие (ботът пази поне една).
- **New task** започва чист контекст за нова работа; старият разговор не се трие.
- Автоматизациите и webhook-овете работят в **отделни задачи**, така че фоновата работа не се смесва с основния чат.
- Разклоненията (‹ 2/3 ›) са версии в една задача. Смяната на branch не сменя задачата.
- Текущият ход остава в своята задача; смяната на задача не го спира.`,
    },
  },
  {
    id: "computer",
    title: { en: "The bot's computer", bg: "Компютърът на бота" },
    body: {
      en: `## The bot's computer

- A bot can use a real desktop through its computer tools: a cloud box, the shared **Local VM** on the machine running KodBot, or the local computer (desktop app only; the Linux harness does not expose its own desktop).
- **Auto** picks a configured cloud box first, then this computer when available, then the prepared Local VM. Choose an explicit destination in Bot settings → Computer when a bot must not fall back.
- The Local VM is a Cua Linux desktop in Docker or Podman. Only \`/home/cua/workspace\` is durable; save downloads, repositories, and browser profiles there. Set it up once in App Settings → Local VM. Chromium and Firefox are installed for real browser work.
- **Open computer** in App Settings → Local VM (or the Computer panel) opens the shared desktop in a full-window view with a **Full screen** button. You can click, type, and scroll directly; the bot sees the same screen and can take over or observe with a screenshot.
- The prepared image and workspace survive container recreation. Bots can run normal tasks in parallel; only their desktop actions take turns, and a bot that needs the screen waits at its first computer tool call.
- Use **Watch screen** in App Settings → Local VM, or ask the bot for a screenshot, to see what it is doing.`,
      bg: `## Компютърът на бота

- Ботът може да използва реален десктоп чрез computer инструментите: cloud box, споделената **Local VM** на машината с KodBot, или локалния компютър (само desktop app; Linux harness-ът не дава собствения си десктоп).
- **Auto** избира първо конфигуриран cloud box, после този компютър, ако е наличен, и накрая подготвената Local VM. Избери конкретна дестинация в Bot settings → Computer, ако ботът не трябва да пада към друга.
- Local VM е Cua Linux десктоп в Docker или Podman. Само \`/home/cua/workspace\` е трайна; пази изтеглянията, repository-тата и browser профилите там. Настройва се веднъж от App Settings → Local VM. Chromium и Firefox са инсталирани за реална browser работа.
- **Open computer** от App Settings → Local VM (или Computer панела) отваря споделения десктоп в прозорец на цял екран с бутон **Full screen**. Можеш да кликаш, пишеш и скролваш директно; ботът вижда същия екран и може да поеме или да наблюдава със screenshot.
- Подготвеният image и workspace-ът оцеляват при пресъздаване на контейнера. Ботовете могат да изпълняват обикновени задачи паралелно; само действията им по десктопа се редуват, а ботът, който има нужда от екрана, изчаква при първото computer действие.
- Използвай **Watch screen** в App Settings → Local VM или поискай screenshot от бота, за да видиш какво прави.`,
    },
  },
  {
    id: "approvals",
    title: { en: "Approvals and safety", bg: "Одобрения и безопасност" },
    body: {
      en: `## Approvals and safety

- A bot can ask before a risky command, file change, or external action. The card takes over the composer: **Allow**, **Deny**, or **Always allow** the narrow action.
- Each permission card includes a plain-language **What this means** explanation, a **Why it needs approval** risk note, the task context, and then the exact command, path, recipient, or amount.
- App Settings → General → **Approval timeout** controls when an unanswered card is marked overdue. It never denies automatically; a late **Allow** still lets the bot finish the work. The same timer covers a bot asking permission to contact another bot. Choose **Wait until I answer** to remove the timer.
- Auto mode can answer routine requests; destructive actions still stop and ask.
- **Stop** rejects the pending action. A stopped turn does not run queued follow-ups.`,
      bg: `## Одобрения и безопасност

- Ботът може да пита преди рискова команда, промяна на файл или външно действие. Картата заема composer-а: **Allow**, **Deny** или **Always allow** за конкретното действие.
- Auto mode отговаря на рутинните заявки; destructive действията пак спират и питат.
- **Stop** отказва чакащото действие. Спрян ход не изпълнява следващите на опашката.
- Прочети точната команда, път, получател или сума на картата, преди да разрешиш.`,
    },
  },
  {
    id: "rooms",
    title: { en: "Rooms and teams", bg: "Стаи и екипи" },
    body: {
      en: `## Rooms and teams

- A **room** is a group chat with several bots. Use **@Name** to address a member; without a mention the room's default responder answers.
- **@everyone** asks all members; replies are sequential so the transcript stays coherent.
- A **team** groups bots and can have a leader; the team view opens its room.
- When a bot hands work to another bot, the result appears as a card in the original chat; the full exchange is in the **A ⇄ B** room.
- The room header shows the shared working folder (developer mode) and the default responder.`,
      bg: `## Стаи и екипи

- **Стая** е групов чат с няколко бота. Използвай **@Име**, за да се обърнеш към член; без mention отговаря default responder-ът на стаята.
- **@everyone** пита всички; отговорите са последователни, за да остане transcript-ът подреден.
- **Екип** групира ботове и може да има лидер; изгледът на екипа отваря стаята му.
- Хедърът на стаята показва споделената работна папка (в developer mode) и default responder-а.`,
    },
  },
  {
    id: "automations",
    title: { en: "Automations", bg: "Автоматизации" },
    body: {
      en: `## Automations

- **Automations** schedules work for a bot. Open it from the sidebar.
- **Once**: a date and time. **Daily**: a time and weekdays. **Interval**: every 5–720 minutes, optionally only between two times (for example 09:00–18:00) and on chosen weekdays.
- Interval slots are wall-clock anchored: 09:00, 09:15, 09:30… A slow turn never stacks runs; the next slot waits for it.
- Every run creates a separate task with its own result; the calendar shows the schedule and the latest receipts.
- A routine task is marked **Scheduled** in the task picker, so it is not confused with a chat you started.
- **Activity** (sidebar) collects scheduled, webhook, delegated, and live jobs with status, bot, result, and error.
- A run that fails or is missed raises a notification and stays in the **needs you** strip until you open it.
- Pause/resume a schedule, or open a run to see its output. Webhooks are the event-driven sibling.`,
      bg: `## Автоматизации

- **Automations** планира работа за бот. Отваря се от страничната лента.
- **Once**: дата и час. **Daily**: час и дни. **Interval**: на всеки 5–720 минути, по желание само между два часа (например 09:00–18:00) и в избрани дни.
- Интервалите са вързани за wall-clock: 09:00, 09:15, 09:30… Бавен ход не трупа опашка; следващият слот го изчаква.
- Всеки run създава отделна задача с резултат; календарът показва графика и последните разписки.
- Задача от routine е маркирана като **Scheduled** в task picker-а, за да не се бърка с чат, който си започнал.
- **Activity** (страничната лента) събира scheduled, webhook, delegated и live задачи със статус, бот, резултат и грешка.
- Run, който е failed или missed, вдига известие и остава в лентата **needs you**, докато не го отвориш.
- Можеш да паузираш/пуснеш графика или да отвориш run, за да видиш изхода. Webhooks са event-driven варианта.`,
    },
  },
  {
    id: "pages",
    title: { en: "Pages", bg: "Страници" },
    body: {
      en: `## Pages

- A bot can write a self-contained HTML page (dashboard, checklist, report) into its workspace.
- Pages appear as a card in the chat; click to open the in-app viewer, or the icon to open it in your browser.
- The bot receives the page title, path, and a bounded excerpt in its context.
- A page can submit a form back to its bot: the answer arrives as a user message and the viewer closes.
- Pages are sandboxed: they cannot read the chat, credentials, or your files.`,
      bg: `## Страници

- Ботът може да напише самостоятелна HTML страница (dashboard, checklist, report) в workspace-а си.
- Страниците се показват като карта в чата; клик отваря вградената визия, а иконата — в браузъра.
- Ботът получава заглавие, път и ограничен откъс от страницата в контекста си.
- Страницата може да изпрати формуляр обратно към бота: отговорът пристига като user съобщение и визията се затваря.
- Страниците са sandbox-нати: не могат да четат чата, ключовете или файловете ти.`,
    },
  },
  {
    id: "notifications",
    title: { en: "Notifications", bg: "Известия" },
    body: {
      en: `## Notifications

- A bot that needs you — an approval or a question — raises a native desktop notification and a persistent **needs you** strip at the top.
- A scheduled run that fails or is missed also raises a notification and stays in the strip until you open it.
- A finished reply notifies when you are in another chat or the window is in the background.
- Click a notification to open the bot or room that asked.
- The per-bot **Notifications** switch (Bot settings → Notifications) gates its notifications.
- The app title and badge count blocked chats; the strip stays until the request is resolved.`,
      bg: `## Известия

- Бот, който има нужда от теб — approval или въпрос — вдига native desktop известие и постоянна лента **needs you** горе.
- Планиран run, който е failed или missed, също вдига известие и остава в лентата, докато не го отвориш.
- Готов отговор извести когато си в друг чат или прозорецът е във фон.
- Клик върху известие отваря бота или стаята, която пита.
- Превключвателят **Notifications** за всеки бот (Bot settings → Notifications) управлява неговите известия.
- Заглавието и badge-ът броят блокираните чатове; лентата стои, докато заявката не се реши.`,
    },
  },
  {
    id: "connected",
    title: { en: "Connected apps", bg: "Свързани приложения" },
    body: {
      en: `## Connected apps

- **Connected apps** (sidebar → puzzle icon) connects Gmail, Google Drive, Slack, GitHub, Notion, and many others through Composio.
- With the managed service, keys stay on the server; the self-hosted option uses your own Composio API key.
- Click **Connect**, name the connection (for example “Work Gmail”), then complete the provider page in your browser. If the browser does not open, use **Copy link** next to “Finish setup in your browser” and paste it into a browser.
- **Google Search Console** is available in the marketplace for search-performance, URL-inspection, and sitemap tools.
- Open **Details** to see accounts, rename them, remove one account, or disconnect the app. Expired accounts stay listed until you remove them.
- The panel checks the whole catalog, not only the featured apps, so a connected app appears under **Connected** even when it is far down the marketplace.
- A bot only gets the apps you granted it (Bot settings → Connected apps). If a bot says it has no access, open **Connected apps** and use **Allow for all bots**, or turn the app access on for that bot individually. Bots are told about this switch, so they will point you to the exact place instead of claiming the app is not connected.`,
      bg: `## Свързани приложения

- **Connected apps** (странична лента → иконата puzzle) свързва Gmail, Google Drive, Slack, GitHub, Notion и много други през Composio.
- При managed услугата ключовете стоят на сървъра; self-hosted варианта ползва твоя Composio API ключ.
- Натисни **Connect**, дай име на връзката (например „Work Gmail“) и след това завърши страницата на доставчика в браузъра. Ако браузърът не се отвори, използвай **Copy link** до „Finish setup in your browser“ и го постави в браузър.
- **Google Search Console** е налична в пазара за search-performance, URL inspection и sitemap инструменти.
- Отвори **Details**, за да видиш акаунтите, да ги преименуваш, да махнеш акаунт или да disconnect-неш приложението. Изтеклите акаунти остават в списъка, докато не ги премахнеш.
- Панелът проверява целия каталог, не само препоръчаните приложения, така че свързано приложение се показва в **Connected** дори когато е далеч надолу в пазара.
- Ботът получава само приложенията, които си му разрешил (Bot settings → Connected apps). Ако бот каже, че няма достъп, отвори **Connected apps** и използвай **Allow for all bots**, или включи достъпа за конкретния бот поотделно. Ботовете знаят за този превключвател и ще те насочат точно където трябва, вместо да твърдят, че приложението не е свързано.`,
    },
  },
  {
    id: "server",
    title: { en: "Server and remote mode", bg: "Сървър и отдалечен режим" },
    body: {
      en: `## Server and remote mode

- By default the desktop app runs a local harness. **Settings → General → Server** lets it use a server that stays on 24/7.
- The app checks \`/api/health\` and \`/api/bots\` before switching; a port that only answers health (the phone companion) is rejected.
- Switching restarts the app. Keys, chats, engines, and the companion stay on the server.
- The **Updates** row checks the release feed; **Ctrl+Shift+R** reloads the UI after a server update.`,
      bg: `## Сървър и отдалечен режим

- По подразбиране десктоп app-ът пуска локален harness. **Settings → General → Server** позволява сървър, който работи 24/7.
- App-ът проверява \`/api/health\` и \`/api/bots\` преди смяна; порт, който отговаря само на health (телефонният companion), се отхвърля.
- Смяната рестартира app-а. Ключовете, чатовете, engine-ите и companion-ът остават на сървъра.
- Редът **Updates** проверява release feed-а; **Ctrl+Shift+R** презарежда UI-а след сървърно обновяване.`,
    },
  },
  {
    id: "companion",
    title: { en: "Phone companion", bg: "Телефонен companion" },
    body: {
      en: `## Phone companion and Android

- The companion lets a paired phone reach the harness. The harness listens on 8799; the companion's device API is 8810 and its local pairing page is 8811.
- In **Settings → Companion**, open a one-time pairing window and enter the address shown on the phone.
- Paired devices are stored on the harness; revoke one from the same panel.
- Never expose 8810 publicly without the device token; the pairing code is single-use.`,
      bg: `## Телефонен companion и Android

- Companion-ът позволява на сдвоен телефон да достига harness-а. Harness-ът слуша на 8799; device API-то на companion-а е 8810, а локалната pairing страница — 8811.
- В **Settings → Companion** отвори еднократен pairing прозорец и въведи адреса, който телефонът показва.
- Сдвоените устройства се пазят на harness-а; махни устройство от същия панел.
- Не излагай 8810 публично без device token; pairing кодът е еднократен.`,
    },
  },
  {
    id: "data",
    title: { en: "Data, backups and recovery", bg: "Данни, backup и възстановяване" },
    body: {
      en: `## Data, backups and recovery

- State lives in \`~/.kodbot\`: \`bots.json\`, \`teams.json\`, \`groups.json\`, \`routines.json\`, \`config.json\`, \`webhooks.json\`, and \`messages.db\`.
- Automatic hot snapshots run every 15 minutes and keep the newest 2 (about 30 minutes); the daily full archive keeps 2 days, and 2 offsite copies are kept, one per day.
- If the disk fills, SQLite cannot write and the harness stops; free space and restart the service. The app shows no data while the harness is down — the files are still there.
- Use **Settings → General → Updates** for app updates; the harness and UI update separately.`,
      bg: `## Данни, backup и възстановяване

- Състоянието е в \`~/.kodbot\`: \`bots.json\`, \`teams.json\`, \`groups.json\`, \`routines.json\`, \`config.json\`, \`webhooks.json\` и \`messages.db\`.
- Автоматичните hot snapshot-и вървят на всеки 15 минути и пазят последните 2 (около 30 минути); дневният full архив пази 2 дни, а offsite копията са 2, по едно на ден.
- Ако дискът се напълни, SQLite не може да пише и harness-ът спира; освободи място и рестартирай услугата. App-ът не показва данни, докато harness-ът е спрян — файловете са там.
- Използвай **Settings → General → Updates** за обновяване на app-а; harness-ът и UI-ът се обновяват отделно.`,
    },
  },
  {
    id: "developer",
    title: { en: "Developer mode", bg: "Режим за разработчици" },
    body: {
      en: `## Developer mode

- **Settings → General → Developer mode** shows technical surfaces: per-turn token counts, API keys in Connections, working-folder chips/cards, and the Inspector.
- Off (the default) keeps the interface clean; turn it on when you need to inspect a driver, manage keys, or change a working folder.
- The Inspector shows runtime events and the raw provider protocol for the current thread.
- The setting is local to this window and remembered between restarts.`,
      bg: `## Режим за разработчици

- **Settings → General → Developer mode** показва техническите повърхности: броячи на токени, API ключове в Connections, чипове/карти за работната папка и Inspector.
- Изключен (по подразбиране) пази интерфейса чист; включи го, когато трябва да инспектираш driver, да управляваш ключове или да смениш работна папка.
- Inspector показва runtime събитията и суровия provider протокол за текущия thread.
- Настройката е локална за този прозорец и се помни между рестарти.`,
    },
  },
  {
    id: "shortcuts",
    title: { en: "Keyboard shortcuts", bg: "Клавишни комбинации" },
    body: {
      en: `## Keyboard shortcuts

- **Enter** send · **Shift+Enter** newline · **Ctrl+Enter** queue while busy.
- **Ctrl+K** command palette · **Ctrl+N** new bot · **Ctrl+1…9** jump to a bot · **Ctrl+Shift+[ / ]** previous/next bot.
- **Ctrl+R** reload · **Ctrl+Shift+R** force reload · **Ctrl+Shift+I** developer tools (desktop).
- **Esc** closes the top panel or menu.`,
      bg: `## Клавишни комбинации

- **Enter** изпраща · **Shift+Enter** нов ред · **Ctrl+Enter** слага на опашка, докато ботът е зает.
- **Ctrl+K** command palette · **Ctrl+N** нов бот · **Ctrl+1…9** скок към бот · **Ctrl+Shift+[ / ]** предишен/следващ бот.
- **Ctrl+R** reload · **Ctrl+Shift+R** force reload · **Ctrl+Shift+I** developer tools (десктоп).
- **Esc** затваря панела или менюто отгоре.`,
    },
  },
  {
    id: "troubleshooting",
    title: { en: "Troubleshooting", bg: "Проблеми" },
    body: {
      en: `## Troubleshooting

- **Nothing happens when I click Connect or open a link:** the browser may have failed to launch. Use **Copy link** and paste it into Firefox/Chromium. On Linux, launch KodBot from the desktop, not from a restricted terminal.
- **Copied text pastes nothing:** update to 0.1.38+; the app uses the desktop clipboard bridge and only shows a check after a real copy.
- **Notifications are missing:** check the bot's Notifications switch and the system notification permission; the needs-you strip is the in-app fallback.
- **No bots/teams/messages after a restart:** the harness may be down or the disk full. Check the server, free space, and restart. The data is in \`~/.kodbot\`.
- **A page does not send answers:** open it in KodBot (not a browser tab), then submit; the viewer closes on success.`,
      bg: `## Проблеми

- **Нищо не се случва при Connect или отваряне на линк:** браузърът може да не се е стартирал. Използвай **Copy link** и го постави във Firefox/Chromium. На Linux стартирай KodBot от десктопа, не от ограничен терминал.
- **Копиран текст не се поставя:** обнови до 0.1.38+; app-ът ползва desktop clipboard bridge и показва чекмарка само след реално копиране.
- **Липсват известия:** провери Notifications превключвателя на бота и системното разрешение; needs-you лентата е вградената резерва.
- **Няма ботове/екипи/съобщения след рестарт:** harness-ът може да е спрян или дискът пълен. Провери сървъра, освободи място и рестартирай. Данните са в \`~/.kodbot\`.
- **Страница не изпраща отговори:** отвори я в KodBot (не в browser tab) и я изпрати; визията се затваря при успех.`,
    },
  },
];
