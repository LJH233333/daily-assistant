# daily-companion —— 日常陪伴助手（OpenCode 后端插件）

把 OpenCode 从"编程工具"改造成"日常陪伴助手"的后端插件包。融合了 Hermes 的"小档案常驻 + 历史可搜" 与 OpenClaw 的"夜间复盘 + 门槛化晋升"。

## 角色（agent）

| 角色 | 类型 | 作用 |
|---|---|---|
| `companion` | primary（默认） | 陪伴对话、记得住你、主动关心 |
| `monitor` | subagent | 手机管家：电量/温度/内存/用量，异常才开口 |
| `scheduler` | subagent | 定时唤醒：早安晚安、整点、提醒 |
| `dream` | subagent | 深夜复盘：读近期内容，写梦境日记 |

## 记忆系统（DC-20：交给后台引擎）

记忆的"存、整理、取"由后台引擎（腾讯 TencentDB Agent Memory 轻量版）负责，助手不自管记忆文件：

1. **自动存**：每轮对话自动入库（原文 L0），无需模型开口。
2. **自动整理**：引擎定期提炼碎片记忆（L1）、场景（L2）、人物画像（L3）。
3. **自动取**：画像与场景每轮自动注入助手上下文；具体细节由助手按需经只读接口检索（引擎向系统提示注入 `<tdai_memory_tools>`，助手用 bash+curl 调）。

> **无"待批准"流程**：引擎自动记录，用户已拍板以新引擎为准（2026-09）。
> 旧自研记忆（`USER.md`/`MEMORY.md`/`daily/`/`pending.md` + 待批准队列 + 历史检索工具）已于 2026-09-15 弃用拆除。

**梦境复盘（夜间）：**
- `dream` 角色读取近期内容，写一份给人看的 `dreams.md` 日记（日记不作为记忆来源）。

## 工具

| 工具 | 作用 |
|---|---|
| `phone_status` | 电量/温度/内存/运行时长 |
| `dream_diary` | 写梦境日记 |

> 记忆检索不靠插件工具：由引擎注入 `<tdai_memory_tools>` 说明，助手用 bash+curl 调只读接口（代理自动带身份）。

## 目录

```
daily-companion/
├── opencode.jsonc          # 配置：默认角色、模型、技能、provider（记忆代理）
├── agent/                  # companion / monitor / scheduler / dream
├── skills/phone-hands/     # 手机能力技能（截图/操作/通知）
├── memory/                 # 只有 SOUL 人设（记忆在引擎侧）
└── plugin/daily-companion.ts
```

## 安装

```bash
cp -r agent skills memory plugin ~/.config/opencode/
cp opencode.jsonc ~/.config/opencode/
# 重启 OpenCode
opencode agent list | grep -E "companion|monitor|scheduler|dream"
```

## 用法

```bash
opencode run --agent companion "今天有点累"
opencode run --agent monitor "看看我手机状态"
opencode run --agent scheduler "现在是晚上11点，说句晚安并通知我"
opencode run --agent dream "开始今晚的复盘"
```

## 夜间复盘怎么接

由外部定时器（Termux cron 或 App 定时器）在夜间执行：

```bash
opencode run --agent dream "开始今晚的复盘"
```

App 集成后，改成到点唤起同一条指令即可。

## 接入 App 的接口

- 插件本地目录（`dreams.md`）用 `DAILY_COMPANION_MEMORY` 指定到 App 私有目录。
- 长记忆在引擎侧（本机沙箱 `~/.cache`），不随插件目录走；`DAILY_COMPANION_SESSION_DB` 已随旧机制弃用。
- 角色是纯文本定义，可直接内嵌；工具走 OpenCode 进程内接口，无需网络服务。

## 已知限制

- `phone_status` 依赖 Termux:API；App 内需改为原生接口。
- 截图/操作手机依赖 adb 无线调试，会随重启/断网掉线。
- 主动推送依赖 `termux-notification`；App 内改为系统通知。
- 梦境复盘的晋升目前无评分门槛（OpenClaw 有 0.75 分/回忆次数门槛），后续可加。
