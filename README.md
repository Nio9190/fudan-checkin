# 复旦暑托班考勤打卡系统 · 部署说明

## 三个文件的作用

| 文件 | 作用 |
|------|------|
| `index.html` | 打卡页面（志愿者/班主任用手机打卡） |
| `admin.html` | 后台管理页（Jason 查看统计、导出 CSV） |
| `form.html` | 旧确认页，保留但不影响新流程 |
| `worker.js` | Cloudflare Worker 后端代码 |
| `wrangler.toml` | Cloudflare Worker 部署配置 |

## 当前问题

之前打卡数据只存在手机浏览器本地，没有统一后台。现在通过 Cloudflare Worker + KV 实现真正的后台存储。

## 部署步骤

### 1. 注册/登录 Cloudflare

访问 https://workers.cloudflare.com/ ，用已有账号或注册新账号。

### 2. 安装 wrangler 命令行工具

```bash
npm install -g wrangler
```

### 3. 登录 wrangler

```bash
wrangler login
```

按提示授权浏览器登录。

### 4. 创建 KV 命名空间

```bash
cd 考勤打卡目录
wrangler kv:namespace create "ATTENDANCE_KV"
```

命令会输出类似：

```
{ binding = "ATTENDANCE_KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

把 `id` 复制到 `wrangler.toml` 里的 `id = "YOUR_KV_NAMESPACE_ID"` 位置。

### 5. 部署 Worker

```bash
wrangler deploy
```

部署成功后，会显示 Worker URL，例如：

```
https://fudan-checkin-backend.YOUR_SUBDOMAIN.workers.dev
```

把这个 URL 复制下来。

### 6. 更新 index.html 里的 API 地址

打开 `index.html`，找到这一行：

```javascript
const API_ENDPOINT = 'https://fudan-checkin-backend.YOUR_SUBDOMAIN.workers.dev';
```

把 `YOUR_SUBDOMAIN` 替换成真实的子域名，例如：

```javascript
const API_ENDPOINT = 'https://fudan-checkin-backend.jason123.workers.dev';
```

### 7. 推送到 GitHub Pages

```bash
git add .
git commit -m "add Cloudflare Worker backend and admin dashboard"
git push origin main
```

等待 1-2 分钟，GitHub Pages 自动更新。

### 8. 测试后台

1. 用手机打卡一次
2. 在浏览器打开：`https://nio9190.github.io/fudan-checkin/admin.html`
3. 填入 Worker URL，点击"刷新数据"
4. 应该能看到刚打的记录

## 后台管理页地址

```
https://nio9190.github.io/fudan-checkin/admin.html
```

打开后填入 Worker URL 即可查看：
- 实时总签到/签退数
- 按日期统计
- 按校区统计
- 按姓名统计
- 完整打卡记录表
- 导出 CSV

## 注意事项

1. Worker 免费额度：每天 10 万次请求，完全够用。
2. KV 免费额度：每天 10 万次读取，1 千次写入，1 千次删除，够用。
3. 如果以后需要换 Worker URL，只改 `index.html` 里的 `API_ENDPOINT` 和 `admin.html` 里填的地址即可。
4. 打卡页 UI 未做任何改动，只加了数据同步。
