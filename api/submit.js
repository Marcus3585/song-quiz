export default async function handler(req, res) {
  // 預處理 CORS（若與前端不同網域，可打開）
  // res.setHeader('Access-Control-Allow-Origin', '*'); // 或指定網域
  // res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  // res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Form-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      AIRTABLE_TOKEN,
      AIRTABLE_BASE_ID = 'appqE0rzmU31PiLls',
      AIRTABLE_TABLE = 'tblmczoVSwI3p7CpD',
      FORM_SECRET
    } = process.env;

    if (!AIRTABLE_TOKEN) {
      return res.status(500).json({ error: 'Server missing AIRTABLE_TOKEN' });
    }

    // 簡單保護（可選）
    const clientSecret = req.headers['x-form-secret'];
    if (FORM_SECRET && clientSecret !== FORM_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 解析 body
    const contentType = req.headers['content-type'] || '';
    let body = {};
    if (contentType.includes('application/json')) {
      body = req.body;
    } else {
      const txt = await new Promise(resolve => {
        let data = '';
        req.on('data', c => (data += c));
        req.on('end', () => resolve(data));
      });
      try { body = JSON.parse(txt); } catch { body = {}; }
    }

    // 支援兩種格式：直接 fields 或 Airtable 原生格式
    const payload = body?.fields
      ? body
      : { records: [{ fields: body }] };

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
