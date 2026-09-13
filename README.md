# daily-assistant —— 日常陪伴助手

把 OpenCode 从"编程工具"改造成**日常陪伴助手**的项目。最终目标是把这套能力并入用户的安卓 App，让助手随 App 开关，能陪聊、能记事、能看手机、能主动关心。

> 说明：本目录是**开发工作区**（沙箱产物 + 插件交付物），不是已发布的 App。
>
> **接手请先读 [`HANDOFF.md`](./HANDOFF.md)**（环境速查、隔离测试、已知坑、决策记录、安全提示）。

## 目录结构

```
daily-assistant/
├── README.md              # 本文件
├── 优化清单.md            # 迭代与待办跟踪（模板同 OConnector Pro）
├── plugin/                # ★ 交付物：日常助手插件包（可直接装进 OpenCode）
│   ├── opencode.jsonc         # 配置：默认角色、模型、技能、记忆注入
│   ├── agent/                 # 四个角色：companion / monitor / scheduler / dream
│   ├── skills/phone-hands/    # 手机能力技能（电量/截图/操作/通知）
│   ├── memory/                # SOUL / USER / MEMORY / daily（记忆数据）
│   ├── plugin/daily-companion.ts  # 插件代码（记忆工具 + 手机工具 + 历史检索）
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

## 当前方案（融合 Hermes 与 OpenClaw 两套记忆哲学）

- **Hermes 路线**：小档案常驻 + 大历史可搜 + AI 自管。
- **OpenClaw 路线**：夜间复盘、门槛化晋升、可审计。

落地为三层记忆：

1. **长期档案**（会话开始注入，与缓存无关）
   - `memory/USER.md`（上限 1375 字）
   - `memory/MEMORY.md`（上限 2200 字）
   - 写满报错、逼 AI 当场整理；自动去重；敏感内容扫描。
   - **长期写入需用户批准**（进 `pending.md` 待批准队列）。
2. **每日流水**（`memory/daily/YYYY-MM-DD.md`，立即写）。
3. **历史检索**（`recall_history`，只搜手机端陪伴会话，不碰电脑端）。

外加 **`dream` 深夜复盘角色**：读流水 → 提炼长期候选提交待批准 → 写 `dreams.md` 梦境日记。

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
| `memory` | 增/改/删；daily 立即写，user/memory 走待批准 |
| `memory_review` | 列出/批准/丢弃待批准条目 |
| `recall` | 记忆快照 |
| `recall_history` | 搜手机端陪伴会话的历史原话 |
| `phone_status` | 电量/温度/内存/运行时长 |
| `dream_diary` | 写梦境日记 |

## 安装与测试（在隔离环境，勿污染主实例）

**一键隔离测试（推荐）**：

```bash
~/daily-assistant/test.sh                              # companion，默认提示
~/daily-assistant/test.sh /tmp/t monitor "看看我手机"   # 指定角色
~/daily-assistant/test.sh /tmp/t dream "开始今晚的复盘"
```

**手动安装到 OpenCode**：

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

- 插件后端：**已跑通并测试**（记忆增删改/上限/待批准/历史检索/梦境复盘全部实测通过）。
- 安卓 App 集成：**未开始**（等用户安排）。
- 夜间定时触发：**未接**（手机上用 Termux cron，App 内用 App 定时器）。

## 待办与迭代

见 [`优化清单.md`](./优化清单.md)。
