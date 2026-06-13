const RSVP_PREFIX = "rsvp/live-in-dallas/";
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

async function listRsvps(token) {
  const response = await fetch(
    `https://blob.vercel-storage.com?prefix=${encodeURIComponent(RSVP_PREFIX)}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        "x-api-version": "7",
      },
    }
  );

  if (!response.ok) {
    throw new Error("could not load rsvps");
  }

  const data = await response.json();
  const blobs = data.blobs || [];
  const entries = [];

  for (const blob of blobs) {
    const fileResponse = await fetch(blob.url, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    if (!fileResponse.ok) {
      continue;
    }

    try {
      entries.push(await fileResponse.json());
    } catch {
      continue;
    }
  }

  return entries.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

async function saveRsvp(entry, token) {
  const pathname = `${RSVP_PREFIX}${Date.now()}.json`;
  const response = await fetch(`https://blob.vercel-storage.com/${pathname}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-api-version": "7",
      "x-add-random-suffix": "0",
    },
    body: JSON.stringify(entry),
  });

  if (!response.ok) {
    throw new Error("could not save rsvp");
  }
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

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return response.status(503).json({ error: "rsvp is not available yet" });
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
    await saveRsvp(entry, token);
    const rsvps = await listRsvps(token);
    const emailed = await sendRsvpEmail(name, rsvps);

    if (!emailed) {
      return response.status(500).json({ error: "could not send email" });
    }

    return response.status(200).json({ ok: true, total: rsvps.length });
  } catch {
    return response.status(500).json({ error: "something went wrong" });
  }
}
