# Jack Prime

Jack Prime is the site's conversational voice at `/jackprime`. Its voice uses
natural conversational AAVE, with short, low-key replies. Greetings and simple
acknowledgments stay brief; it does not mirror stretched greetings or keep asking
generic check-in questions. It can have creative opinions, but
does not invent the artist's real memories, private facts, or upcoming plans.
It answers questions about Jack Sander's released music, credited features,
videos, recorded performances, merch, and creative projects. The instructions
include track counts, listed merch prices, ordering details, and explicit gaps
in the public biography. Missing facts receive a brief acknowledgment instead
of an invented answer. Short casual conversation and music opinions remain welcome.
Math problems, tutoring, essays, and academic assignments are outside its role,
including assignments framed around Jack. Clear arithmetic and essay requests
are declined directly before any pricing lookup or model call. Numeric facts
such as album track counts, release dates, and merch prices remain available.
For standalone greetings and simple acknowledgments, the response guard keeps
the first statement and removes generic check-ins, including those copied from
older chat history. Substantive questions still receive generated answers.
Standalone greetings and simple acknowledgments are answered directly by the
server, before any model or pricing request. They remain available during model
cooldowns and leave the shared AI quota for substantive messages. Combined
greetings/questions, offers, and clarifications still use the normal AI path.

The backend uses AI SDK 7.0.140 with Vercel OIDC authentication; no provider API
key is needed. Instructions and current release facts live in `lib/jack-prime.js`.
The chat handler lives in `lib/jack-prime-chat.js`; shared photo validation,
vision message construction, and image-scope checks live in `lib/jack-prime-media.js`.
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

## Images and song previews

Jack Prime's image mode and explicit natural-language image requests send a
prompt to `/api/jack-prime-image`. The route generates exactly one 1024 × 1024
PNG with `openai/gpt-image-2.5-sunburst` at high quality, using the existing Vercel
OIDC authentication. It verifies the complete reviewed image pricing before
generation, disables automatic retries and fallbacks, and accepts no model,
quality, size, or image-count settings from the caller. The current image-output
estimate is $0.05268 per image, plus prompt charges, from the high-quality
1024-square calculator. Image calls consume the user's funded Gateway credits.
No billing settings, auto-top-up settings, or additional storage services change.

The function has a 180-second duration allowance and a 140-second image-model timeout,
leaving time for the creation-scope check and price verification.
It returns binary PNG rather than base64 JSON to stay under the function's
4.5 MB response limit. Each warm instance retains up to eight completed image
results for ten minutes and shares an in-progress result for a repeated UUID.
This retry cache is best effort across instances; it is not globally durable
idempotency, a cumulative budget, or a guarantee that stopping the browser can
cancel a billed image request. At most three generations run concurrently in one
instance. Invalid requests and changed image pricing are rejected before billing.

Generated images stay available for display and download during the current
conversation. Binary data uses device IndexedDB with at most 20 retained images;
raw photo uploads stay in memory and are not persisted. Refreshing starts a new
conversation, clears editing and upload state, and removes the preceding
conversation's generated-image records. Reset does the same and stops audio.
Downloads use the original PNG. No image data or uploaded photo enters text-model
history, logs, or session storage.

Two suggested cover starters prepare edits without billing until the visitor
submits. Superstar uses the actual `assets/album.webp` cover as its reference and
replaces its chest wordmark with up to 160 characters of literal visitor text.
Prodigy Genius takes the original `covers/prodigy-genius.jpg` and a visitor's
uploaded photo as separate references, replacing facial identity while keeping
the cover's composition, suit, exaggerated head shape, and advisory label.
Photos are decoded and resized on the device to at most 1024 pixels, converted
to JPEG, and sent as multipart data. The server accepts only known templates,
validates image signatures and a 2.1 MB upload limit, and includes the photo in
the retry fingerprint. Reference-image edits have additional image-input charges.

The same upload control works outside the cover starters. In chat mode it sends
the current question and attached image as a binary AI SDK file part to the existing
vision-capable text model. In image mode it supplies the photo as an edit reference.
The photo stays visibly attached across follow-ups and mode changes until removed,
replaced, reset, or refreshed. Raw uploads are kept only in device memory and are
not added to text history, logs, session storage, or remote file storage. Photo
questions may discuss ordinary visible content; image creation and edits use the
artist scope described below. Math and essay restrictions also apply to images.

Before general image generation or editing, the pinned text model makes a short
structured choice about whether the request loosely fits Jack's creative world.
It considers the prompt, recent text context (up to 6,000 characters), and attached
photo. Covers, merch, music posters, fan art, and follow-up edits can qualify without
repeating Jack's name. Clearly unrelated requests return a chat decline before an
image-model call. The two album-cover templates are already in scope and skip this
check. Classification uses the same complete text-price verification, no reasoning,
32 output tokens, and no retries; it adds a small text-model charge. Vision questions
and reference edits also incur image-input token charges through the existing balance.
No new model, billing settings, or auto-top-up changes are introduced.

Pending replies display a small animated four-stroke thinking mark; pending images
display a typographic rendering frame and red scan line. These are CSS-only status
animations, not generated media or simulated percentages. Completion, decline,
failure, stop, and reset remove the pending state. Reduced-motion preferences retain
the status label while disabling the animation. The keyboard layout remains compact
with attachments and the new controls.

Text replies include canonical song IDs when they mention catalog tracks.
`lib/jack-prime-songs.js` resolves names, featured-title aliases, and single paths
against the existing release catalog. It deduplicates album/single recordings,
avoids ordinary phrases and album-name-only matches, and permits only known
Apple or same-site preview URLs. The browser renders compact cover/title cards
with the shared 30-second preview player; sound starts only on a tap, and only
one preview plays at a time. Refresh starts fresh without any automatic playback.

## Conversation and verification

The browser keeps the current conversation in memory; refreshing starts fresh,
as requested by the user. It supports
follow-ups, Enter to send, Shift+Enter for a new line, stop, retry, and reset.
Context is trimmed by complete old turns to stay inside the API's 12,000-character
limit, so a longer conversation does not leave the next message permanently
invalid. Visible messages are retained. Stalled requests release the composer
after 35 seconds for text or 175 seconds for images; no automatic retry is sent.
Newly typed drafts survive a failed or stopped request, and canceling a cover
or switching back to chat preserves its text. Sending keeps keyboard focus;
IME confirmation does not accidentally submit. Growing drafts keep the latest
reply anchored only when the visitor was already reading at the bottom.
The compact keyboard layout reduces the header and toolbar, keeps long drafts
inside the visible viewport, and discards a stale viewport offset after closing
the keyboard. These paths are checked in Chromium and WebKit, including simulated
keyboard sizes, viewport panning, and longer conversations.
Only known site paths become links. Assistant replies render bold emphasis with
safe DOM text nodes. Visiting the
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
