# Security policy

## Supported versions

Only the latest release receives fixes. Update with `/plugin marketplace update seo-god-mode`.

## Reporting a vulnerability

Please do not open a public issue. Use [GitHub private vulnerability reporting](https://github.com/Siin0pe/seo-god-mode/security/advisories/new), or email 84010455+Siin0pe@users.noreply.github.com. Expect a first answer within a few days.

Things we especially want to hear about:

- a script reading, logging or sending credentials anywhere other than Google's or the configured provider's API;
- a way for page content or API data to make Claude take an action the guardrails forbid (prompt injection through fetched pages);
- anything that writes outside `.seo/` without being asked.

## How credentials are handled

- Google access uses a service account key that stays on your machine. `.seo/config.json` stores only the **path** to it.
- DataForSEO, PageSpeed, Bing and IndexNow keys are read from environment variables.
- Scripts talk to Google APIs, DataForSEO, Bing, IndexNow and the site being analysed, and nothing else. There is no telemetry.
