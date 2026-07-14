# Ubuntu 云服务器与 App 后端部署说明

本文档根据课程提供的交大云 Ubuntu/Debian 上机操作手册整理，面向 ueat Android App 技术原型部署。目标是让 App 可以访问云服务器上的后端 API 和 WebSocket 服务。

## 1. 云主机创建要求

按课程手册创建一台 Ubuntu 云主机即可，本项目推荐：

- 镜像：Ubuntu 22.04 或 Ubuntu 24.04。
- 规格：可用区 B，基础款-通用型-教学，4 核，16GB。
- 网络：创建私有网络 `net`，云主机 IPv4 选择该网络。
- 浮动 IP：申请校园网浮动 IP，并绑定到云主机。
- 登录方式：优先 SSH，命令格式为：

```bash
ssh root@云主机浮动IP
```

校外访问时，先连接交大 VPN。

## 2. 端口策略

课程云主机默认安全组只放行：

```text
22   SSH
80   HTTP
443  HTTPS
3389 RDP
```

因此本项目推荐部署方式是：

```text
Android App -> http://浮动IP/api -> Nginx:80 -> Node 后端:3000
Android App -> ws://浮动IP/socket.io -> Nginx:80 -> Socket.IO/WebSocket:3000
```

Node.js 后端可以监听服务器本机 `3000` 端口，但不要让 App 直接访问 `浮动IP:3000`，除非你已经在安全组里额外放行 3000。

## 3. 推荐方案：Nginx 反向代理

优点：

- 使用默认开放的 80 端口。
- 不需要额外改安全组。
- 后续加 HTTPS 更顺滑。
- App 的 API 地址更干净。

前端环境变量建议：

```text
VITE_API_BASE_URL=http://浮动IP/api
VITE_WS_URL=ws://浮动IP
VITE_APP_TARGET=capacitor
```

如果临时不想配置 Nginx，也可以在安全组中额外放行 `3000`，然后使用 `http://浮动IP:3000`。但这只建议调试使用。

## 4. Ubuntu 基础软件安装

登录云主机后执行：

```bash
apt update
apt install -y curl git nginx
```

安装 Node.js LTS：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
npm -v
```

如果使用 PostgreSQL：

```bash
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql
```

## 5. 后端服务部署建议

建议后端目录为：

```text
server/
  src/
  package.json
  .env
```

最小后端应先提供：

```text
GET /health
GET /meal-cards
POST /meal-cards
```

后端监听本机端口：

```text
127.0.0.1:3000 或 0.0.0.0:3000
```

如果使用 Nginx 反代，推荐只让 Nginx 面向外部暴露 80/443。

## 6. Nginx 反向代理示例

创建配置：

```bash
nano /etc/nginx/sites-available/ueat
```

示例内容：

```nginx
server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

启用配置：

```bash
ln -s /etc/nginx/sites-available/ueat /etc/nginx/sites-enabled/ueat
nginx -t
systemctl reload nginx
```

测试：

```bash
curl http://浮动IP/api/health
```

## 7. App 前端环境变量

在 `web/` 下复制环境文件：

```bash
cp .env.example .env.production
```

推荐填写：

```text
VITE_API_BASE_URL=http://浮动IP/api
VITE_WS_URL=ws://浮动IP
VITE_APP_TARGET=capacitor
```

注意：

- App 打包后不能使用 `localhost`。
- 如果后端接口使用 HTTP，Android 可能需要允许明文网络访问；后续最好配置 HTTPS。
- 如果 API 走 Nginx `/api` 前缀，后端路由和代理路径要提前约定清楚。

## 8. App 打包与服务器联调顺序

推荐顺序：

1. 云主机创建、绑定浮动 IP。
2. SSH 登录云主机。
3. 安装 Node.js、Nginx、数据库。
4. 后端跑通 `GET /health`。
5. Nginx 反代跑通 `http://浮动IP/api/health`。
6. 本地 `web/.env.production` 改成云服务器地址。
7. 执行 `npm run build`。
8. 使用 Capacitor 同步 Android 工程。
9. 真机或模拟器安装 App。
10. App 内验证登录、约饭卡、聊天等接口。

## 9. 云主机使用纪律

课程手册强调：只在上课或实验时开启云主机，不使用时关闭。

- 实验前启动云主机。
- 实验后关闭云主机。
- 不要删除浮动 IP、网络和安全组配置。
- 不要把数据库密码、JWT 密钥等提交到 Git。

## 10. 风险提醒

| 风险 | 现象 | 处理 |
| --- | --- | --- |
| 校外未连 VPN | SSH 连不上 | 先连接交大 VPN |
| 未绑定浮动 IP | 外部访问不到服务器 | 在云主机列表中绑定浮动 IP |
| 安全组未开放端口 | App 请求超时 | 使用默认 80/443 + Nginx，或放行后端端口 |
| App 使用 localhost | App 内接口失败 | 改为浮动 IP 或域名 |
| HTTP 被 Android 拦截 | APK 内无法请求 HTTP | 配置 Android 明文网络或改 HTTPS |
| 云主机关机 | 所有接口不可用 | 演示前确认云主机处于运行状态 |
