# 拾图 · 酒店图片管理

导入 ZIP 或图片文件夹，按酒店名称、入住日期搜索图片，支持全屏预览、原图下载、新建文件夹、移动图片，以及按入住日期批量删除。

- GitHub Pages 地址（需先在 Settings → Pages 启用 GitHub Actions）：**https://liushikui520.github.io/tupian/**
- 仓库：https://github.com/liushikui520/tupian
- 无需数据库、Node.js 后端或云存储；前端资源及 ZIP 解压组件已放在 `dist/`，运行时无需访问 CDN。

> **图片存在哪里？** 图片与文件夹保存在当前浏览器的 IndexedDB 中，刷新后保留。服务器和 GitHub Pages 只提供网页，不保存上传图片，不做跨设备同步。浏览器、设备、网址、协议或端口不同，图片库也不同。更换访问地址后需要重新导入；请保留原始 ZIP。清理网站数据会清空本地图片库。

## 服务器一键搭建

适用：能访问 GitHub 和 Docker 官方服务的 Linux 服务器。建议使用 Debian / Ubuntu；也可使用 Docker 官方安装脚本支持的其他发行版。需要 `curl`、`tar`；首次安装 Docker 需要 root 权限。

在服务器终端执行一条命令：

```bash
curl -fsSL https://raw.githubusercontent.com/liushikui520/tupian/main/install.sh -o /tmp/tupian-install.sh && sudo bash /tmp/tupian-install.sh
```

如果已经以 root 登录，可去掉 `sudo`。如果缺少 `curl`（Debian / Ubuntu）：

```bash
sudo apt-get update && sudo apt-get install -y curl ca-certificates tar
```

脚本下载本仓库到 `/opt/tupian`，缺少 Docker 时通过 `https://get.docker.com` 的官方脚本安装 Docker Engine / Compose，然后构建并启动 Nginx 容器。不会修改服务器防火墙。容器设置为开机自动恢复；首次自动安装 Docker 时也启用 Docker 服务。

完成后访问：**`http://服务器公网IP:8080`**。请在云服务器安全组和系统防火墙中允许 TCP 8080。不要把 `127.0.0.1` 当成外部访问地址。

自定义端口、安装位置：

```bash
sudo bash /tmp/tupian-install.sh --port 8088 --dir /opt/tupian
```

再次执行安装脚本会更新由它管理的安装目录，并保留 `.env`。脚本拒绝覆盖不属于本项目的非空目录。

### 启动、更新、停止、查看日志

```bash
cd /opt/tupian
sudo bash deploy.sh start     # 构建、启动，等待健康检查通过
sudo bash deploy.sh update    # 拉取最新代码并重新构建，保留 .env
sudo bash deploy.sh status    # 查看状态
sudo bash deploy.sh logs      # 持续查看日志，Ctrl+C 退出
sudo bash deploy.sh restart   # 重启
sudo bash deploy.sh stop      # 停止并移除容器
```

更改端口：编辑 `/opt/tupian/.env` 中的 `PORT=8080`，再运行 `sudo bash deploy.sh start`。切换端口会改变网站来源，浏览器中的旧图片不会显示在新端口下。

### 已有 Docker 的服务器

需要 Docker Compose v2（支持 `up --wait`，建议使用当前稳定版）。

```bash
git clone https://github.com/liushikui520/tupian.git
cd tupian
cp .env.example .env
bash deploy.sh start
```

如果当前用户无权访问 Docker，请加 `sudo`。若 Docker 没有随系统启动：`sudo systemctl enable --now docker`。提示缺少 Compose 时，安装官方 Docker 仓库的 `docker-compose-plugin`。

也可以直接使用 Compose：

```bash
docker compose up -d --build --wait
docker compose logs --tail=100
docker compose down
```

`deploy.sh` 固定 Compose 项目名为 `tupian`。手动混合使用时请保持同名（在名为 `tupian` 的目录运行，或加 `--project-name tupian`）。

### 域名和 HTTPS

域名解析到服务器 IP，在现有宝塔 / 1Panel / Nginx / Caddy 中配置反向代理到 `http://127.0.0.1:8080`，由反向代理提供 HTTPS。

例如使用已安装的 Caddy：

```caddyfile
images.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

将 `.env` 的 `BIND_ADDRESS` 改为 `127.0.0.1`，再执行 `sudo bash deploy.sh start`，并按代理要求开放 80 / 443。首次使用就确定域名并通过 HTTPS 导入，避免日后换地址重新导入。

自建服务没有账号登录页面；能访问服务器地址的人可以打开网页，每个浏览器各自保存自己的图片。需要限制网页访问时，请在反向代理上配置访问认证，或仅在内网开放。

### 无 Docker 运行

本项目是静态网站，可将 **`dist/` 内的内容**上传到 Nginx、宝塔、1Panel 的网站根目录。必须保留 `vendor/`、`app.js` 和 `style.css` 的相对位置。

本机快速预览（Python 3）：

```bash
git clone https://github.com/liushikui520/tupian.git
cd tupian
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

打开 **http://127.0.0.1:8080**；Ctrl+C 停止。此方式用于本机运行，不要将 Python 开发服务器直接用于公网生产服务。

## GitHub Pages 自动部署

仓库的 `.github/workflows/pages.yml` 在 `main` 分支每次推送后执行测试，并部署 `dist/`。GitHub Pages 的公开网页只分发程序，浏览器里的图片不会上传到 GitHub。

如果 Fork 到其他仓库：

1. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 在 **Actions** 页面允许工作流运行，并运行 **Test and deploy GitHub Pages**。
3. 等待部署完成，访问 Pages 给出的地址。

如果服务器已部署，GitHub 推送不会自动更新服务器：在服务器执行 `sudo bash deploy.sh update`。GitHub Actions 的 Docker 工作流还会验证镜像构建和 HTTP 健康检查。

## 图片命名与搜索

图片命名格式：

```text
酒店名称_入住日期_退房日期.png
示例：星河酒店_2026-10-14_2026-10-15.png
```

JPG、PNG、WEBP、GIF、AVIF、BMP、SVG 均可导入；ZIP 内的子文件夹会保留。已有不符合命名规则的图片仍可按文件名搜索，但不能参与入住日期搜索或按日期删除。

| 输入 | 匹配规则 |
| --- | --- |
| `14`、`14号`、`14日` | 所有月份中 14 号入住的图片 |
| `2026-10-14` | 2026 年 10 月 14 日入住的图片 |
| `星河酒店` | 名称中包含“星河酒店”的所有图片 |
| `星河 14` | 名称包含“星河”，同时为 14 号入住 |

日期匹配第一个日期，即入住日期；不会因为退房日期是 14 号而匹配。选择“全部图片”时跨文件夹搜索，进入文件夹后只搜索当前文件夹。

### 文件夹、预览与删除

- 点击“新建文件夹”；进入后导入的图片会放进该文件夹。已有图片通过“移动到文件夹”整理。
- 点击图片大图预览，方向键切换、Esc 退出；支持原尺寸查看、全屏和原图下载。
- “按入住日期一键删除”：选**完整年月日**，查看按酒店名称汇总的图片明细，然后确认删除。
- 日期删除覆盖**全部文件夹和所有酒店**，不受当前搜索、收藏或图片格式筛选影响。永久删除该日期图片及其收藏记录，无法撤销；电脑上原始 ZIP 和图片不受影响。

## 导入限制与排查

| 现象 | 处理 |
| --- | --- |
| 选了 ZIP 没有反应 | 刷新网页，查看导入区的持续提示；使用浏览器普通窗口，允许 JavaScript 和网站存储 |
| 压缩包被加密 / 分卷 / 特殊压缩方式 | 先在电脑上解压，再用“导入文件夹” |
| 没有识别到图片 | 确认 ZIP 中是图片文件，而不是另一层 ZIP、RAR、7Z、HEIC、PSD 等文件 |
| 空间不足 | 清理浏览器磁盘空间，拆分包分批导入；本项目不把图片转存服务器 |
| Docker 拉取失败 | 检查服务器到 Docker 镜像仓库的网络和 Docker 官方文档；在中国大陆网络可能需要自行配置可用的镜像加速服务 |
| 服务器网页打不开 | 检查 `bash deploy.sh status`、`bash deploy.sh logs`、安全组和端口占用；运行 `curl http://127.0.0.1:8080/healthz` 应返回 `ok` |
| 升级后提示图片库被占用 | 关闭其他打开旧版本的标签页，再刷新 |
| 搬家后图片不见了 | IndexedDB 按网站来源隔离，请用原设备、浏览器和原网址访问，或在新地址重新导入 ZIP |

单个 ZIP 最大 500 MB、最多 10,000 张图片；ZIP 内单张图片大于 100 MB 时跳过。还受浏览器可用内存和存储配额限制，大包建议先解压再分批导入。ZIP 文件读取、解压和图片搜索都在本地完成。

## 开发与检查

需要 Node.js 22+、npm；测试依赖不参与网站运行。

```bash
npm ci
npm run check
npm test
bash -n deploy.sh install.sh
docker compose config --quiet
```

测试覆盖 ZIP 导入、中文路径、HTTP 场景图片 ID、文件夹迁移与搜索、入住日期匹配、跨文件夹批量删除与失败保护。

```text
dist/                       完整静态网站（无构建步骤）
  index.html / app.js / style.css
  vendor/jszip.min.js        本地 ZIP 解压组件
Dockerfile / compose.yaml   生产容器和健康检查
deploy/nginx.conf           Nginx 配置
install.sh                  服务器一键安装 / 更新下载入口
deploy.sh                   服务生命周期管理
.github/workflows/          自动测试、Pages 发布、Docker 检查
tests/                      自动化逻辑测试
```

第三方组件许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
