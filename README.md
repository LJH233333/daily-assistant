# daily-assistant —— 日常陪伴助手

把 OpenCode 从"编程工具"改造成**日常陪伴助手**的项目。最终目标是把这套能力并入用户的安卓 App，让助手随 App 开关，能陪聊、能记事、能看手机、能主动关心。

> 说明：本目录是**开发工作区**（沙箱产物 + 插件交付物），不是已发布的 App。
>
> **接手请先读 [`HANDOFF.md`](./HANDOFF.md)**（环境速查、隔离测试、已知坑、决策记录、安全提示）。
>
> 云端仓库（公开）：https://github.com/LJH233333/daily-assistant

## 目录结构

```
daily-assistant/
├── README.md              # 本文件
├── 优化清单.md            # 迭代与待办跟踪（模板同 OConnector Pro）
├── plugin/                # ★ 交付物：日常助手插件包（可直接装进 OpenCode）
│   ├── opencode.jsonc         # 配置：默认角色、模型、技能、记忆注入
│   ├── agent/                 # 四个角色：companion / monitor / scheduler / dream
│   ├── skills/phone-hands/    # 手机能力技能（电量/截图/操作/通知）
│   ├── memory/                # SOUL（人设）；记忆数据由后台引擎负责（DC-20）
│   ├── plugin/daily-companion.ts  # 插件代码（手机状态 + 梦境日记）
│   └── README.md              # 插件包详细说明
└── workspace/             # 构建/实验沙箱（非交付物）
    ├── opencode-src/          # OpenCode 源码（含 Bun 构建环境，约 2.1G）
    └── termux-app/            # Termux 源码（"嵌终端"路线的实验，已暂缓）
```

## 项目由来

用户要一个**个性化日常助手**（非编程向），核心诉求：
1. 陪伴感 + 有效的**长记忆**（缓存命中率低、经常切会话，所以记忆必须与缓存解耦）。
2. 能读手机状态（电量/用量/通知）、能操作手机、能看屏幕。
3. 定时唤醒、主动关心。
4. 最终并入用户的安卓 App（`OConnector-Pro`），随 App 开关。

## 当前方案：长记忆交给记忆引擎（DC-20）

记忆的"存、整理、取"由一套后台引擎（腾讯 TencentDB Agent Memory 轻量版）负责；助手侧的模型请求经代理绕行，自动完成：

1. **自动存**：每轮对话自动入库（原文 L0），无需模型开口。
2. **自动整理**：引擎定期把原文提炼成碎片记忆（L1）、场景（L2）、人物画像（L3）。
3. **自动取**：
   - 画像与场景索引每轮自动注入助手上下文（与提示缓存解耦）；
   - 具体细节由助手按需检索（引擎向系统提示注入 `<tdai_memory_tools>` 说明，助手用 bash+curl 调只读接口）。

> 旧的自研记忆机制（USER/MEMORY 文件、待批准队列、历史检索工具）**已于 2026-09-15 弃用拆除**（DC-20）。

外加 **`dream` 深夜复盘角色**：翻看近期对话 → 写 `dreams.md` 梦境日记。

### 助手侧怎么接引擎

- `plugin/opencode.jsonc` 里注册了一个自定义 provider（`tdai`，指向本机代理 `127.0.0.1:8096`）；
  **钥匙不进配置**，用 `{file:~/.local/share/opencode/tdai-user-key}` 从本机文件读。
- 只有 `companion` 角色通过它走模型（见 `agent/companion.md` 的 `model:`），
  全局默认模型保持不变——**避免代理没起时影响其他 OpenCode 使用**。
- 代理随请求自动完成：存对话、注入画像、暴露只读记忆工具（助手用 bash+curl 调）。

## 四个角色

| 角色 | 类型 | 作用 |
|---|---|---|
| `companion` | primary（默认） | 陪伴对话、记忆、主动关心 |
| `monitor` | subagent | 手机管家：电量/温度/内存/用量 |
| `scheduler` | subagent | 定时唤醒：早安晚安、整点、提醒 |
| `dream` | subagent | 深夜复盘 + 梦境日记 |

## 插件工具

| 工具 | 作用 |
|---|---|
| `phone_status` | 电量/温度/内存/运行时长 |
| `dream_diary` | 写梦境日记 |

> 记忆不靠插件工具：由引擎注入 `<tdai_memory_tools>` 说明，助手用 bash+curl 调只读接口（代理自动带身份）。

## 安装与测试（在隔离环境，勿污染主实例）

**一键隔离测试（推荐）**：

```bash
~/daily-assistant/test.sh                              # companion，默认提示
~/daily-assistant/test.sh /tmp/t monitor "看看我手机"   # 指定角色
~/daily-assistant/test.sh /tmp/t dream "开始今晚的复盘"
```

**安装到 OpenCode**：

```bash
./install.sh                 # 装到 ~/.config/opencode（自动备份已存在的配置）
```

> **记忆数据不在仓库**：实盘记忆（引擎数据在 `~/.cache` 沙箱）与 `dreams.md` 由 `.gitignore` 排除，**永不入库/推送**；仓库只含人设 `SOUL.md`。

```bash
# 1) 装到 OpenCode 配置目录
cp -r plugin/agent plugin/skills plugin/memory plugin/plugin ~/.config/opencode/
cp plugin/opencode.jsonc ~/.config/opencode/

# 2) 重启 OpenCode，验证角色
opencode agent list | grep -E "companion|monitor|scheduler|dream"

# 3) 试跑
opencode run --agent companion "今天有点累"
opencode run --agent monitor "看看我手机状态"
opencode run --agent dream "开始今晚的复盘"
```

> ⚠️ **测试隔离铁律**：任何实验必须同时隔离 `XDG_CONFIG_HOME` 与 `XDG_DATA_HOME`，否则测试会话会写进主库、暴露到用户的 App（已踩过坑，见优化清单 DC-7）。

## 当前状态

- 插件后端：**已跑通并测试**（手机状态、梦境复盘、网页测试页均实测通过）。
- 记忆引擎（DC-20）：**已完成**（端到端跑通并收尾；长记忆以其为准，无待批准流程）。
- 安卓 App 集成：**未开始**（等用户安排）。
- 夜间定时触发：**未接**（手机上用 Termux cron，App 内用 App 定时器）。

## 待办与迭代

见 [`优化清单.md`](./优化清单.md)。
