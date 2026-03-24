# El Bruto Arena Runner

A TypeScript + Playwright CLI that automates arena fights for a single EternalTwin La Brute character.

It is designed to be:

- robust against transient page states
- easy to debug
- safe to run manually on demand
- extensible for future multi-brute support

## What It Does

Given a target brute cell URL, the tool:

1. Launches a visible Chromium browser with a persistent Playwright profile.
2. Opens the EternalTwin root page first.
3. Waits for you to log in manually if needed.
4. Navigates to the target brute.
5. Detects the current page state.
6. Repeats the arena flow until the brute is resting or a terminal condition is reached.

The current Phase A flow supports:

- login bootstrap from the site root
- session reuse through a persistent browser profile
- target brute resolution after login
- arena entry
- rival selection
- pre-fight detection on `/versus/...`
- starting the fight
- skipping back to the current brute cell after combat
- stopping when the brute is resting
- stopping safely when manual intervention is required

## Current Scope

This version processes only the currently requested brute.

It does **not** yet:

- process all brutes in an account
- choose rivals strategically
- automate level-up choice decisions
- schedule runs automatically

## Requirements

- Node.js 20+
- npm
- Playwright Chromium browser installed locally

## Installation

```bash
npm install
npx playwright install chromium
```

## Build

```bash
npm run build
```

## Run

Example:

```bash
npm run start -- --url "https://brute.eternaltwin.org/ExampleBrute/cell" --debug
```

### Supported CLI options

- `--url <target-cell-url>`
- `--debug`
- `--profile-dir <path>`
- `--artifacts-dir <path>`
- `--logs-dir <path>`
- `--login-timeout-ms <number>`

### Typical first run

1. Start the command.
2. A visible browser opens.
3. If you are logged out, the tool waits for you to log in manually.
4. After login stabilizes, the tool moves to the target brute.
5. It attacks until the brute is resting or another terminal state is reached.

### Typical later runs

The browser profile is stored in `playwright-profile/`, so cookies and session state are reused.

That means you usually do **not** need to log in again unless EternalTwin expires the session.

## How It Works

The runner uses an explicit state machine instead of a fixed click script.

Recognized states include:

- `login_required`
- `cell_ready`
- `cell_resting`
- `arena_selection`
- `pre_fight`
- `fight`
- `level_up`
- `unknown`

The runner intentionally tolerates short-lived transient states, especially after:

- login redirects
- SPA hydration
- moving from arena to versus
- returning from fight to cell

This is why logs may briefly show `unknown` before stabilizing to a known state.

## Output

### Logs

Run logs are written to:

- `logs/`

### Failure artifacts

If an unexpected error occurs, the tool writes:

- a screenshot
- an HTML snapshot

to:

- `artifacts/`

### Summary

At the end of a run, the tool prints a summary including:

- brute name
- fights completed
- final status
- whether resting was reached
- whether level-up was detected
- whether errors occurred
- artifact paths if applicable

## Language Support

The current implementation is intended to work with both:

- English
- Spanish

Important state detection already supports both languages for the areas we had to validate live, including:

- public login landing markers
- brute-not-found public landing markers
- resting detection
- pre-fight start control text

Other languages are **not** currently guaranteed.

Even between English and Spanish, support is based on the real EternalTwin UI that was observed during implementation, so future UI changes may require narrow selector updates.

## Project Structure

Main modules:

- `src/main.ts`
  - entrypoint
- `src/cli.ts`
  - CLI argument parsing
- `src/config.ts`
  - runtime config construction
- `src/browser/session.ts`
  - persistent Playwright session bootstrapping
- `src/game/brute-runner.ts`
  - main orchestration/state-machine loop
- `src/game/detector.ts`
  - page signal collection
- `src/game/state.ts`
  - state classification
- `src/game/selectors.ts`
  - centralized selectors
- `src/game/navigation.ts`
  - page actions and navigation helpers
- `src/game/arena.ts`
  - arena readiness and fight-launch flow
- `src/game/target-resolution.ts`
  - post-login target brute resolution
- `src/game/retry.ts`
  - retry safety helpers
- `src/reporting/`
  - logs, summaries, failure artifacts

## Validation

Available checks:

```bash
npm run build
npm test
npm run check
```

## Limitations

- The site is dynamic, so some transitions briefly appear as `unknown` before stabilizing.
- The tool assumes the current EternalTwin UI structure that was observed during live testing.
- If the game changes route shapes, button structure, or text labels, selectors may need updates.
- Level-up choice remains manual by design.

## Safety Notes

Use this project at your own risk.

Browser-game automation may be subject to game rules or terms of service. You are responsible for deciding whether and how to use it.

## Future Work

Likely next steps:

- process all brutes in an account
- make brute selection configurable by name instead of full URL only
- improve live-state stabilization around transient SPA transitions
- add optional scheduling
- produce richer run reports
