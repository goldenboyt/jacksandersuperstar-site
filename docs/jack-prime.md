# Jack Prime

Jack Prime is the site's conversational voice at `/jackprime`. Its voice uses
natural conversational AAVE, with short replies. It can have creative opinions, but
does not invent the artist's real memories, private facts, or upcoming plans.

The backend uses AI SDK 7.0.140 with Vercel OIDC authentication; no provider API
key is needed. Instructions and current release facts live in `lib/jack-prime.js`.
Replies are limited to 280 output tokens, with at most 12 submitted messages and
12,000 characters of conversational context. Automatic retries are disabled.

## Spending constraint

The user specified no more than $5 of AI spend on 2026-10-14. Jack Prime uses
`nvidia/nemotron-3.5-lightning-free`, whose input and output prices were both
verified as **$0** in the live Gateway catalog. The model is available to the
team's activated free tier. No credits were purchased, paid fallbacks added,
or automatic credit top-ups enabled by this implementation.

Before **every** generation, `lib/jack-prime-cost.js` fetches uncached model
pricing. It blocks the request if the model disappears, any supported price
becomes nonzero, unknown charges appear, or the lookup fails. Tests cover paid
input/output, higher context tiers, regional and cache fees, unknown charges,
and failed price lookups. Visitors receive a temporary-unavailability message;
the backend never switches to a paid model.

This restriction concerns AI model charges. Existing Vercel hosting and any
separately enabled account add-ons have their own billing. The current connector
does not expose Gateway budget administration, so it cannot verify or change
the account's separate $5 project budget or automatic top-up settings.

Pricing source: https://ai-gateway.vercel.sh/v1/models
Model: https://vercel.com/ai-gateway/models/nemotron-3.5-lightning-free

## Conversation and verification

The browser keeps this tab's conversation in session storage. It supports
follow-ups, Enter to send, Shift+Enter for a new line, stop, retry, and reset.
Only known site paths become links. Assistant replies render bold emphasis with
safe DOM text nodes, including conversations restored after refresh. Visiting the
page does not call the AI. The page has no character or alter-ego labels; explicit
questions about AI identity still receive honest answers.

The current free provider allows five requests per minute per region. A rate
limit returns HTTP 429 with a short retry message and a `Retry-After` header;
it never triggers an automatic retry or a paid model fallback.

The activated backend passed real introductions, follow-ups, and merch questions
on the production domain. Runtime logs confirm the selected model and successful
zero-price checks. Desktop Chromium and mobile WebKit also passed layout,
conversation history, failed-request retry, stop, and reset checks using
controlled responses before publication.
