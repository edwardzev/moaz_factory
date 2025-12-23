export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }

  const { url, filename } = req.query || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url" });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid url" });
  }

  // Prevent this endpoint from becoming an open proxy.
  const allowedHosts = new Set([
    "dl.airtable.com",
    "airtableusercontent.com",
    "v5.airtableusercontent.com",
    "v6.airtableusercontent.com",
  ]);

  const host = parsed.hostname;
  const isAllowed = allowedHosts.has(host) || host.endsWith(".airtableusercontent.com");
  if (!isAllowed) {
    return res.status(400).json({ error: "Host not allowed" });
  }

  const upstream = await fetch(parsed.toString());
  if (!upstream.ok) {
    const text = await upstream.text();
    return res.status(upstream.status).json({ error: text });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  const safeName = typeof filename === "string" && filename.trim() ? filename.trim() : "download";

  const buf = Buffer.from(await upstream.arrayBuffer());

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${safeName.replace(/"/g, "")}"`);
  res.status(200).send(buf);
}
