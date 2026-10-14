---
description: Put the SEO rituals on autopilot (Monday review, monthly GEO check) with the system scheduler
argument-hint: "[weekly|monthly|both] [HH:MM]"
---

Set up the recurring SEO rituals for the project in the current directory. Reply in the user's language. Request: `$ARGUMENTS` (default: both, at 08:00 local time).

The rituals:
- **Weekly, Monday:** `/seo-god-mode:seo weekly`: writes `.seo/reports/<week>.md` and, if a tracker is configured, posts it there.
- **Monthly, first Monday:** `/seo-god-mode:seo geo monthly`: the parts of the GEO check a script can do (fan-out queries, prospects, citation report), index coverage (`index`), and the list of buyer prompts for the owner to run by hand. Nobody can check AI citations for them unattended.

## 1. Check it can run unattended

- `.seo/config.json` exists (otherwise run `/seo-god-mode:setup` first) and `doctor` passes for Search Console.
- The service account key is a file on this machine. A scheduled run uses the same credentials, so it must run here, not in a cloud sandbox that doesn't have the key. Do not copy the key anywhere.
- `claude` is on the PATH (`claude --version`).

## 2. Show the exact entry and ask

Build the command for this OS, with the project's absolute path. The headless run only needs to read, run the skill's Node scripts and write reports:

```
claude -p "/seo-god-mode:seo weekly" --allowedTools "Bash(node:*)" Read Write Glob Grep
```

If `.seo/config.json` has a `tracker`, add the tools that post to it (for Linear, e.g. `mcp__linear__save_document`), or the report stays in `.seo/reports/` only. Say which one applies.

- **Windows** (Task Scheduler), run from the project directory:
  `schtasks /Create /TN "SEO weekly - <project>" /SC WEEKLY /D MON /ST 08:00 /TR "cmd /c cd /d \"<project path>\" && claude -p \"/seo-god-mode:seo weekly\" --allowedTools \"Bash(node:*)\" Read Write Glob Grep > .seo\reports\last-run.log 2>&1"`
  Monthly: `/SC MONTHLY /MO FIRST /D MON`.
- **macOS / Linux** (cron, `crontab -e`):
  `0 8 * * 1 cd "<project path>" && claude -p "/seo-god-mode:seo weekly" --allowedTools "Bash(node:*)" Read Write Glob Grep > .seo/reports/last-run.log 2>&1`
  Monthly, first Monday: `0 8 1-7 * * [ "$(date +\%u)" = 1 ] && cd "<project path>" && claude -p "/seo-god-mode:seo geo monthly" ...` (cron would OR a day-of-month and a day-of-week field, hence the date test).

Show the entry, say what it will do and when, and **create it only after the owner says yes**: a scheduler entry is persistent configuration on their machine. If they prefer Claude Code's own `/schedule` and their environment has the credentials available, that works too; say plainly that a cloud routine without the key file will fail at the first Google call.

## 3. Prove it

Run the exact command once now, show the first lines of the report it wrote, and tell the owner how to remove the entry (`schtasks /Delete /TN "<name>"`, or delete the line from `crontab -e`). Add a line to `.seo/log.md`: date, "scheduled weekly/monthly SEO rituals", the scheduler used.
