// AWS Lambda (Function URL) collector for AFTERHOURS usage events.
// Validates each event against an allowlist and stores it in DynamoDB.
// Events never contain personal data; see afterhours/src/analytics/events.ts.

const ALLOWED = new Set([
  'session_start', 'preset_changed', 'randomize', 'edit_text', 'edit_color',
  'edit_motion', 'audio_loaded', 'audio_play', 'export_png', 'save_design', 'load_design',
]);

/** Returns a clean event or null if the payload is not a valid AFTERHOURS event. */
export function validateEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { name, ts, session, prop } = raw;
  if (!ALLOWED.has(name)) return null;
  if (!Number.isFinite(ts) || ts < 0) return null;
  if (typeof session !== 'string' || !/^[0-9a-f]{12}$/.test(session)) return null;
  if (prop !== undefined && (typeof prop !== 'string' || prop.length > 32)) return null;
  return { name, ts, session, ...(prop ? { prop } : {}) };
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/** `put` is injectable so the handler can be tested without AWS. */
export function createHandler(put) {
  return async (event) => {
    if (event.requestContext?.http?.method !== 'POST') return json(405, { error: 'POST only' });
    if ((event.body ?? '').length > 1024) return json(413, { error: 'too large' });
    let parsed;
    try {
      parsed = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body);
    } catch {
      return json(400, { error: 'invalid json' });
    }
    const clean = validateEvent(parsed);
    if (!clean) return json(400, { error: 'invalid event' });
    await put(clean);
    return json(204, {});
  };
}

let defaultPut;
export const handler = async (event) => {
  if (!defaultPut) {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, PutCommand } = await import('@aws-sdk/lib-dynamodb');
    const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    defaultPut = (e) =>
      doc.send(new PutCommand({ TableName: process.env.TABLE_NAME, Item: { ...e, pk: e.session, sk: `${e.ts}#${e.name}` } }));
  }
  return createHandler(defaultPut)(event);
};
