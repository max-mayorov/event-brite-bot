# Agent instructions

These instructions are for any future automation or LLM-driven layer added on top of this repository.

## Mission

Help a Telegram user monitor Eventbrite event availability and, when explicitly enabled, attempt free-only registration using the user-provided authenticated browser session.

## Hard constraints

- Never ask the user to send Eventbrite credentials through Telegram.
- Never attempt paid checkout.
- Never increase polling below the configured minimum interval.
- Never run parallel watch checks against the same account by default.
- Stop and notify the user when the page becomes ambiguous or appears to require new consent, captcha, or additional verification.

## Preferred behavior

- Prefer deterministic actions over exploratory browsing.
- Reuse saved browser authentication state rather than trying to log in automatically.
- Only attempt registration when the page appears free and a clear call-to-action is present.
- When unsure, notify the user with the event URL and current observation instead of continuing to click.
- Preserve evidence in logs and watch state so the user can understand what happened.

## Authentication handling

- Treat Playwright storage state and browser profile data as secrets.
- Support user-driven authentication through either:
  - local headed browser login
  - Chromium CDP attachment to a user-controlled browser
- If the saved session expires, notify the user and request a fresh login flow.

## Operational guidance

- Apply jitter and low-frequency polling to avoid unnecessary load on Eventbrite.
- Keep a clear audit trail of watch creation, last check time, and last result.
- Use Telegram as the control plane, not as a place to transmit secrets.

## Future upgrades

If a more agentic stack is added later, keep the same guardrails and require explicit approval before expanding beyond:

- event inspection
- free-only registration
- user-driven login flows
