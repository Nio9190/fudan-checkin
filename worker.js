// Cloudflare Worker — 复旦暑托班考勤打卡后端
// 接收打卡页 POST 数据，存储到 KV，并提供后台查询接口
//
// 部署步骤：
// 1. 在 Cloudflare 创建 Worker
// 2. 创建 KV Namespace，命名为 ATTENDANCE_KV
// 3. 在 Worker Settings → Variables 中绑定 ATTENDANCE_KV
// 4. 把本文件内容粘贴到 Worker 编辑器
// 5. 保存并部署，获得 Worker URL
// 6. 把 index.html 里的 API_ENDPOINT 改为该 Worker URL

const CORS_ORIGIN = 'https://nio9190.github.io'; // 允许 GitHub Pages 调用

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // 或 CORS_ORIGIN
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 统一封装带 CORS 的响应
    function jsonResponse(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // ============================================================
      // POST /api/record — 接收一条打卡记录
      // ============================================================
      if (url.pathname === '/api/record' && request.method === 'POST') {
        const record = await request.json();

        // 基础校验
        if (!record.type || !record.name || !record.campus) {
          return jsonResponse({ ok: false, error: '缺少必要字段：type/name/campus' }, 400);
        }

        // 补全服务端字段
        record._serverReceivedAt = new Date().toISOString();
        if (!record.id) record.id = Date.now() + '-' + Math.random().toString(36).slice(2, 8);

        const kv = env.ATTENDANCE_KV;
        const key = 'records';

        // 读取现有记录，追加新记录
        let records = [];
        const existing = await kv.get(key, 'text');
        if (existing) {
          try { records = JSON.parse(existing); } catch (e) { records = []; }
        }
        records.push(record);

        await kv.put(key, JSON.stringify(records));

        return jsonResponse({ ok: true, id: record.id });
      }

      // ============================================================
      // GET /api/records — 查询所有记录（支持按日期筛选）
      // ============================================================
      if (url.pathname === '/api/records' && request.method === 'GET') {
        const dateFilter = url.searchParams.get('date'); // 可选：YYYY-MM-DD
        const kv = env.ATTENDANCE_KV;
        const raw = await kv.get('records', 'text');
        let records = [];
        if (raw) {
          try { records = JSON.parse(raw); } catch (e) { records = []; }
        }

        // 按时间倒序
        records.sort((a, b) => new Date(b.time || b._serverReceivedAt) - new Date(a.time || a._serverReceivedAt));

        if (dateFilter) {
          records = records.filter(r => (r.date || r._serverReceivedAt?.slice(0, 10)) === dateFilter);
        }

        return jsonResponse({ ok: true, count: records.length, records });
      }

      // ============================================================
      // GET /api/stats — 按日期/校区/姓名统计
      // ============================================================
      if (url.pathname === '/api/stats' && request.method === 'GET') {
        const kv = env.ATTENDANCE_KV;
        const raw = await kv.get('records', 'text');
        let records = [];
        if (raw) {
          try { records = JSON.parse(raw); } catch (e) { records = []; }
        }

        const total = records.length;
        const checkin = records.filter(r => r.type === '签到').length;
        const checkout = records.filter(r => r.type === '签退').length;

        // 按日期统计
        const byDate = {};
        records.forEach(r => {
          const d = r.date || r._serverReceivedAt?.slice(0, 10) || 'unknown';
          if (!byDate[d]) byDate[d] = { total: 0, checkin: 0, checkout: 0 };
          byDate[d].total++;
          if (r.type === '签到') byDate[d].checkin++;
          if (r.type === '签退') byDate[d].checkout++;
        });

        // 按校区统计
        const byCampus = {};
        records.forEach(r => {
          const c = r.campusName || r.campus || 'unknown';
          if (!byCampus[c]) byCampus[c] = { total: 0, checkin: 0, checkout: 0 };
          byCampus[c].total++;
          if (r.type === '签到') byCampus[c].checkin++;
          if (r.type === '签退') byCampus[c].checkout++;
        });

        // 按姓名统计（最近10天）
        const byName = {};
        records.forEach(r => {
          if (!r.name) return;
          if (!byName[r.name]) byName[r.name] = { total: 0, checkin: 0, checkout: 0 };
          byName[r.name].total++;
          if (r.type === '签到') byName[r.name].checkin++;
          if (r.type === '签退') byName[r.name].checkout++;
        });

        return jsonResponse({
          ok: true,
          total,
          checkin,
          checkout,
          byDate,
          byCampus,
          byName,
        });
      }

      // 健康检查
      if (url.pathname === '/' && request.method === 'GET') {
        return jsonResponse({ ok: true, message: '复旦暑托班考勤后端运行中' });
      }

      return jsonResponse({ ok: false, error: 'Not found' }, 404);
    } catch (err) {
      console.error('Worker error:', err);
      return jsonResponse({ ok: false, error: err.message }, 500);
    }
  },
};
