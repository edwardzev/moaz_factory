export default async function handler(req, res) {
  const r = await fetch("https://api.airtable.com/v0/meta/bases", {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
    },
  });

  const data = await r.json();
  return res.status(r.status).json(data);
}
