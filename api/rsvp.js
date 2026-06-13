import { get, list, put } from "@vercel/blob";

const RSVP_PREFIX = "rsvp/live-in-dallas/guests/";
const LEGACY_LIST_PATH = "rsvp/live-in-dallas/guests.json";

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

function formatName(entry) {
  if (entry.firstName || entry.lastName) {
    return [entry.firstName, entry.lastName].filter(Boolean).join(" ");
  }

  return entry.name || "";
}

function formatRsvpList(rsvps) {
  const sorted = [...rsvps].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return [
    `total: ${sorted.length}`,
    "",
    ...sorted.map((entry) => formatName(entry)),
  ].join("\n");
}

async function readJsonBlob(pathname) {
  const blob = await get(pathname, { access: "private" });

  if (!blob?.stream) {
    return null;
  }

  try {
    return JSON.parse(await new Response(blob.stream).text());
  } catch {
    return null;
  }
}

async function loadLegacyRsvps() {
  const data = await readJsonBlob(LEGACY_LIST_PATH);
  return Array.isArray(data) ? data : [];
}

async function loadGuestFiles() {
  const { blobs } = await list({ prefix: RSVP_PREFIX, limit: 1000 });
  const entries = [];

  for (const blob of blobs) {
    const data = await readJsonBlob(blob.pathname);

    if (data && typeof data === "object" && !Array.isArray(data)) {
      entries.push(data);
    }
  }

  return entries;
}

async function loadRsvps() {
  const [legacy, guests] = await Promise.all([loadLegacyRsvps(), loadGuestFiles()]);
  return [...legacy, ...guests];
}

async function saveRsvp(entry) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await put(`${RSVP_PREFIX}${id}.json`, JSON.stringify(entry), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
  });
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

  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();

  if (!firstName || !lastName) {
    return response.status(400).json({ error: "first and last name required" });
  }

  const name = `${firstName} ${lastName}`;

  const entry = {
    firstName,
    lastName,
    name,
    createdAt: new Date().toISOString(),
  };

  try {
    await saveRsvp(entry);
    const rsvps = await loadRsvps();

    const sorted = [...rsvps].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return response.status(200).json({
      ok: true,
      total: sorted.length,
      subject: `${name} rsvp'd for live in dallas`,
      message: formatRsvpList(sorted),
    });
  } catch (error) {
    console.error("rsvp failed", error);
    return response.status(503).json({ error: "rsvp is not available yet" });
  }
}
