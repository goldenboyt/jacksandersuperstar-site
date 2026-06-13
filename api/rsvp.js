import { list, put } from "@vercel/blob";

const RSVP_PREFIX = "rsvp/live-in-dallas/";
const RSVP_LIST_PATH = "rsvp/live-in-dallas/list.json";
const NOTIFY_EMAIL = "jack@sanderclan.com";

function parseBody(request) {
  if (!request.body) {
    return null;
  }

  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      return null;
    }
  }

  return request.body;
}

function formatRsvpList(rsvps) {
  const sorted = [...rsvps].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return [`total: ${sorted.length}`, "", ...sorted.map((entry) => entry.name)].join(
    "\n"
  );
}

async function loadRsvps() {
  const { blobs } = await list({ prefix: RSVP_PREFIX, limit: 1000 });
  const listBlob = blobs.find((blob) => blob.pathname === RSVP_LIST_PATH);

  if (!listBlob) {
    return [];
  }

  const response = await fetch(listBlob.url);
  if (!response.ok) {
    return [];
  }

  try {
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveRsvps(rsvps) {
  await put(RSVP_LIST_PATH, JSON.stringify(rsvps), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function sendRsvpEmail(name, rsvps) {
  const response = await fetch(`https://formsubmit.co/ajax/${NOTIFY_EMAIL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      _subject: `${name} rsvp'd for live in dallas`,
      message: formatRsvpList(rsvps),
      _template: "box",
      _captcha: "false",
    }),
  });

  const result = await response.json().catch(() => ({}));
  return response.ok && String(result.success) === "true";
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "method not allowed" });
  }

  const body = parseBody(request);
  if (!body) {
    return response.status(400).json({ error: "invalid request" });
  }

  if (body._honey) {
    return response.status(200).json({ ok: true });
  }

  const name = body.name?.trim();
  if (!name) {
    return response.status(400).json({ error: "name required" });
  }

  const entry = {
    name,
    createdAt: new Date().toISOString(),
  };

  try {
    const rsvps = await loadRsvps();
    rsvps.push(entry);
    await saveRsvps(rsvps);

    const sorted = [...rsvps].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const emailed = await sendRsvpEmail(name, sorted);

    if (!emailed) {
      return response.status(500).json({ error: "could not send email" });
    }

    return response.status(200).json({ ok: true, total: sorted.length });
  } catch (error) {
    console.error("rsvp failed", error);
    return response.status(503).json({ error: "rsvp is not available yet" });
  }
}
