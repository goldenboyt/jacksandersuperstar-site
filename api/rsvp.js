import { get, put } from "@vercel/blob";

const RSVP_LIST_PATH = "rsvp/live-in-dallas/list.json";

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

async function loadRsvps() {
  const blob = await get(RSVP_LIST_PATH, { access: "private" });

  if (!blob?.stream) {
    return [];
  }

  try {
    const text = await new Response(blob.stream).text();
    const data = JSON.parse(text);
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
    const rsvps = await loadRsvps();
    rsvps.push(entry);
    await saveRsvps(rsvps);

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
