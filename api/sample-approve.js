import {
  JOB_ID_FIELD_NAME,
  MAIN_FLOW_FIELD_NAME,
  SAMPLE_APPROVED_FIELD_NAME,
  SAMPLE_APPROVED_MAIN_FLOW_VALUE,
  htmlEscape,
  patchAirtableRecord,
  readAirtableRecord,
  verifyApprovalToken,
} from "./_sample-utils.js";

function page({ title, body, token = "", confirm = false }) {
  const safeTitle = htmlEscape(title);
  const safeToken = htmlEscape(token);
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${safeTitle}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 20px; box-sizing: border-box; background: #f4f7fb; color: #172033; }
    main { width: min(440px, 100%); box-sizing: border-box; padding: 28px; border: 1px solid #dbe3ee; border-radius: 16px; background: #fff; box-shadow: 0 16px 44px rgba(15, 23, 42, .12); text-align: center; }
    h1 { margin: 0 0 12px; font-size: 28px; }
    p { margin: 0 0 22px; color: #526178; font-size: 18px; line-height: 1.55; }
    button { width: 100%; min-height: 52px; border: 0; border-radius: 10px; background: #165dff; color: #fff; font-size: 18px; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    <p>${body}</p>
    ${confirm ? `<form method="post" action="/api/sample-approve?token=${safeToken}"><button type="submit">אישור הדוגמה</button></form>` : ""}
  </main>
</body>
</html>`;
}
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");

  try {
    const requestUrl = new URL(req.url, "http://localhost");
    const token = requestUrl.searchParams.get("token") || "";
    const approval = verifyApprovalToken(token);
    const record = await readAirtableRecord(approval.recordId, [JOB_ID_FIELD_NAME]);
    const currentJobId = String(record?.fields?.[JOB_ID_FIELD_NAME] ?? "");
    if (!currentJobId || currentJobId !== approval.jobId) {
      return res.status(409).send(page({
        title: "לא ניתן לאשר",
        body: "קישור האישור אינו תואם להזמנה.",
      }));
    }

    if (req.method === "GET") {
      return res.status(200).send(page({
        title: `אישור דוגמה להזמנה ${htmlEscape(currentJobId)}`,
        body: "יש ללחוץ על הכפתור כדי לאשר את הדוגמה לייצור.",
        token,
        confirm: true,
      }));
    }

    await patchAirtableRecord(approval.recordId, {
      [SAMPLE_APPROVED_FIELD_NAME]: true,
      [MAIN_FLOW_FIELD_NAME]: SAMPLE_APPROVED_MAIN_FLOW_VALUE,
    });

    return res.status(200).send(page({
      title: "הדוגמה אושרה",
      body: `תודה. הזמנה ${htmlEscape(currentJobId)} הועברה לשלב הבא.`,
    }));
  } catch (error) {
    return res.status(error?.statusCode || 400).send(page({
      title: "לא ניתן לאשר",
      body: htmlEscape(error?.message || "קישור האישור אינו תקין."),
    }));
  }
}
