export const config = {
  runtime: "nodejs18.x",
};

const BASE_ID = "appgJ2DCTbxQLzK2S";
const TABLE_ID = "tbl0qSi9cbJUSa5JV";
const VIEW_ID  = "viwzYAf6jxP7EInCl";

export default async function handler(req, res) {
  const url =
    `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?view=${VIEW_ID}`;

  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
    },
  });

  const text = await r.text();

  return res.status(200).send(text);
}
