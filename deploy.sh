#!/usr/bin/env bash
set -Eeuo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"
command="${1:-start}"
usage() {
  cat <<'HELP'
用法：bash deploy.sh [start|update|stop|restart|status|logs|help]
  start   构建并启动服务；首次缺少 Docker 时自动安装（需要 root）
  update  从 GitHub 下载最新代码并重新构建；保留 .env
  stop    停止服务
  restart 重启服务
  status  查看容器状态
  logs    查看最近 100 行日志（持续输出）
默认端口 8080；配置位于 .env。
HELP
}
case "$command" in start|update|stop|restart|status|logs) ;; help|-h|--help) usage; exit 0 ;; *) usage >&2; exit 2 ;; esac
if [[ "$command" == update ]]; then
  if [[ -d .git ]]; then
    git -c core.hooksPath=/dev/null pull --ff-only
    exec bash "$project_dir/deploy.sh" start
  fi
  update_script="$(mktemp)"
  trap 'rm -f "$update_script"' EXIT
  curl -fSL --retry 3 --connect-timeout 15 --max-time 120 \
    https://raw.githubusercontent.com/liushikui520/tupian/main/install.sh -o "$update_script"
  bash "$update_script" --dir "$project_dir"
  exit 0
fi
if ! command -v docker >/dev/null 2>&1; then
  [[ "$command" == start ]] || { echo '未安装 Docker，请先运行 bash deploy.sh start。' >&2; exit 1; }
  [[ "$EUID" -eq 0 ]] || { echo '首次安装 Docker 需要 root，请执行 sudo bash deploy.sh start。' >&2; exit 1; }
  command -v curl >/dev/null || { echo '请先安装 curl（Debian/Ubuntu：apt-get update && apt-get install -y curl）。' >&2; exit 1; }
  echo '正在通过 Docker 官方安装脚本安装 Docker Engine 和 Compose…'
  docker_installer="$(mktemp)"
  trap 'rm -f "$docker_installer"' EXIT
  curl -fSL --retry 3 --connect-timeout 15 --max-time 120 https://get.docker.com -o "$docker_installer"
  sh "$docker_installer"
fi
if ! docker info >/dev/null 2>&1; then
  if [[ "$EUID" -eq 0 ]] && command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now docker
  else
    echo '无法连接 Docker。请启动 Docker，或使用 sudo bash deploy.sh。' >&2; exit 1
  fi
fi
docker compose version >/dev/null 2>&1 || { echo '缺少 Docker Compose v2，请按 README 安装 docker-compose-plugin。' >&2; exit 1; }
[[ -f .env ]] || cp .env.example .env
compose() { docker compose --project-name tupian --env-file .env -f compose.yaml "$@"; }
case "$command" in
  start)
    compose up -d --build --wait --wait-timeout 90
    echo '拾图已启动。访问：http://服务器IP:端口（默认 8080，实际以 .env 为准）'
    echo '请在服务器安全组/防火墙中放行该 TCP 端口。'
    compose ps
    ;;
  stop) compose down ;;
  restart) compose restart ;;
  status) compose ps ;;
  logs) compose logs --tail=100 -f ;;
esac
