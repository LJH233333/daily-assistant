#!/data/data/com.termux/files/usr/bin/bash
# daily-assistant 安装脚本：把插件装进 OpenCode 配置目录
#
# 用法：
#   ./install.sh                 # 装到 ~/.config/opencode
#   OPENCODE_CONFIG_DIR=/path ./install.sh
#
# 规则：
#   - 只复制 agent / skills / plugin / memory（记忆由后台引擎负责，这里只有 SOUL 人设）
#   - opencode.jsonc 已存在时**不覆盖**，先备份并提示手动合并
set -euo pipefail

export HOME=/data/data/com.termux/files/home
export TMPDIR=$HOME/tmp TEMP=$TMPDIR TMP=$TMPDIR

HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}"
SRC="$HERE/plugin"

mkdir -p "$DEST"
for d in agent skills plugin memory; do
  mkdir -p "$DEST/$d"
  cp -r "$SRC/$d/." "$DEST/$d/"
done

# 配置：存在则不覆盖，先备份
if [ -f "$DEST/opencode.jsonc" ]; then
  cp "$DEST/opencode.jsonc" "$DEST/opencode.jsonc.bak.$(date +%s)"
  echo "⚠️  $DEST/opencode.jsonc 已存在，已备份。请手动合并本插件的配置项（default_agent / plugin / skills / instructions）。"
else
  cp "$SRC/opencode.jsonc" "$DEST/opencode.jsonc"
fi

echo "✅ 已安装到 $DEST"
echo "   重启 OpenCode 后生效；验证：opencode agent list | grep -E 'companion|monitor|scheduler|dream'"
