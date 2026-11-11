# Jobs and Activity

Status: Phases 1–2 implemented on `feat/jobs-activity-phase2`; Phase 3 is design only.

## Problem

KodBot has four ways for work to happen, but no single answer to “what is
running, who owns it, and how did it end?”:

| Concept | Where it lives today | What the user sees |
| --- | --- | --- |
| Normal turn | Bot thread | The chat |
| Routine run | Detached bot task + `routineRuns` | Automations calendar only |
| Webhook run | Detached bot task + `routineRuns` | Automations → Webhooks |
| Delegation (`delegate_bot`) | Target bot thread + auto-created `A ⇄ B` channel | A chip in the source chat, the reply only in the channel |

The result is three overlapping surfaces — TaskPicker, Automations, and
auto-created channels — and several terminal states that are easy to miss.

Concrete gaps found in the current code:

- `server/notify.ts` defines `routine-failed`, but no producer calls it.
- `RoutineManager` broadcasts `routine.run` frames; the UI only surfaces
  failures inside Automations. A failed, missed, or restart-interrupted run
  does not raise a desktop notification.
- Scheduled runs create a task with `activate = false`, so they never become
  the bot’s visible chat. The run stores only the last assistant text and an
  error string; the full transcript is in a task the user has to find.
- A run can wait indefinitely behind a busy bot. It is marked `missed` only
  after the process was offline for more than 12 hours. Neither state notifies.
- `delegate_bot` is fire-and-forget. The source chat gets “Delegated to @B”,
  but the target’s reply is mirrored only into the automatically created
  `A ⇄ B` channel. The source bot does not receive the result, and the source
  chat does not show it.
- The in-app “needs you” strip covers approvals and questions only.
- Routine times use the harness machine’s local timezone. There is no timezone
  on the routine and no indication in the UI which clock is being used.

## Model

A **Job** is one unit of work. Every turn, scheduled run, webhook run, and
delegation becomes a Job.

```ts
type JobKind = "turn" | "routine" | "webhook" | "delegation";
type JobStatus =
  | "queued"
  | "running"
  | "waiting"   // blocked on a human
  | "completed"
  | "failed"
  | "missed"
  | "cancelled";

interface Job {
  id: string;
  kind: JobKind;
  title: string;
  botId: string;
  parentJobId?: string;   // a delegation points at the turn that queued it
  threadId?: string;      // transcript, when one exists
  channelId?: string;     // shared bot-to-bot record, when one exists
  status: JobStatus;
  result?: string;        // bounded summary, not the full transcript
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}
```

A routine is a **schedule that creates Jobs**, not a separate world. A
delegation is a **child Job**, not a hidden side channel.

## Surfaces

### Chat

- Keep the chat clean: one compact status card for the active Job, and small
  child cards for delegations.
- A delegation card shows owner, status, result excerpt, and a link to the full
  transcript/channel.
- No new permanent panels in the main chat.

### Activity

One new view, opened from the sidebar:

- **Needs attention** — failed, missed, waiting, approvals/questions.
- **Running** — queued and running Jobs, with owner and elapsed time.
- **Done** — completed Jobs, newest first.
- Filters: bot, kind, status.
- Expanding a Job shows parent/children, result, error, and links.

Automations keeps only schedule and webhook definitions. Run history moves to
Activity; the Automations page links to the relevant Job.

### TaskPicker

Tasks that were created by a routine or a delegation carry a small origin
badge (`Scheduled`, `Delegated`) so they are not confused with user-created
tasks.

## Notifications

One policy, derived from Job state:

- `failed` and `missed`: notify by default.
- `waiting`: notify through the existing approval/question path.
- `completed`: opt-in per bot or per routine.
- Respect the per-bot Notifications switch.
- Persist `notifiedAt` on the Job so a restart or repeated SSE frame cannot
  notify twice.

## Migration

1. **Phase 1 — visibility, no schema rewrite.** Routine failures raise the
   existing `routine-failed` notification; routine failures join the in-app
   needs-you strip; delegation terminals write a result card into the source
   chat; scheduled tasks get an origin badge. No data is rewritten.
2. **Phase 2 — Job projection (implemented).** Routine runs are projected on
   the client; delegations get a durable `delegation-jobs.json`; live turns are
   derived from busy bots. `GET /api/jobs` returns the delegation jobs, and the
   Activity view combines all three. Existing files and APIs keep working.
3. **Phase 3 — UI consolidation.** Automations becomes schedule management;
   TaskPicker and auto-created channels link to Jobs; advanced controls move
   behind Developer mode. Any destructive migration needs explicit approval.

## Phase 2 acceptance criteria

- `GET /api/jobs` returns delegation jobs and is available before any job
  exists (empty list, not 404).
- A queued delegation appears in Activity immediately, moves to running, and
  ends completed or failed with the result/error.
- A delegation that was running during a restart is marked failed on the next
  boot instead of staying “running” forever.
- Activity shows routine, webhook, delegation, and live-turn jobs, with
  attention/running/done filters and a bot filter.
- Opening a job goes to its task, shared channel, or source chat; a routine
  with no task goes to Automations.
- The Activity view does not rewrite or delete any existing data.

## Phase 1 acceptance criteria

- A routine that fails or is missed produces exactly one notification per run,
  even after a restart or repeated events.
- A routine failure appears in the in-app “needs you” strip and in the
  Automations count.
- Clicking a routine notification opens the run’s task when one exists.
- A delegated turn writes a compact result or failure card into the source
  chat, with a link to the shared channel when one exists.
- Routine-created tasks are visibly marked in TaskPicker.
- Targeted tests cover the notification, the in-app item, and the delegation
  terminal card.

## Non-goals for Phase 1

- No changes to the approval, pairing, auth, or permission boundaries.
- No changes to the routine JSON schema beyond optional notification metadata.
- No new scheduler, database, or background service.
- No removal of existing tasks, routines, runs, or channels.
- No completion notifications by default.

## Open questions

- Should `delegate_bot` return the result to the source bot as a follow-up turn,
  or remain a handoff owned by the target? The UI must state which one it is.
- Should a run that was missed while the machine was off execute on wake, be
  skipped, or wait for a manual “Run now”?
- Should routine timezone be stored per routine, per bot, or per workspace?
- Should completion notifications default on for scheduled reports?
