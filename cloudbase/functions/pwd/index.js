/* ============================================================
   存款安全感测试 · 密码校验云函数（CloudBase / Node.js 18）
   ------------------------------------------------------------
   作用：密码校验 + 次数扣减 + 全局计数（换设备也无法重复使用）
   接口（POST JSON，也可用 text/plain 发送避免跨域预检）：
     { action: "check",   code: "CKAQ-2601", device: "xxx" }
     { action: "remain",  code: "CKAQ-2601" }
     { action: "consume", code: "CKAQ-2601", device: "xxx" }
   返回：
     check   → { ok:true, valid:true,  remain:2 }
               { ok:true, valid:false, reason:"wrong"|"exhausted" }
     remain  → { ok:true, remain:2, valid:true }
     consume → { ok:true, valid:true, used:1, remain:1 }
               { ok:true, valid:false, reason:"wrong"|"exhausted" }
   ------------------------------------------------------------
   部署：CloudBase 控制台 → 云函数 → 新建云函数
         名称 pwd / 运行环境 Nodejs18 / 本文件内容粘进 index.js
         然后 → HTTP 访问服务 → 新增路径 /pwd → 指向该函数
   ============================================================ */

const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: cloudbase.DYNAMIC_CURRENT_ENV });
const db = app.database();
const _ = db.command;

const COL_PW = 'test_passwords';   // 密码表：{ code, active, used, max }
const COL_USE = 'test_usage';      // 使用流水：{ code, device, at }
const DEFAULT_MAX = 3;             // 每个密码默认可测次数

/* 首次运行自动播种的密码池（与 config.js 中的列表一致） */
const SEED_CODES = [
  'CKAQ-2601', 'CKAQ-2602', 'CKAQ-2603', 'CKAQ-2604', 'CKAQ-2605',
  'CKAQ-2606', 'CKAQ-2607', 'CKAQ-2608', 'CKAQ-2609', 'CKAQ-2610',
  'CKAQ-2611', 'CKAQ-2612', 'CKAQ-2613', 'CKAQ-2614', 'CKAQ-2615',
  'CKAQ-2616', 'CKAQ-2617', 'CKAQ-2618', 'CKAQ-2619', 'CKAQ-2620',
  'CKAQ-2621', 'CKAQ-2622', 'CKAQ-2623', 'CKAQ-2624', 'CKAQ-2625',
  'CKAQ-2626', 'CKAQ-2627', 'CKAQ-2628', 'CKAQ-2629', 'CKAQ-2630',
  'CKAQ-2631', 'CKAQ-2632', 'CKAQ-2633', 'CKAQ-2634', 'CKAQ-2635',
  'CKAQ-2636', 'CKAQ-2637', 'CKAQ-2638', 'CKAQ-2639', 'CKAQ-2640',
  'CKAQ-2641', 'CKAQ-2642', 'CKAQ-2643', 'CKAQ-2644', 'CKAQ-2645',
  'CKAQ-2646', 'CKAQ-2647', 'CKAQ-2648', 'CKAQ-2649', 'CKAQ-2650'
];

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

/* ---------- 初始化（建集合 + 播种密码） ---------- */
let inited = false;

async function ensureInit() {
  if (inited) return;
  inited = true; // 即便中途失败也不再重复尝试，避免每次请求都慢

  for (const name of [COL_PW, COL_USE]) {
    try { await db.createCollection(name); } catch (e) { /* 已存在则忽略 */ }
  }

  try {
    const c = await db.collection(COL_PW).count();
    if (!c || !c.total) {
      const now = Date.now();
      const tasks = SEED_CODES.map((code) =>
        db.collection(COL_PW)
          .add({ code, active: true, used: 0, max: DEFAULT_MAX, createdAt: now })
          .catch(() => null)
      );
      await Promise.all(tasks);
    }
  } catch (e) { /* 播种失败不影响已存在数据 */ }
}

/* ---------- 数据访问 ---------- */
async function getPwd(code) {
  const r = await db.collection(COL_PW).where({ code }).limit(1).get();
  return (r && r.data && r.data[0]) || null;
}

async function handleCheck(code) {
  const doc = await getPwd(code);
  if (!doc || doc.active === false) {
    return { ok: true, valid: false, reason: 'wrong', remain: 0 };
  }
  const max = typeof doc.max === 'number' ? doc.max : DEFAULT_MAX;
  const used = typeof doc.used === 'number' ? doc.used : 0;
  const remain = Math.max(0, max - used);
  if (remain <= 0) return { ok: true, valid: false, reason: 'exhausted', remain: 0 };
  return { ok: true, valid: true, remain };
}

async function handleConsume(code, device) {
  const doc = await getPwd(code);
  if (!doc || doc.active === false) {
    return { ok: true, valid: false, reason: 'wrong', remain: 0 };
  }
  const max = typeof doc.max === 'number' ? doc.max : DEFAULT_MAX;

  // 原子占用：仅当 used < max 时自增，避免并发超卖
  const up = await db
    .collection(COL_PW)
    .where({ code, used: _.lt(max) })
    .update({ used: _.inc(1) });

  const updated =
    (up && (up.updated || (up.stats && up.stats.updated))) || 0;

  if (!updated) {
    return { ok: true, valid: false, reason: 'exhausted', remain: 0 };
  }

  try {
    await db.collection(COL_USE).add({
      code,
      device: device || '',
      at: Date.now()
    });
  } catch (e) { /* 流水记录失败不影响扣次结果 */ }

  const used = (typeof doc.used === 'number' ? doc.used : 0) + 1;
  return { ok: true, valid: true, used, remain: Math.max(0, max - used) };
}

/* ---------- 入口 ---------- */
exports.main = async function (event) {
  event = event || {};

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  // 解析请求体（兼容 HTTP 访问服务的 base64 包装）
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
  } catch (e) {
    payload = {};
  }

  // 也支持 GET ?action=check&code=xxx 形式，便于浏览器直接测试
  const qs = event.queryStringParameters || {};
  const action = String(payload.action || qs.action || 'check').toLowerCase();
  const code = String(payload.code || qs.code || '').trim().toUpperCase();
  const device = String(payload.device || qs.device || '').slice(0, 64);

  if (!code) return reply({ ok: false, error: 'missing_code' }, 400);
  if (code.length > 40) return reply({ ok: false, error: 'bad_code' }, 400);

  try {
    await ensureInit();

    if (action === 'check') return reply(await handleCheck(code));

    if (action === 'remain') {
      const r = await handleCheck(code);
      return reply({ ok: true, valid: !!r.valid, remain: r.remain || 0, reason: r.reason });
    }

    if (action === 'consume') return reply(await handleConsume(code, device));

    return reply({ ok: false, error: 'unknown_action' }, 400);
  } catch (e) {
    return reply({ ok: false, error: String((e && e.message) || e) }, 500);
  }
};
