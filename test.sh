#!/data/data/com.termux/files/usr/bin/bash
# daily-assistant 一键测试脚本（隔离环境，绝不污染正在运行的主实例）
#
# 用法：
#   ./test.sh                      # 默认 companion，提示"你好"
#   ./test.sh <目录> <角色> <话>   # 例：./test.sh /tmp/x monitor "看看我手机"
#
# 隔离原理：同时设置 XDG_CONFIG_HOME 与 XDG_DATA_HOME 到临时目录，
# 会话写入临时库，主库（~/.local/share/opencode）不受影响。
set -euo pipefail

export HOME=/data/data/com.termux/files/home
export TMPDIR=$HOME/tmp TEMP=$TMPDIR TMP=$TMPDIR

HERE="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$HERE/plugin"

T="${1:-$HOME/.cache/opencode/tmp/da-test}"
AGENT="${2:-companion}"
PROMPT="${3:-你好}"

rm -rf "$T"
mkdir -p "$T/config/opencode" "$T/data/opencode"
cp -r "$PLUGIN_DIR/agent" "$PLUGIN_DIR/skills" "$PLUGIN_DIR/memory" "$PLUGIN_DIR/plugin" "$T/config/opencode/"
cp "$PLUGIN_DIR/opencode.jsonc" "$T/config/opencode/opencode.jsonc"
if [ -f "$HOME/.local/share/opencode/auth.json" ]; then
  cp "$HOME/.local/share/opencode/auth.json" "$T/data/opencode/auth.json"
fi

export XDG_CONFIG_HOME="$T/config"
export XDG_DATA_HOME="$T/data"
export DAILY_COMPANION_MEMORY="$T/config/opencode/memory"

echo "[隔离测试] agent=$AGENT"
echo "[提示] $PROMPT"
echo "[位置] 记忆：$T/config/opencode/memory"
echo "----------------------------------------"
opencode run --agent "$AGENT" "$PROMPT"
echo "----------------------------------------"
echo "[完成] 记忆目录内容："
ls -la "$T/config/opencode/memory"
echo "[确认] 主库会话数（不应因本次测试增加）："
curl -s -m 5 "http://127.0.0.1:4099/api/session?limit=100" 2>/dev/null \
  | python3 -c "import json,sys;print(len(json.load(sys.stdin).get('data',[])))" 2>/dev/null || echo "(主服务未响应)"
