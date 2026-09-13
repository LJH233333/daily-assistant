# AGENTS.md —— daily-assistant 项目规范

> **全局规范见 `~/.config/opencode/AGENTS.md`**（沟通方式、Termux 环境、opencode 本体、模型、4099 归属、文件操作）。
> 本文件**只写本项目特有内容，不重复全局**；两处若有出入，以**更严格**者为准。
> 配套文档：`README.md`、`HANDOFF.md`、`优化清单.md`。

## 0. 与全局的对应关系（避免重复）

| 事项 | 看哪里 |
|---|---|
| 沟通对象（大白话/短/结论先行） | 全局 §0 |
| Termux 环境、HOME/TMPDIR、临时目录 | 全局 §1 |
| opencode 二进制位置、禁止 `upgrade`、升级流程 | 全局 §2 |
| 模型/套餐查询 | 全局 §3 |
| 端口 4099 归属与"动之前先确认" | 全局 §4 + 本项目铁律一 |
| 读改文件、大下载/删除先说、用完即清 | 全局 §5 |

本文件从此处开始，只写**项目特有**的规范。

---

## 1. 项目是什么

把 OpenCode（编程 agent）改造成**日常陪伴助手**：陪伴对话 + 长记忆 + 手机管家 + 定时唤醒 + 深夜复盘。
当前阶段：**只做插件后端**（`plugin/`），App 集成未开始。

- 四个角色：`companion`（默认）/ `monitor` / `scheduler` / `dream`。
- 交付物：`plugin/`；沙箱：`workspace/`。

---

## 2. 项目铁律（本项目特有，或对全局的收紧）

### 铁律一：不得改造/污染运行中的 OpenCode
**收紧全局 §4**：全局允许"另起服务"，本项目**禁止**在运行实例上动手。

- 运行中的 `127.0.0.1:4099` 是用户 App 连接的服务。禁止杀进程、重启、改配置、改二进制。
- 实验一律在隔离环境做；**不要占用 4099**。
- 只有用户**明确要求**时，才可动运行实例。

❌ 反例：`kill <4099 的 pid>` 后重启以"刷新配置"——直接掐断用户会话。
✅ 正例：隔离环境另起 `opencode run` 验证；要动运行实例先问用户。

### 铁律二：测试必须"双隔离"
**同时**设 `XDG_CONFIG_HOME` 与 `XDG_DATA_HOME` 到临时目录。

❌ 反例：`XDG_CONFIG_HOME=/tmp/x opencode run …`——数据目录仍是主库，测试会话写进主库、暴露到用户 App（已踩，清理了 13 个会话）。
✅ 正例：用 `./test.sh`，或手动双隔离 + 覆盖 `DAILY_COMPANION_MEMORY`。

### 铁律三：长期记忆必须经用户批准
`target=daily` 可立即写；`target=user`/`memory` 必须进 `pending.md` 待批准，用户点头后经 `memory_review` 落档。

❌ 反例：直接写 `memory/USER.md` 或 `memory/MEMORY.md`。
✅ 正例：`memory(add,target=user,…)` → pending → 用户确认 → `memory_review(approve)`。

### 铁律四：绝不写入凭据
用户 App 里有服务器与 SMB 的账号密码。

❌ 反例：把密码/token/密钥写进记忆文件、仓库、日志、计划文档。
✅ 正例：只说"去某本地文件读"，不落明文到项目产物。

---

## 3. 项目须知

### 3.1 项目结构与关键路径

```
~/daily-assistant/
├── AGENTS.md / README.md / HANDOFF.md / 优化清单.md
├── test.sh                 # 一键隔离测试
├── plugin/                 # ★ 交付物（装进 ~/.config/opencode/）
│   ├── opencode.jsonc / agent/ / skills/ / memory/ / plugin/
└── workspace/              # 沙箱：opencode-src（源码+Bun）、termux-app（已暂缓）
```
（opencode 二进制与全局配置位置见全局 §2。）

### 3.2 一键隔离测试

```bash
./test.sh                              # companion，默认提示
./test.sh /tmp/t monitor "看看我手机"   # 指定角色
./test.sh /tmp/t dream "开始今晚的复盘"
```

### 3.3 关键环境变量（供 App 集成）

- `DAILY_COMPANION_MEMORY`：记忆目录（默认随 `XDG_CONFIG_HOME/opencode/memory`）。
- `DAILY_COMPANION_SESSION_DB`：会话库路径（默认随 `XDG_DATA_HOME/opencode/opencode.db`）。

### 3.4 从源码编译

```bash
cd workspace/opencode-src/packages/opencode
bun run script/build.ts --single --skip-install --skip-embed-web-ui   # 含 android/arm64
```
> `script/build.ts` 已加 `{ os: "android", arch: "arm64" }` 目标；musl 版用 `bun build --compile --target=bun-linux-arm64-musl`。

### 3.5 插件接口约定

- 工具参数类型用 `tool.schema`（如 `tool.schema.string()`），**不要 `import { z } from "zod"`**。
- 记忆条目格式：**一行一条**，忽略空行与 `#` 开头行。
- 会话检索范围：**只搜** `session.agent IN (companion, monitor, scheduler, dream)`。

---

## 4. 坑与反例（仅本项目特有；通用项见全局）

### 坑 1：dream 角色写文件
❌ 让 `dream` 用 `edit`/`write` 写 `dreams.md`（该角色 `edit: deny`，静默失败）。
✅ 用插件工具 `dream_diary`。

### 坑 2：插件记忆目录写死成全局
❌ 插件里硬编码 `~/.config/opencode/memory`。
✅ 跟随 `XDG_CONFIG_HOME`，并允许 `DAILY_COMPANION_MEMORY` 覆盖。
后果：隔离测试仍写全局，污染主目录（已踩，已修）。

### 坑 3：检索时把编程会话也搜出来
❌ `select … from session`（不过滤 agent）。
✅ `where s.agent in ('companion','monitor','scheduler','dream')`。
后果：违背用户"只搜手机端、不碰电脑端"的要求。

### 坑 4：插件里直接 import zod
❌ `import { z } from "zod"`。
✅ `const z = tool.schema`。
后果：依赖解析失败，插件加载报错。

### 坑 5：在主实例上派子进程做实验
❌ 在运行实例用 `task` 派子进程跑测试。
✅ 调研可做，但须知子会话会进主库；实验一律双隔离。
后果：子会话写进主库、用户 App 可见（已发生）。

### 坑 6：运行 OpenClaw 的安装脚本
❌ `curl … | bash` 安装 OpenClaw。
✅ 只读其文档/源码作设计参考。
原因：该仓库指标异常、安装脚本不在仓库内无法核验，**有风险，禁止运行**。

### 坑 7：把实盘记忆提交进仓库
❌ `git add plugin/memory/USER.md`（含个人数据；仓库已公开，一旦提交即泄露）。
✅ 仓库只存 `USER.template.md` / `MEMORY.template.md`；实盘 `USER.md`/`MEMORY.md`、`daily/`、`pending.md`、`dreams.md` 已被 `.gitignore` 排除。
后果：个人记忆泄露到公开仓库。**提交前务必 `git status` 核对。**

---

## 5. 文档维护约定

- 迭代编号 `DC-N`，完成即闭合，追加到 `优化清单.md` 末尾。
- 状态标记：⏳ 待定 / 🔄 进行中 / ✅ 完成 / ❌ 阻塞。
- `优化清单.md` 只跟踪未完成与在办项。
- 新增坑：在本文件 §4 补"❌ 反例 / ✅ 正例 / 后果"。

---

## 6. 交接

- 接手先读 `HANDOFF.md`。
- 改动前确认未违反 §2 四条铁律。
- 收尾更新 `优化清单.md`；有新坑则补进 §4。
