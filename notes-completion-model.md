# Completion model — thinking notes

## How it works today

Two stores: `Task[]` and `Completion[]` (rows of `{taskId, date, at}`). The checkbox never mutates a Task — it adds or removes a Completion row.

- **One-off todo** (`kind: 'todo'`, `due: <date>`): check → adds `Completion(taskId, today)`. Selectors filter the task out of overdue/today/upcoming/inbox once any completion exists for it. Both the Task and the Completion stick around forever.
- **Recurring** (`kind: 'recurring'`): check → adds `Completion(taskId, today)`. `instancesForDate` queries completions where `date === today` to decide checked state. Tomorrow's render builds a fresh set, so the box is unticked again. No instance generation, no rollover, no scheduler — purely date-driven query.

References: `src/renderer/lib/store.ts:169-179`, `src/renderer/lib/recurrence.ts:21-42`, `src/shared/types.ts:18-56`.

## What's weird

1. **One-off completions are dead weight.** After the due date passes, the Completion row only serves as a "has this ever been completed?" flag for the overdue filter (`isAnyCompletion`). Could be a single boolean or timestamp on the Task itself.
2. **Recurring completions accumulate forever.** 10 daily habits × 5 years ≈ 18k rows. Not breaking anything, but unbounded growth in the JSON store.
3. **One-off Tasks are never deleted on completion either.** After the due date, the task is invisible to all selectors but still sitting in `tasks[]`. Storage grows monotonically as you add and complete one-offs over time.
4. **`selectOverdueTodos` uses `isAnyCompletion`** (any completion, any date). Today that's safe because one-off completions are only ever created with `date === today`. But if you ever add "complete on a chosen past date" for one-offs, the overdue filter silently breaks.

## Why some of this is intentional

- The calendar view (`src/renderer/views/CalendarView.tsx`) lets you scroll to past days and shows the right checkbox state — that needs the historical Completion rows for recurring tasks.
- The `at` timestamp suggests the design wants completion *history*, not just completion *state*.

So recurring history is load-bearing. One-off history is not.

## Alternatives to consider

**A. Split storage by kind.**
- One-off: store `completedAt: string | null` directly on the Task; drop Completion rows for this kind.
- Recurring: keep the Completion log as-is.
- Pro: dead-weight rows disappear; overdue becomes `due < today && completedAt == null` and the `isAnyCompletion` foot-gun is gone.
- Con: Task behavior splits by `kind`; one-time persistence migration needed.

**B. Archive completed one-offs.**
- On check, move the Task into an `archived: Task[]` array. Completion stays attached for history.
- Pro: live `tasks[]` stays small; uncheck = restore from archive.
- Con: more state to keep coherent; queries that span all-time history get fiddly.

**C. Bound the recurring Completion log.**
- Keep only the last N days (e.g. 365), or only what the calendar can scroll to.
- Pro: linear → bounded growth.
- Con: lose long-term streak data; need a clear definition of "what the calendar shows".

**D. Do nothing.**
- Pro: model stays dead simple — one toggle function, two arrays.
- Con: storage grows forever; one-off semantics stay a bit odd.

## My lean

**A** is the cleanest answer to the "weird" parts: it removes the foot-gun and the dead rows, and doesn't sacrifice the recurring history the calendar depends on. The cost is a one-time data migration and a small bifurcation in the toggle logic. **C** is worth doing later if completions get genuinely large, but it's premature now.

A and C are also compatible — you could do A first and C later as a separate decision.
