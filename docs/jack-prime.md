# Jack Prime

Jack Prime is the site's conversational voice at `/jackprime`. Its voice uses
natural conversational AAVE, with short, low-key replies. Greetings and simple
acknowledgments stay brief; it does not mirror stretched greetings or keep asking
generic check-in questions. It can have creative opinions, but
does not invent the artist's real memories, private facts, or upcoming plans.
For standalone greetings and simple acknowledgments, the response guard keeps
the first statement and removes generic check-ins, including those copied from
older chat history. Substantive questions still receive generated answers.
Standalone greetings and simple acknowledgments are answered directly by the
server, before any model or pricing request. They remain available during model
cooldowns and leave the shared AI quota for substantive messages. Combined
greetings/questions, offers, and clarifications still use the normal AI path.

The backend uses AI SDK 7.0.140 with Vercel OIDC authentication; no provider API
key is needed. Instructions and current release facts live in `lib/jack-prime.js`.
Replies aim for one sentence and 25 words, with a server-enforced maximum of two
sentences. Generation is limited to 96 output tokens, with at most 12 submitted messages and
12,000 characters of conversational context. Automatic retries are disabled.

## Model pricing and funded credits

The user initially capped AI spending at $5, subsequently added $10 of Gateway
credits, and authorized a smarter text model on 2026-10-16. Jack Prime now pins
`openai/gpt-6-luna`. Its reviewed ordinary text rates are **$0.10 per
million input tokens** and **$0.50 per million output tokens**. Substantive chat
uses the funded credit balance; greetings and simple acknowledgments still cost
no model tokens. This implementation purchases no credits and does not enable
automatic top-up, change billing settings, or add another model as a fallback.

Before **every** generated reply, `lib/jack-prime-cost.js` fetches uncached model
pricing and verifies the exact model against the complete reviewed snapshot in
`lib/jack-prime-pricing.json`. Object key order may vary; every rate, fee, context
threshold, and pricing field must otherwise match. Any change, even a lower
price or removed field, blocks generation until the snapshot is reviewed again.
This includes optional cache, regional, service-tier, fast-mode, and web-search
pricing. No tools, regional routing, cache markers, service-tier or fast-mode
selection, or model fallbacks are supplied by the route. Visitors receive a
temporary-unavailability message if pricing changes or the lookup fails.

At 1,600 input tokens and the full 96-token output allowance, a reply costs about
**$0.000208** before any separate account add-ons; 1,000 such replies cost about
**$0.208**. Longer conversation histories cost more. The provider can apply
automatic prompt caching without explicit cache markers. Cache writes cost
$0.125 per million input tokens and cache reads cost $0.01 per million. If all
1,600 input tokens were new cache writes, the same 96-output-token illustration
would cost $0.000248, or $0.248 for 1,000 replies. The runtime base estimate does
not include these cache adjustments.
These are per-request estimates, not a cumulative spending cap. Output
tokens remain limited to 96, reasoning is disabled, and retries remain disabled.

Gateway budgets are soft caps; a request that crosses a budget can complete.
The connector does not expose budget or auto-top-up administration, so those
settings must be checked separately in Vercel. Existing Vercel hosting and any
separately enabled account add-ons have their own billing. Runtime logs include
the model, generation ID, token usage, and an estimated base token cost; Gateway
generation details provide the actual billed cost.

Pricing source: https://ai-gateway.vercel.sh/v1/models
Model: https://vercel.com/ai-gateway/models/gpt-6-luna

## Conversation and verification

The browser keeps this tab's conversation in session storage. It supports
follow-ups, Enter to send, Shift+Enter for a new line, stop, retry, and reset.
Only known site paths become links. Assistant replies render bold emphasis with
safe DOM text nodes, including conversations restored after refresh. Visiting the
page does not call the AI. The page has no character or alter-ego labels; explicit
questions about AI identity still receive honest answers.

The page shares the main site's white canvas, Arial typography, thin rules,
rectangular controls, header, and menu. The horizontal masthead sits above a
broad conversation area with flat message blocks. It contracts once a chat
starts, and makes room for the composer when a phone keyboard reduces the
visible viewport. The styles are scoped to Jack Prime. On mobile, the fixed
conversation frame follows both the visual viewport's height and vertical offset
so Safari's keyboard focus panning cannot move the composer away from the
keyboard. The document stays locked while the conversation and menu can scroll;
pinch zoom retains native behavior. Prime's header stays available during native
focus scrolling, while other pages retain their existing header behavior.
In very short visible viewports, the header and toolbar fold away so the message
box remains usable; they return when the available height increases.

Provider capacity limits can still return HTTP 429 with a short retry message and
a `Retry-After` header; the route never retries automatically or selects another
model. The funded account has moved beyond Gateway's original free-tier cap.

Focused checks cover reviewed model pricing, fee increases, unknown charges,
failed price lookups, quota-free routine social turns, and the existing short
reply and tone guards. The page's earlier desktop Chromium and mobile WebKit
checks covered layout, conversation history, failed-request retry, stop, and
reset using controlled responses. This text-model change does not alter the UI.
