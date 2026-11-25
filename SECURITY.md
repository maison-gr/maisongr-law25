# Security

## Reporting a problem

Please report security problems privately, through GitHub: **Security → Report a vulnerability** on this repository. Don't open a public issue.

Say what you found, how to reproduce it, and what it lets someone do. You'll get a reply within a week, and a fix or a plan once the problem is confirmed. Reports are credited in the release notes unless you'd rather not be named.

## Supported versions

Security fixes go into the latest release.

## What the package does that matters here

- **It runs your config.** `law25.config.mjs` and `.js` are JavaScript modules, imported like any config file (ESLint's, Vite's): run the CLI only on a project you trust. A `.json` config is read as data.
- **It reads** the config, the Prisma schema and the SQL migrations it finds or is given. It reads no database and no personal information: only names, types and comments.
- **It writes** `law25.config.mjs` (`init`, never over an existing file) and the report files (`build`, in `docs/privacy/` or `--out`). Nothing else.
- **It sends nothing anywhere.** No network request, no telemetry.
