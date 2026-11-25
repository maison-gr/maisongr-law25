# Contributing

[Français](CONTRIBUTING.md) · **English**

Thank you for helping. A schema the package reads wrong, or a personal field it misses (or flags wrongly), with the schema that shows it, is the most useful thing you can send. Pull requests are welcome too.

## Setup

Development needs Node 22.12 or later (the package itself runs on 20.9 and later).

```sh
npm ci
npm run typecheck
npm test
npm run build && node test/smoke.mjs
```

## What a change needs

- **A test that fails without it.** Schema reading is tested on small schemas written in the test (`test/schema.test.ts`); add the one that showed the problem.
- **A source for anything about the law.** Wording about Law 25 cites the section it comes from, and stays a summary in this package's own words. Don't copy the Commission d'accès à l'information's guide or template: its texts are not under an open licence.
- **Both languages.** Every word of the report exists in French (Québec, with its typography) and English, and changes in both at once.
- **A deterministic report.** The same config gives the same file: no timestamps, no ordering that depends on the machine.
- **No new runtime dependency.**

## Adding a schema source

1. `src/schema.ts`: a parser that returns `Field`s (`ref`, `model`, `name`, `type`, `marked`, `file`, `line`), with `@personal` and `@not-personal` read from comments.
2. `src/load.ts`: where to find it, and a CLI option.
3. Tests for both, and the README's "How check works".

## Commits and pull requests

Small commits, each doing one thing, with a [conventional](https://www.conventionalcommits.org/) message: `feat: read Drizzle schemas`, `fix: keep a comment after the comma with its column`. Keep a pull request to one change, and describe what you checked.

## Security

Please don't open a public issue for a security problem. See [SECURITY.md](SECURITY.md).
