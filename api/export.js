// api/export.js
function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.map(esc).join(','),
    ...rows.map(r => headers.map(h => esc(r[h])).join(','))
  ];
  return lines.join('\n');
}

export default async function handler(req, res) {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || 'Result';
  const guard = process.env.EXPORT_SECRET;

  if (!token || !baseId) return res.status(500).json({ error: 'Missing Airtable config' });
  if (guard && req.query.key !== guard) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
    let records = [];
    let offset;

    do {
      const url = new URL(baseUrl);
      url.searchParams.set('pageSize', '100');
      if (offset) url.searchParams.set('offset', offset);

      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data.error?.message || 'Fetch failed' });

      records = records.concat(data.records || []);
      offset = data.offset;
    } while (offset);

    const rows = records.map(rec => {
      const f = rec.fields || {};
      return {
        id: rec.id,
        className: f.className || '',
        studentNo: f.studentNo || '',
        studentName: f.studentName || '',
        score: f.score ?? '',
        total: f.total ?? '',
        percent: f.percent ?? '',
        submittedAt: f.submittedAt || ''
      };
    });

    const csv = toCSV(rows);
    const filename = `quiz-results-${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
