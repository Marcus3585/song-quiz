// api/submit.js
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const {
      AIRTABLE_TOKEN,
      AIRTABLE_BASE_ID = 'appqE0rzmU31PiLls',
      AIRTABLE_TABLE = 'tblmczoVSwI3p7CpD'
    } = process.env;

    if (!AIRTABLE_TOKEN) return res.status(500).json({ error: 'Server missing AIRTABLE_TOKEN' });

    const body = req.body || {};
    // 允許直接丟 fields；若你想丟 Airtable 原生格式，也可以把物件放在 {fields: {...}}
    const payload = body?.fields ? body : { records: [{ fields: body }] };

    const url = `https://api.airtable.com/v0/${encodeURIComponent(AIRTABLE_BASE_ID)}/${encodeURIComponent(AIRTABLE_TABLE)}`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.error || data });
    }

    res.status(200).json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
