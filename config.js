/* ============================================================
   存款安全感测试 · 密码池配置
   ------------------------------------------------------------
   使用说明（卖家操作手册）：
   1. 下面 PASSWORDS 数组里是所有可售密码，每个密码每台设备可测 3 次
   2. 卖出一个密码后，把它从数组里删除（或移到 SOLD 注释区），
      重新上传/发布网站即可作废该密码
   3. 用户端次数记录存在用户自己的浏览器里（按设备计数）
   ============================================================ */

const PASSWORDS = [
  "CKAQ-2601", "CKAQ-2602", "CKAQ-2603", "CKAQ-2604", "CKAQ-2605",
  "CKAQ-2606", "CKAQ-2607", "CKAQ-2608", "CKAQ-2609", "CKAQ-2610",
  "CKAQ-2611", "CKAQ-2612", "CKAQ-2613", "CKAQ-2614", "CKAQ-2615",
  "CKAQ-2616", "CKAQ-2617", "CKAQ-2618", "CKAQ-2619", "CKAQ-2620",
  "CKAQ-2621", "CKAQ-2622", "CKAQ-2623", "CKAQ-2624", "CKAQ-2625",
  "CKAQ-2626", "CKAQ-2627", "CKAQ-2628", "CKAQ-2629", "CKAQ-2630",
  "CKAQ-2631", "CKAQ-2632", "CKAQ-2633", "CKAQ-2634", "CKAQ-2635",
  "CKAQ-2636", "CKAQ-2637", "CKAQ-2638", "CKAQ-2639", "CKAQ-2640",
  "CKAQ-2641", "CKAQ-2642", "CKAQ-2643", "CKAQ-2644", "CKAQ-2645",
  "CKAQ-2646", "CKAQ-2647", "CKAQ-2648", "CKAQ-2649", "CKAQ-2650"
];

/* 已售出/作废的密码放这里留档（不参与验证）：
   已售：CKAQ-2601（2026-10-26 售出）
   */

const MAX_USES_PER_DEVICE = 3;

/* ============================================================
   Supabase 云端配置（后端数据库）
   ------------------------------------------------------------
   填入你的 Supabase 项目信息后，密码校验和次数统计走云端，
   全设备通用（换手机/换电脑也无法重复使用同一密码）。
   两项都留空 "" 时，自动回退为本地浏览器计数模式。

   获取方式：Supabase 控制台 → Project Settings → API
     - URL        → Project URL
     - anon key   → Project API Keys 中的 anon / public key
   ============================================================ */
const SUPABASE_URL = "https://iynbkzagrvssmznizjjz.supabase.co";
const SUPABASE_ANON_KEY = "eyBmnJwpHrIDXwF3VgWzCsB9zIJ0ZsiOXBP5.btQdn2EfKcQisTYqVvKnXTPcQsLhAjG8Lgx6diXjwnTiejXuf737foa3bkc1Dzfvbd0yHYO0DdDir80fATDdXSGvNaW2KDC2VZX9FqUdBbA5iBM2YpQaGHQ9Hpy8TN7";
