# El Bruto Arena Runner

[Español](README.es.md) | English

TypeScript + Playwright CLI for automating **La Brute / El Bruto** fights on EternalTwin.

The project currently supports two ways of running:

- **automatic mode**, intended for terminal commands, scripts, or cron
- **interactive mode**, intended for a guided console flow where you choose the account, brutes, and run mode

## What It Does

The runner can currently:

- log in to EternalTwin automatically
- use locally stored accounts that stay on your machine
- discover an account's brute roster from `/hall`
- run:
  - a single brute
  - several selected brutes
  - all brutes in the account
- go directly to the selected brute's `/cell`
- fight until the brute is resting or a safe stop is reached
- move through the roster with `Next Brute` in `all-brutes` mode
- choose arena opponents using the lowest public `Win Rate` / `Ratio de Victoria` when that data can be resolved
- save detailed logs and error artifacts for debugging

## Requirements

- Node.js 20+
- npm
- Playwright Chromium

## Installation

```bash
npm install
npx playwright install chromium
```

## How Accounts Are Stored

The main and recommended approach is:

- `/.accounts.local.json`

Format:

```json
{
  "accounts": [
    {
      "label": "Main account",
      "username": "my_username",
      "password": "my_password"
    },
    {
      "label": "Secondary account",
      "username": "other_username",
      "password": "other_password"
    }
  ]
}
```

Notes:

- `/.accounts.local.json` is gitignored
- the label is what you see in interactive mode and what you can also use with `--account`
- if you only have one saved account, automatic mode can use it without asking
- if you have several saved accounts, automatic mode should be given `--account`

Current credential priority:

1. `ET_USERNAME` + `ET_PASSWORD`
2. saved account in `/.accounts.local.json`

## Quick Start

During development you can run the source directly:

```bash
npm run dev
```

If you prefer using the compiled version:

```bash
npm run build
npm run start
```

## Interactive Mode

If you run without arguments:

```bash
npm run start
```

the app enters interactive mode.

You can also force it with:

```bash
npm run start -- --interactive
```

or:

```bash
npm run start -- --manual
```

### What Interactive Mode Does

1. lets you choose a saved account or enter a new one
2. if you enter a new account, it asks whether you want to save it
3. logs in
4. opens `/hall`
5. discovers the account's brutes
6. lets you choose between:
   - all brutes
   - one brute
   - several selected brutes

## Automatic Mode

Automatic mode is intended for non-interactive runs.

### Run All Brutes

With a single saved account:

```bash
npm run start -- --mode all-brutes --headless
```

With a specific saved account:

```bash
npm run start -- --mode all-brutes --account "Main account" --headless
```

With environment variables:

```bash
ET_USERNAME="my_username" ET_PASSWORD="my_password" npm run start -- --mode all-brutes --headless
```

### Run One Brute

In automatic mode, `single` requires an explicit brute:

```bash
npm run start -- --mode single --brute ExampleBrute --account "Main account" --headless
```

or with environment variables:

```bash
ET_USERNAME="my_username" ET_PASSWORD="my_password" npm run start -- --mode single --brute ExampleBrute --headless
```

## Main Options

- `--mode single|all-brutes`
- `--brute <name>`
- `--account <label>`
- `--interactive`
- `--manual`
- `--debug`
- `--headless`
- `--profile-dir <path>`
- `--artifacts-dir <path>`
- `--logs-dir <path>`
- `--login-timeout-ms <ms>`
- `--url <url>`

### Useful Notes

- automatic `single` requires `--brute`
- if you have multiple saved accounts, automatic mode should usually use `--account`
- `--debug` mainly affects console verbosity
- the log file still keeps rich detail even without `--debug`

## Browser Profiles

The runner uses a persistent Playwright profile.

If you switch between multiple accounts, it is recommended to use separate profiles:

```bash
npm run start -- --mode single --brute ExampleBrute --account "Main account" --profile-dir playwright-profile-main
```

```bash
npm run start -- --mode single --brute ExampleBrute --account "Secondary account" --profile-dir playwright-profile-alt
```

This helps avoid mixing cookies or session state between accounts.

## Logs And Artifacts

Logs are stored in:

- `logs/`

Error artifacts are stored in:

- `artifacts/`

When something fails, you will usually get:

- a `.log`
- a `.png` screenshot
- an `.html` snapshot

## Real Runner Flow

In practical terms, the current flow is:

1. open EternalTwin
2. log in if needed
3. stabilize the account
4. discover brutes from `/hall` when selection is needed
5. open the corresponding brute `/cell`
6. go to arena
7. choose an opponent
8. repeat until the brute is resting or the selected run mode is finished

## Known Limitations

- the project depends on the real HTML served by EternalTwin
- UI changes may require selector or parser adjustments
- opponent choice depends on public win-rate data being resolvable correctly
- manual decisions such as level-up choices are still out of scope

## Development Commands

```bash
npm run build
npm run test
npm run check
```
