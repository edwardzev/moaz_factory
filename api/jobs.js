export default async function handler(req, res) {
  return res.json({
    hasToken: Boolean(process.env.AIRTABLE_TOKEN),
    tokenLength: process.env.AIRTABLE_TOKEN
      ? process.env.AIRTABLE_TOKEN.length
      : 0,
    tokenPrefix: process.env.AIRTABLE_TOKEN
      ? process.env.AIRTABLE_TOKEN.slice(0, 6)
      : null,
  });
}
