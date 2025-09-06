// api/export.js
// 讀取 Airtable 資料並回傳 CSV 檔案
// 支援 GET 與 OPTIONS；可選 FORM_SECRET 驗證；已處理 Airtable 分頁 offset

export default async function handler(req, res) {
  // 若與前端不同網域，開啟下列 CORS 設定（也可在 vercel.json 設 headers）
  // res.setHeader('Access-Control-Allow-Origin', '*'); // 或指定網域
  // res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  // res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Form-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      AIRTABLE_TOKEN,
      AIRTABLE_BASE_ID = 'appqE0rzmU31PiLls',
      AIRTABLE_TABLE = 'tblmczoVSwI3p7CpD',
      AIRTABLE_VIEW, // 可選：若你想用特定視圖排序/過濾
      FORM_SECRET
    } = process.env;

    if (!AIRTABLE_TOKEN) {
      return res.status(500).json({ error: 'Server missing AIRTABLE_TOKEN' });
    }

    // 簡單保護（可選）
    if (FORM_SECRET) {
      const clientSecret = req.headers['x-form-secret'];
      if (clientSecret !== FORM_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // 可選 query：fields=className,studentNo,... 選擇要輸出的欄位順序
    // 可選 query：max=1000 限制最大筆數（避免過大 CSV）
    const urlObj = new URL(req.url, 'http://localhost'); // base 不重要
    const fieldsParam = urlObj.searchParams.get('fields');
    const maxParam = urlObj.searchParams.get('max');
    const maxRecords = maxParam ? Math.max(1, Math.min(5000, Number(maxParam) || 0)) : null;

    // 預設欄位順序（你可以調整）
    const defaultFields = [
      'className',
      'studentNo',
      'studentName',
      'score',
      'total',
      'percent',
      'submittedAt',
      'rawHTML'
    ];
    const fieldOrder = fieldsParam
      ? fieldsParam.split(',').map(s => s.trim()).filter(Boolean)
      : defaultFields;

    // 從 Airtable 取資料（含分頁）
    async function fetchPage(offset) {
      const apiUrl = new URL(`https://api.airtable.com/v0/${encodeURIComponent(AIRTABLE_BASE_ID)}/${encodeURIComponent(AIRTABLE_TABLE)}`);
      if (AIRTABLE_VIEW) apiUrl.searchParams.set('view', AIRTABLE_VIEW);
      if (offset) apiUrl.searchParams.set('offset', offset);
      // 你可在此加 filterByFormula, sort 等需求
      const upstream = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
      });
      const data = await upstream.json();
      if (!upstream.ok) throw new Error(data?.error?.message || 'Airtable fetch failed');
      return data;
    }

    const allRecords = [];
    let offset;
    do {
      const page = await fetchPage(offset);
      const recs = page.records || [];
      allRecords.push(...recs);
      offset = page.offset;
      if (maxRecords && allRecords.length >= maxRecords) {
        allRecords.length = maxRecords; // trim
        break;
      }
    } while (offset);

    // 轉 CSV
    function csvEscape(v) {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    // 將每筆的 fields 對齊 fieldOrder。若缺欄位則留空。
    const header = fieldOrder.join(',');
    const rows = allRecords.map(r => {
      const f = r.fields || {};
      return fieldOrder.map(k => {
        let val = f[k];
        if (typeof val === 'object' && val !== null) {
          // 將物件/陣列序列化（避免 [object Object]）
          val = Array.isArray(val) ? val.join('; ') : JSON.stringify(val);
        }
        return csvEscape(val);
      }).join(',');
    });

    const csv = [header, ...rows].join('\n');

    // 檔名加上日期
    const dateTag = new Date().toISOString().slice(0,10);
    const filename = `scores-${dateTag}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
