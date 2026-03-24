# event-brite-bot

Self-hosted Telegram bot and Playwright worker for monitoring Eventbrite events and optionally attempting free-only registration.

## What this project does

- accepts Telegram commands
- watches Eventbrite event URLs on a configurable interval
- notifies the user when event status changes
- supports a user-driven login flow so the bot can reuse an authenticated Eventbrite browser session
- can optionally attempt **free-only** auto-registration when explicitly enabled

## Why this design

Eventbrite offers APIs for discovery and organizer workflows, but attendee registration is typically still centered around the hosted browser checkout flow. Because of that, this project uses:

- **Telegram** for control and notifications
- **Playwright** for page inspection and optional free-only registration
- **file-based persistence** for a zero-database setup
- **Docker** as an optional deployment wrapper

See `/home/runner/work/event-brite-bot/event-brite-bot/ARCHITECTURE.md` for the full reasoning.

## Guardrails

- the bot does **not** ask for Eventbrite credentials in Telegram
- the bot enforces a minimum polling interval
- checks are serialized
- paid checkout automation is intentionally not implemented
- free auto-registration is off by default

## Requirements

- Node.js 24+
- npm 11+
- a Telegram bot token from BotFather
- access to a browser for the one-time login flow

## Local setup

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set at least:

   ```dotenv
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   ALLOW_AUTO_REGISTER_FREE_ONLY=false
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Install the Playwright Chromium browser:

   ```bash
   npx playwright install chromium
   ```

5. Start the bot:

   ```bash
   npm run dev
   ```

## Authentication flows

The bot works best when it has a saved Eventbrite browser session.

### Option A: local headed browser login

This is the easiest path.

```bash
npm run login
```

This opens a real browser window. Log in to Eventbrite manually, then return to the terminal and press Enter. The bot saves Playwright storage state to `data/auth/eventbrite-storage-state.json`.

### Option B: attach to your own Chrome/Chromium session

Start Chrome or Chromium with a debugging port and a dedicated profile:

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=$HOME/.eventbrite-bot-profile
```

Log in to Eventbrite in that browser, then export the session:

```bash
npm run auth:attach -- http://127.0.0.1:9222
```

This is useful when the bot runs in Docker or when you want to use your own browser.

## Telegram commands

- `/start`
- `/help`
- `/login`
- `/loginstatus`
- `/watch <eventbrite-url> [--every=15] [--ticket="General Admission"]`
- `/watchfree <eventbrite-url> [--every=15] [--ticket="General Admission"]`
- `/list`
- `/pause <watch-id>`
- `/resume <watch-id>`
- `/remove <watch-id>`
- `/run [watch-id]`

### Examples

Notify only:

```text
/watch https://www.eventbrite.com/e/example-event-123456789 --every=20
```

Try free-only registration when enabled in `.env`:

```text
/watchfree https://www.eventbrite.com/e/example-event-123456789 --ticket="General Admission"
```

## Docker

Build and run:

```bash
docker compose up --build
```

The compose file mounts `./data` into the container so the saved auth state and watch store persist between restarts.

### Recommended Docker workflow

1. run the bot with Docker
2. perform the one-time login flow on the host
3. reuse the resulting `data/auth/eventbrite-storage-state.json` inside the mounted volume

## Development

Build:

```bash
npm run build
```

Test:

```bash
npm test
```

## Notes and limitations

- Eventbrite pages change over time, so registration selectors are intentionally conservative.
- If the bot cannot confidently continue, it should notify rather than click further.
- If Eventbrite invalidates the saved session, repeat one of the login flows.
- Keep polling polite. Avoid very small intervals even if the code technically allows them.
