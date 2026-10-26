# 存款安全感测试

趣味心理测评网站：3 分钟测出你的「抗风险余量」，6 种存钱动物人格。

**线上地址：https://leipeng99-now.github.io/deposit-safety-test/**

- 前端：纯 HTML/CSS/JS（无框架、无构建），托管于 **GitHub Pages**
- 后端：**Supabase**（密码校验 + 次数统计，Postgres + RPC），不可达时自动降级为本地计数

## 本地运行

任意静态服务器即可，例如：

```bash
python -m http.server 8080
# 打开 http://localhost:8080
```

## 配置 Supabase

1. 在 [supabase.com](https://supabase.com) 创建项目
2. 打开 `supabase-setup.sql`，把全部内容粘贴到 Supabase 控制台 → SQL Editor → Run
3. 复制 Project URL 和 anon key，填入 `config.js`：

```js
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

> 两项留空时，网站自动回退为本地浏览器计数模式（按设备限制次数）。

## 部署到 GitHub Pages

1. 将本目录推送到 GitHub 仓库（仓库需为 **Public**，免费账户才能开 Pages）
2. 仓库 → Settings → Pages → Source 选 `Deploy from a branch` → 分支 `main` / 目录 `/ (root)` → Save
3. 访问 `https://<用户名>.github.io/<仓库名>/`

## 密码管理

- 密码池在两处保持一致：`config.js`（前端校验用）和 Supabase `test_passwords` 表
- **作废密码**：`update test_passwords set active = false where code = 'CKAQ-2601';`
- **新增密码**：`insert into test_passwords (code) values ('CKAQ-2701');` 并同步加进 `config.js`
- 每个密码每设备 3 次，次数记录在 Supabase `password_usage` 表

## 合规说明

本测试仅供娱乐与自我探索参考，不构成任何财务建议。
