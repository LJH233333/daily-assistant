# daily-companion —— 日常陪伴助手（OpenCode 后端插件）

把 OpenCode 从"编程工具"改造成"日常陪伴助手"的后端插件包。融合了 Hermes 的"小档案常驻 + 历史可搜" 与 OpenClaw 的"夜间复盘 + 门槛化晋升"。

## 角色（agent）

| 角色 | 类型 | 作用 |
|---|---|---|
| `companion` | primary（默认） | 陪伴对话、记得住你、主动关心 |
| `monitor` | subagent | 手机管家：电量/温度/内存/用量，异常才开口 |
| `scheduler` | subagent | 定时唤醒：早安晚安、整点、提醒 |
| `dream` | subagent | 深夜复盘：读流水，提交长期候选，写梦境日记 |

## 记忆系统

**三层结构：**

1. **长期档案**（常驻，会话开始注入）
   - `USER.md`：用户档案，上限 **1375 字**
   - `MEMORY.md`：精选事实，上限 **2200 字**
   - 写满报错，AI 必须先合并/删除再写；自动去重；敏感内容扫描。
2. **每日流水**（短期，自动写）
   - `daily/YYYY-MM-DD.md`
3. **历史检索**（按需翻）
   - 只搜**手机端陪伴会话**（companion/monitor/scheduler/dream），不碰电脑端与编程会话。

**写入审批：**
- `target=daily` → 立即写。
- `target=user/memory` → 进"待批准队列"（`pending.md`），用户点头后才写。

**梦境复盘（夜间）：**
- `dream` 角色读最近流水，提炼长期候选提交待批准，并写一份给人看的 `dreams.md` 日记（日记不作为记忆来源）。

## 工具

| 工具 | 作用 |
|---|---|
| `memory` | 增/改/删记忆；daily 立即写，user/memory 走待批准 |
| `memory_review` | 列出/批准/丢弃待批准条目 |
| `recall` | 读全部记忆快照 |
| `recall_history` | 在手机端陪伴会话里搜历史原话 |
| `phone_status` | 电量/温度/内存/运行时长 |
| `dream_diary` | 写梦境日记 |

## 目录

```
daily-companion/
├── opencode.jsonc          # 配置：默认角色、模型、技能、记忆注入
├── agent/                  # companion / monitor / scheduler / dream
├── skills/phone-hands/     # 手机能力技能（截图/操作/通知）
├── memory/                 # SOUL / USER / MEMORY / daily / pending / dreams
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

- 记忆目录用环境变量 `DAILY_COMPANION_MEMORY` 指定到 App 私有目录。
- 会话库路径用 `DAILY_COMPANION_SESSION_DB` 指定（默认随 `XDG_DATA_HOME`）。
- 角色是纯文本定义，可直接内嵌；工具走 OpenCode 进程内接口，无需网络服务。

## 已知限制

- `phone_status` 依赖 Termux:API；App 内需改为原生接口。
- 截图/操作手机依赖 adb 无线调试，会随重启/断网掉线。
- 主动推送依赖 `termux-notification`；App 内改为系统通知。
- 梦境复盘的晋升目前无评分门槛（OpenClaw 有 0.75 分/回忆次数门槛），后续可加。
