# Architecture

## Goal

Build a free, self-hosted agent that helps a user subscribe to Eventbrite events through a Telegram bot, while staying cautious about rate limits, paid checkouts, and authentication handling.

## Chosen approach

This repository uses a lightweight TypeScript application instead of a heavier autonomous-agent framework.

### Why this approach

- **Free and easy to run**: only Node.js, Telegram Bot API, and Playwright are required.
- **Low operational complexity**: no paid LLM, no hosted browser vendor, no database server.
- **Better control over risk**: deterministic command handlers are easier to audit than a general web agent.
- **Fits Eventbrite well**: Eventbrite discovery and organizer APIs exist, but fully automated attendee checkout is not broadly supported through a public API. For attendee registration, browser automation is the practical fallback.

## System components

### 1. Telegram bot

The Telegram bot is the user-facing control plane.

It accepts commands to:

- create and remove watches
- pause and resume watches
- trigger an immediate check
- guide the user through authentication setup
- report current watch state

### 2. Watch store

A file-backed JSON store keeps watch definitions and the latest observed status. This keeps setup simple and avoids requiring PostgreSQL or Redis for the initial version.

### 3. Scheduler

The scheduler runs in-process and checks only due watches. Guardrails:

- minimum interval floor
- serialized execution
- short random jitter
- explicit pause/resume

This reduces the chance of hammering Eventbrite and keeps the bot from generating bursty traffic.

### 4. Eventbrite automation worker

Playwright loads the event page, infers availability from visible page text, and optionally attempts **free-only** registration when explicitly enabled.

The initial worker intentionally avoids:

- paid checkout automation
- parallel high-frequency polling
- blind DOM clicking loops

## Authentication options considered

### Option A: local headed Playwright login

The user runs a local command that launches a real browser window, signs into Eventbrite manually, and then saves Playwright storage state.

**Why it is preferred**

- simplest setup
- works with MFA and captcha
- credentials are never typed into Telegram

### Option B: remote Chromium CDP attachment

The user launches their own Chrome or Chromium with a remote debugging port, logs in manually, and then the agent attaches with Playwright `connectOverCDP` to export session state.

**Why it is included**

- useful when the bot runs in Docker or on a remote box
- keeps the login action user-driven
- avoids building a custom remote desktop stack for the initial version

### Option C: full virtual desktop / browser streaming

This is possible later with noVNC or a browser streaming layer, but it is not part of the initial implementation because it adds significantly more setup, more moving parts, and more exposure of a live authenticated session.

## Why not use a larger agent framework

Frameworks such as OpenClaw-style browser agents can be attractive, but for this task they are not the best first choice:

- they increase setup complexity
- many need additional model infrastructure
- they are harder to constrain safely for checkout-like flows
- this use case is mostly workflow orchestration, not open-ended reasoning

The current architecture still leaves room to add a planner later, but starts with deterministic tools and explicit commands.

## Data flow

1. User sends a Telegram command.
2. Bot validates and stores or updates watch data.
3. Scheduler wakes up and picks due watches.
4. Playwright inspects the Eventbrite page using the saved auth session when available.
5. The bot sends a Telegram update when status changes or when a manual run is requested.
6. If enabled and the event appears free, the agent may attempt free registration.

## Safety constraints

- do not store raw Eventbrite passwords in the bot
- treat saved browser storage state as a secret
- never enable paid auto-checkout in the initial version
- enforce a minimum polling interval
- keep checks sequential by default
- prefer notifying on ambiguous flows instead of forcing more clicks

## Docker stance

Docker is supported for the bot process and persistent data storage.

For authentication, the most practical flow is:

1. run the bot in Docker
2. perform login once on the host machine with either local Playwright login or CDP attach
3. persist the resulting storage state inside the mounted `data/` volume

This keeps the runtime container simple while still supporting a self-hosted deployment.
