# 存款安全感测试

趣味心理测评网站：3 分钟测出你的「抗风险余量」，6 种存钱动物人格。

**线上地址：https://leipeng99-now.github.io/deposit-safety-test/**

- 前端：纯 HTML/CSS/JS（无框架、无构建），托管于 **GitHub Pages**
- 后端：**腾讯云 CloudBase**（国内直连），三级兜底：
  1. 云函数 `pwd`（代理 PG 数据网关，CORS 全放行）→ 主后端
  2. PG 数据网关（PostgREST 风格 REST + RPC）→ 备用
  3. Supabase / 本地计数 → 最后兜底

## 架构说明

```
浏览器 (GitHub Pages)
   │  POST text/plain（简单请求，无预检）
   ▼
CloudBase 云函数 pwd（HTTP 访问服务，自带 CORS: *）
   │  服务端 fetch（无跨域限制）
   ▼
CloudBase PG 数据网关 api.tcloudbasegateway.com
   │  Bearer Publishable Key（anon 角色）
   ▼
PostgreSQL：test_passwords 表 + consume_use 原子扣次函数 + RLS
```

- 密码明文只存在云端数据库，前端不再保存（防查看源码白嫖）
- 扣次使用数据库函数 `consume_use`，原子操作，并发不超卖
- 每个密码全局 3 次（换设备也无法重复使用）

## 本地运行

任意静态服务器即可，例如：

```bash
python -m http.server 8080
# 打开 http://localhost:8080
```

## 配置说明（config.js）

| 变量 | 作用 |
|---|---|
| `CLOUDBASE_API_BASE` | 云函数 HTTP 访问地址（主后端） |
| `PG_GATEWAY_BASE` + `PG_PUBLISHABLE_KEY` | PG 数据网关（备用直连） |
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Supabase（备用） |
| `PASSWORDS` | 本地兜底明文密码池，接入云端后保持为空 |

## 密码管理（云端操作）

在 CloudBase 控制台（tcb.cloud.tencent.com）SQL Editor 执行：

```sql
-- 新增密码
INSERT INTO public.test_passwords (code, max) VALUES ('CKAQ-XXXX', 3);
-- 作废密码（卖出去的）
UPDATE public.test_passwords SET active = false WHERE code = 'CKAQ-XXXX';
-- 补充次数
UPDATE public.test_passwords SET used = 0 WHERE code = 'CKAQ-XXXX';
```

命令行方式（本机装有 CloudBase CLI 并已登录）：

```bash
tcb db execute -e leipeng99-d8gq6j5dzb0a65db1 --sql "UPDATE public.test_passwords SET used=0 WHERE code='CKAQ-2601';"
```

## 更新云函数

修改 `cloudbase/functions/pwd/index.js` 后：

```bash
cd cloudbase/functions
tcb fn deploy pwd --dir ./pwd --path "/pwd" --force --runtime Nodejs18.15 -e leipeng99-d8gq6j5dzb0a65db1
```

## 部署到 GitHub Pages

1. 将本目录推送到 GitHub 仓库（仓库需为 **Public**，免费账户才能开 Pages）
2. 仓库 → Settings → Pages → Source 选 `Deploy from a branch` → 分支 `main` / 目录 `/ (root)` → Save
3. 访问 `https://<用户名>.github.io/<仓库名>/`
