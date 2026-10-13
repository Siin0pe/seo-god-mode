# Contributing to SEO God Mode

Thanks for helping. This project is a Claude Code plugin: a skill (`SKILL.md` + references) that drives zero-dependency Node scripts against real SEO data. Contributions that make Claude a better SEO, with real data and safe defaults, are welcome.

## Ways to help

- **Report a bug**: a script crashing, a wrong number, a misleading verdict. Use the bug template.
- **Propose a command or data source**: open a feature request first, so we agree on the shape before you write code.
- **Improve the judgment**: the judgment section of `SKILL.md` and `references/playbook.md` encode SEO experience. Corrections backed by a source (Google documentation, a study, your own Search Console data) are very welcome.
- **Docs and typos**: send a PR directly.

## Project layout

```
.claude-plugin/marketplace.json        marketplace manifest
plugins/seo-god-mode/
├── .claude-plugin/plugin.json          plugin manifest (version lives here)
├── commands/setup.md                   /seo-god-mode:setup
└── skills/seo/
    ├── SKILL.md                        what Claude reads: commands, rules, judgment
    ├── references/                     loaded on demand: playbook, policies, GEO, setup
    └── scripts/                        Node 18+ scripts, lib.mjs holds the shared plumbing
```

## Local development

```
git clone https://github.com/Siin0pe/seo-god-mode
cd seo-god-mode
claude plugin validate .
```

Then, inside Claude Code:

```
/plugin marketplace add /path/to/seo-god-mode
/plugin install seo-god-mode@seo-god-mode
/reload-plugins
```

To try the scripts against a site you own, run `node plugins/seo-god-mode/skills/seo/scripts/setup.mjs --site https://your-site.com` from a scratch folder, then any other script from the same folder.

## Rules for scripts

These rules keep the plugin trustworthy. A PR that breaks one of them will be asked to change.

1. **Zero dependencies.** Node 18+ built-ins and `fetch` only. No `package.json`, no install step.
2. **Never invent data.** If a source is missing, call `missing()` from `lib.mjs` (exit code 2) with what is missing and how to connect it. Estimates are labelled as estimates.
3. **Read-only by default.** Scripts read APIs and pages. Anything that changes the outside world (a ping, a submission) is explicit in the script name and its `--help`.
4. **No secrets in files.** Credentials come from environment variables or from a path in `.seo/config.json`, never from the config itself. Never read other tools' config files.
5. **Self-documenting.** The leading `//` comment block of every script is its `--help`: what it answers, usage, options.
6. **Same output contract.** Markdown on stdout by default, `--json` for machines, `--out <file>`, and the common window options (`--days`, `--start`, `--end`, `--host`). Use the helpers in `lib.mjs` (`period`, `gsc`, `table`, `emit`…) rather than re-implementing them.
7. **Respect quotas.** Cache what is expensive (see `index-status.mjs`) and keep concurrency low with `pool()`.

## Rules for the skill text

- Explain *why* rather than shouting rules: the model follows reasons better than capital letters.
- Every figure about the outside world (quotas, CTR curves, study results) carries a source and a date. Disputed figures say so.
- Keep `SKILL.md` short; move detail into `references/` and point to it.
- Guardrails (the Allowed / Needs approval / Never table) only get stricter in a PR, never looser, unless discussed in an issue first.

## Before opening a PR

- [ ] `node --check` passes on every changed script (CI runs it on all of them).
- [ ] `claude plugin validate .` and `claude plugin validate plugins/seo-god-mode` pass.
- [ ] You ran the changed script against a real property and read the output.
- [ ] `--help` is up to date, and so are the command table in `SKILL.md` and the README.
- [ ] `CHANGELOG.md` has an entry under `## [Unreleased]`.
- [ ] No site names, property IDs, emails or key paths from your own setup in the diff.

Keep PRs focused: one command or one fix per PR is easier to review.

## Releases

Versions follow [Semantic Versioning](https://semver.org/). A release bumps the version in `plugins/seo-god-mode/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (both entries), moves `[Unreleased]` to the new version in `CHANGELOG.md`, tags `vX.Y.Z` and publishes a GitHub release. Claude Code users get it with `/plugin marketplace update seo-god-mode`.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
