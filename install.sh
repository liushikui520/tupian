#!/usr/bin/env bash
set -Eeuo pipefail
install_dir=/opt/tupian
port_override=''
usage() { echo '用法：bash install.sh [--dir /opt/tupian] [--port 8080]'; }
while (($#)); do
  case "$1" in
    --dir) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; install_dir="$2"; shift 2 ;;
    --port) [[ $# -ge 2 ]] || { usage >&2; exit 2; }; port_override="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done
if [[ -n "$port_override" ]]; then
  [[ "$port_override" =~ ^[0-9]{1,5}$ ]] && ((10#$port_override>=1 && 10#$port_override<=65535)) || { echo '端口必须为 1–65535。' >&2; exit 2; }
  port_override="$((10#$port_override))"
fi
for dependency in curl tar; do
  command -v "$dependency" >/dev/null || { echo "缺少 $dependency，请先安装。" >&2; exit 1; }
done
[[ "$install_dir" == /* && "$install_dir" != / ]] || { echo '--dir 必须是非根目录的绝对路径。' >&2; exit 2; }
if [[ -d "$install_dir" ]] && [[ -n "$(ls -A "$install_dir")" ]] && [[ ! -f "$install_dir/.tupian-install" ]]; then
  echo '目标文件夹不为空，且不是由本安装脚本管理的目录。请选择新的 --dir，已有 Git 仓库请用 bash deploy.sh update。' >&2
  exit 1
fi
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
curl -fSL --retry 3 --connect-timeout 15 --max-time 120 \
  https://codeload.github.com/liushikui520/tupian/tar.gz/refs/heads/main -o "$work_dir/source.tar.gz"
tar -xzf "$work_dir/source.tar.gz" -C "$work_dir"
source_dir="$work_dir/tupian-main"
[[ -f "$source_dir/dist/index.html" && -f "$source_dir/deploy.sh" ]] || { echo '下载包不完整，请重试。' >&2; exit 1; }
mkdir -p "$install_dir"
cp -R "$source_dir/." "$install_dir/"
touch "$install_dir/.tupian-install"
[[ -f "$install_dir/.env" ]] || cp "$install_dir/.env.example" "$install_dir/.env"
if [[ -n "$port_override" ]]; then
  # 仅修改 PORT，不读取或执行 .env 中的内容。
  sed -i '/^PORT=/d' "$install_dir/.env"
  printf '\nPORT=%s\n' "$port_override" >> "$install_dir/.env"
fi
bash "$install_dir/deploy.sh" start
printf '\n安装目录：%s\n更新：cd %q && sudo bash deploy.sh update\n' "$install_dir" "$install_dir"
