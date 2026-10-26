/* ============================================================
   密码池配置
   ------------------------------------------------------------
   ⚠️ 接入云端后端后，密码只存在云端数据库（test_passwords 表），
   前端不再保存明文列表，防止查看源码白嫖。
   前端 PASSWORDS 数组仅作「云端不可达时」的最后兜底，保持为空。
   密码管理请在 CloudBase 控制台操作（tcb.cloud.tencent.com）：
     - 新增密码：SQL Editor 执行
         INSERT INTO public.test_passwords (code, max) VALUES ('CKAQ-XXXX', 3);
     - 作废密码：UPDATE public.test_passwords SET active = false WHERE code = 'CKAQ-XXXX';
     - 补充次数：UPDATE public.test_passwords SET used = 0 WHERE code = 'CKAQ-XXXX';
   ============================================================ */

const PASSWORDS = [];

const MAX_USES_PER_DEVICE = 3;

/* ============================================================
   腾讯云开发 CloudBase 配置（主后端，国内直连）
   ------------------------------------------------------------
   CLOUDBASE_API_BASE = 云函数「pwd」的 HTTP 访问服务地址
   形如：
     https://leipeng99-d8gq6j5dzb0a65db1-1234567890.ap-shanghai.app.tcloudbase.com/pwd
   填入后：密码校验 / 次数统计全部走 CloudBase 云端，全设备统一计数。
   此时前端不再需要密码明文列表（PASSWORDS 可清空），密码更安全。
   ============================================================ */
const CLOUDBASE_ENV_ID = "leipeng99-d8gq6j5dzb0a65db1";
const CLOUDBASE_API_BASE = "https://leipeng99-d8gq6j5dzb0a65db1.service.tcloudbase.com/pwd";

/* ============================================================
   CloudBase PostgreSQL 数据网关（主后端，国内直连）
   ------------------------------------------------------------
   PG_PUBLISHABLE_KEY = CloudBase 控制台的 Publishable Key（公开密钥，
   等同 Supabase anon key，映射为数据库 anon 角色，受 RLS 约束，可放前端）
   获取：控制台 → 环境管理/身份认证 → API 密钥
     https://tcb.cloud.tencent.com/dev?envId=leipeng99-d8gq6j5dzb0a65db1#/env/apikey
   ============================================================ */
const PG_GATEWAY_BASE = "https://leipeng99-d8gq6j5dzb0a65db1.api.tcloudbasegateway.com";
const PG_PUBLISHABLE_KEY = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjY2ZjVhNjAzLTQ4OTAtNDlhNy1iZTI2LTBjMTA4Y2MxNDQzMCJ9.eyJpc3MiOiJodHRwczovL2xlaXBlbmc5OS1kOGdxNmo1ZHpiMGE2NWRiMS5hcC1zaGFuZ2hhaS50Y2ItYXBpLnRlbmNlbnRjbG91ZGFwaS5jb20iLCJzdWIiOiJhbm9uIiwiYXVkIjoibGVpcGVuZzk5LWQ4Z3E2ajVkemIwYTY1ZGIxIiwiZXhwIjo0MDk2Njc0NzM1LCJpYXQiOjE3OTI5OTE1MzUsIm5vbmNlIjoiV0pqRndpQUJTcHFHOVp1OEZ2TkRvUSIsImF0X2hhc2giOiJXSmpGd2lBQlNwcUc5WnU4RnZORG9RIiwibmFtZSI6IkFub255bW91cyIsInNjb3BlIjoiYW5vbnltb3VzIiwicHJvamVjdF9pZCI6ImxlaXBlbmc5OS1kOGdxNmo1ZHpiMGE2NWRiMSIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJyb2xlIjoiYW5vbiIsImlzX2Fub255bW91cyI6dHJ1ZSwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6eyJuYW1lIjoiQW5vbnltb3VzIn0sInVzZXJfdHlwZSI6IiIsImNsaWVudF90eXBlIjoiY2xpZW50X3VzZXIiLCJpc19zeXN0ZW1fYWRtaW4iOmZhbHNlfQ.UNBUWm4LftrWZwuRmQLLzWbF7kOAmC5PUp7tjfbzlLDmwka13m8lLoLoJTH7S1hZbpL46Q3XMbxPRU8YrBqi9h7JPVJXawzBumtLxNqePPp-D3l1BLEi5f2ZnMi7ufLcdjpKivQRkgXqGn6YJPzRR-0mv0_RwTAbxaRwXdaYD3p8jJupPw9vzuWFQUHok7yiIaSeRSc3y_qC5OYs1vlzrvGrgA0AOYewoj3dNRoi9ZYBDQPztuVIgreAD3vYAlQuyvuFAP-7vfhXJdLm3m3Wo9baCdWtbjqbeA2BesGoz4IKQiGu8OPIhxDyCi1v8-MPr7wci6aggGt3BR-_bNoXiw";

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
