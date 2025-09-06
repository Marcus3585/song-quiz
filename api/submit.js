// api/submit.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || 'Result';
  if (!token || !baseId) return res.status(500).json({ error: 'Missing Airtable config' });

  const { className, studentNo, studentName, score, total, percent, submittedAt, rawHTML } = req.body || {};
  if (!className || !studentNo || typeof score !== 'number' || typeof total !== 'number') {
    return res.status(400).json({ error: 'Missing required fields: className, studentNo, score, total' });
  }

  try {
    const r = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: {
            className,
            studentNo,
            studentName: studentName || '',
            score,
            total,
            percent,
            submittedAt: submittedAt || new Date().toISOString(),
            rawHTML: rawHTML || ''
          }
        }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data.error?.message || 'Airtable insert failed', detail: data });
    }
    return res.status(200).json({ ok: true, id: data.records?.[0]?.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
