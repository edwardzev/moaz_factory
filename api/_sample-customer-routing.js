export const CLIENT_LINK_FIELD_NAME = "Client name";
export const PRINTEAM_CLIENT_RECORD_ID = "recNzGCe4tTdO2oWM";
export const SAMPLE_ORGANIZATION_ID = "09d85881-0acf-4ffc-a73a-70e93a45a2e8";
export const PM_SAMPLE_LINE_ID = "6befab5d-10e9-40f3-bbb4-6756a56f7e4d";
export const PRINTEAM_SAMPLE_LINE_ID = "fd6c90a8-3316-4283-9eb3-6e434054b668";
export const SAMPLE_SUBMISSION_PROTOCOL = "moaz-sample-routing-v4";

const routes = Object.freeze({
  pm: Object.freeze({ sender: "pm", lineId: PM_SAMPLE_LINE_ID, phone: "972559664485" }),
  printeam: Object.freeze({ sender: "printeam", lineId: PRINTEAM_SAMPLE_LINE_ID, phone: "972503969640" }),
});

function unavailable(message) {
  const error = new Error(message);
  error.statusCode = 409;
  throw error;
}

export function sampleCustomerRoute(fields) {
  const clients = fields?.[CLIENT_LINK_FIELD_NAME];
  if (!Array.isArray(clients) || !clients.length || clients.some(id => typeof id !== "string" || !/^rec[A-Za-z0-9]{14}$/.test(id))) {
    unavailable("The order has no verifiable linked Client name. Review the customer before sending a sample.");
  }
  if (clients.includes(PRINTEAM_CLIENT_RECORD_ID)) {
    if (clients.length !== 1) unavailable("The order links Printeam and another Client name. Review the customer before sending a sample.");
    return routes.printeam;
  }
  return routes.pm;
}
