# AGENTS.md

## Repo Identity

- Repo path: `/Users/edwardzev/moaz_factory-1`
- Current observed purpose: minimal Vercel Express example-style project with a
  root package marker.
- The root `package.json` currently names the package `ahmed_factory`; preserve
  that mismatch as observed data until a human explains the lineage.

## Truth Sources

Read these before making assumptions:

- `/Users/edwardzev/moaz_factory-1/README.md`
- `/Users/edwardzev/moaz_factory-1/package.json`
- `/Users/edwardzev/moaz_factory-1/.github/copilot-instructions.md`
- `/Users/edwardzev/Codex improvments/PROJECT_INVENTORY.md`

## Scope Rules

- Do not infer business purpose from the folder name.
- Do not merge this root with `/Users/edwardzev/moaz_factory` or
  `/Users/edwardzev/ahmed_factory` without explicit approval.
- Treat this as a minimal/tooling root until a task establishes active product
  behavior.
- Do not invent deployment, ownership, customer, or domain semantics.

## Operational Constraints

- Preserve the observed folder/package-name mismatch.
- If the task asks for product behavior, stop and ask for the intended owner or
  target before implementation.
- Do not copy secrets or deployment credentials into durable notes.

## Governance Signals

Trigger governance review when:

- this root is promoted from minimal/tooling status to active product work;
- package identity or folder lineage is renamed or reconciled;
- deployment ownership or environment contracts are introduced;
- it becomes linked to another factory root.

Detailed repo evolution trigger logic belongs to `$repo-governor`; this file is
only the repo-local reminder.

## Validation

- Use only validation commands that actually exist in `package.json` or are
  introduced by the approved task.
- For AGENTS-only edits, verify this file exists and preserves the minimal-root
  and package-name-mismatch constraints.
