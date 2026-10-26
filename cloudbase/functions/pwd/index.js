/* ============================================================
   存款安全感测试 · 密码校验云函数（CloudBase / Node.js 18）
   ------------------------------------------------------------
   架构：云函数作为 PG 数据网关的代理
     浏览器 →(CORS:*)→ 本函数 →(服务端无跨域限制)→ PG 数据网关
   数据：PostgreSQL（test_passwords 表 + consume_use 原子扣次函数）
   接口（POST JSON，text/plain 亦可）：
     { action: "check",   code: "CKAQ-2601" }
     { action: "remain",  code: "CKAQ-2601" }
     { action: "consume", code: "CKAQ-2601", device: "xxx" }
   返回：
     check/remain → { ok:true, valid:true, remain:2 }
                    { ok:true, valid:false, reason:"wrong"|"exhausted" }
     consume      → { ok:true, valid:true, used:1, remain:1 }
                    { ok:true, valid:false, reason:"wrong"|"exhausted" }
   ============================================================ */

const ENV_ID = 'leipeng99-d8gq6j5dzb0a65db1';
const GATEWAY = 'https://' + ENV_ID + '.api.tcloudbasegateway.com';
/* Publishable Key 为公开密钥（映射 anon 角色，受 RLS 约束），可出现在函数代码中 */
const PUB_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjY2ZjVhNjAzLTQ4OTAtNDlhNy1iZTI2LTBjMTA4Y2MxNDQzMCJ9.eyJpc3MiOiJodHRwczovL2xlaXBlbmc5OS1kOGdxNmo1ZHpiMGE2NWRiMS5hcC1zaGFuZ2hhaS50Y2ItYXBpLnRlbmNlbnRjbG91ZGFwaS5jb20iLCJzdWIiOiJhbm9uIiwiYXVkIjoibGVpcGVuZzk5LWQ4Z3E2ajVkemIwYTY1ZGIxIiwiZXhwIjo0MDk2Njc0NzM1LCJpYXQiOjE3OTI5OTE1MzUsIm5vbmNlIjoiV0pqRndpQUJTcHFHOVp1OEZ2TkRvUSIsImF0X2hhc2giOiJXSmpGd2lBQlNwcUc5WnU4RnZORG9RIiwibmFtZSI6IkFub255bW91cyIsInNjb3BlIjoiYW5vbnltb3VzIiwicHJvamVjdF9pZCI6ImxlaXBlbmc5OS1kOGdxNmo1ZHpiMGE2NWRiMSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.UNBUWm4LftrWZwuRmQLLzWbF7kOAmC5PUp7tjfbzlLDmwka13m8lLoLoJTH7S1hZbpL46Q3XMbxPRU8YrBqi9h7JPVJXawzBumtLxNqePPp-D3l1BLEi5f2ZnMi7ufLcdjpKivQRkgXqGn6YJPzRR-0mv0_RwTAbxaRwXdaYD3p8jJupPw9vzuWFQUHok7yiIaSeRSc3y_qC5OYs1vlzrvGrgA0AOYewoj3dNRoi9ZYBDQPztuVIgreAD3vYAlQuyvuFAP-7vfhXJdLm3m3Wo9baCdWtbjqbeA2BesGoz4IKQiGu8OPIhxDyCi1v8-MPr7wci6aggGt3BR-_bNoXiw';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json; charset=utf-8'
};

function reply(obj, status) {
  return { statusCode: status || 200, headers: CORS, body: JSON.stringify(obj) };
}

function norm(code) {
  return String(code || '').trim().toUpperCase().slice(0, 40);
}

async function gw(path, opts) {
  const r = await fetch(GATEWAY + path, {
    method: (opts && opts.method) || 'GET',
    headers: { 'Authorization': 'Bearer ' + PUB_KEY, 'Content-Type': 'application/json' },
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!r.ok) throw new Error('gateway http ' + r.status);
  return r.json();
}

/* 校验：查密码行，判断有效性与剩余次数 */
async function handleCheck(code) {
  const rows = await gw('/v1/rdb/rest/test_passwords?code=eq.' + encodeURIComponent(code) + '&select=active,used,max');
  const row = rows && rows[0];
  if (!row || row.active === false) return { ok: true, valid: false, reason: 'wrong', remain: 0 };
  const remain = Math.max(0, (row.max || 3) - (row.used || 0));
  if (remain <= 0) return { ok: true, valid: false, reason: 'exhausted', remain: 0 };
  return { ok: true, valid: true, remain };
}

/* 扣次：调用数据库原子函数 consume_use（并发安全） */
async function handleConsume(code) {
  const d = await gw('/v1/rdb/rest/rpc/consume_use', { method: 'POST', body: { p_code: code } });
  if (!d || d.valid !== true) {
    return { ok: true, valid: false, reason: (d && d.reason) || 'wrong', remain: 0 };
  }
  return { ok: true, valid: true, used: d.used, remain: d.remain };
}

exports.main = async function (event) {
  event = event || {};

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  let payload = {};
  try {
    let raw = event.body;
    if (raw && typeof raw === 'object') {
      payload = raw;
    } else {
      if (event.isBase64Encoded && typeof raw === 'string') {
        raw = Buffer.from(raw, 'base64').toString('utf8');
      }
      payload = raw ? JSON.parse(raw) : {};
    }
  } catch (e) { payload = {}; }

  const qs = event.queryStringParameters || {};
  const action = String(payload.action || qs.action || 'check').toLowerCase();
  const code = norm(payload.code || qs.code);
  const device = String(payload.device || qs.device || '').slice(0, 64);

  if (!code) return reply({ ok: false, error: 'missing_code' }, 400);
  if (!PUB_KEY || PUB_KEY.indexOf('__') === 0) return reply({ ok: false, error: 'key_not_configured' }, 500);

  try {
    if (action === 'check') return reply(await handleCheck(code));

    if (action === 'remain') {
      const r = await handleCheck(code);
      return reply({ ok: true, valid: !!r.valid, remain: r.remain || 0, reason: r.reason });
    }

    if (action === 'consume') return reply(await handleConsume(code));

    return reply({ ok: false, error: 'unknown_action' }, 400);
  } catch (e) {
    return reply({ ok: false, error: String((e && e.message) || e) }, 500);
  }
};
