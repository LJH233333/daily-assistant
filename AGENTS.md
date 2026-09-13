# AGENTS.md —— daily-assistant 项目规范

> **全局规范见 `~/.config/opencode/AGENTS.md`**（沟通方式、Termux 环境、opencode 本体、模型、4099 归属、文件操作）。
> 本文件**只写本项目特有内容，不重复全局**；两处若有出入，以**更严格**者为准。
> 配套：`README.md`、`HANDOFF.md`、`优化清单.md`、`install.sh`、`test.sh`。
> 云端仓库（公开）：https://github.com/LJH233333/daily-assistant

## 0. 与全局的对应关系（避免重复）

| 事项 | 看哪里 |
|---|---|
| 沟通对象（大白话/短/结论先行） | 全局 §0 |
| Termux 环境、HOME/TMPDIR、临时目录 | 全局 §1 |
| opencode 二进制位置、禁止 `upgrade`、升级流程 | 全局 §2 |
| 模型/套餐查询 | 全局 §3 |
| 端口 4099 归属与"动之前先确认" | 全局 §4 + 本项目铁律一 |
| 读改文件、大下载/删除先说、用完即清 | 全局 §5 |

---

## 1. 项目是什么 & 当前状态

把 OpenCode（编程 agent）改造成**日常陪伴助手**：陪伴对话 + 长记忆 + 手机管家 + 定时唤醒 + 深夜复盘。

- 四个角色：`companion`（默认）/ `monitor` / `scheduler` / `dream`。
- **当前状态**：插件后端已跑通并实测；**App 集成未开始**；夜间定时未接。
- 交付物 `plugin/`；沙箱 `workspace/`；云端仓库**公开**（勿放任何隐私）。

---

## 2. 项目铁律

### 铁律一：不得改造/污染运行中的 OpenCode
**收紧全局 §4**：全局允许"另起服务"，本项目**禁止**在运行实例上动手。

- `127.0.0.1:4099` 是用户 App 连接的服务。禁止杀进程、重启、改配置、改二进制。
- 实验一律在隔离环境；**不要占用 4099**。
- 只有用户**明确要求**时，才可动运行实例。
- ⚠️ **`install.sh` 会写入 `~/.config/opencode/`，重启后即影响运行实例**。默认别对全局配置跑它；测试请用 `OPENCODE_CONFIG_DIR=<隔离目录>`，或先经用户明确同意。

❌ 反例：`kill <4099 的 pid>` 后重启"刷新配置"——直接掐断用户会话。
❌ 反例：直接 `./install.sh` 覆盖用户全局配置里的 agent/skills——污染运行实例。
✅ 正例：`OPENCODE_CONFIG_DIR=/tmp/x ./install.sh`，或用 `./test.sh` 验证。

### 铁律二：测试必须"双隔离"
**同时**设 `XDG_CONFIG_HOME` 与 `XDG_DATA_HOME` 到临时目录。

❌ 反例：`XDG_CONFIG_HOME=/tmp/x opencode run …`——数据目录仍是主库，测试会话写进主库、暴露到用户 App（已踩，清理过 13 个会话）。
✅ 正例：用 `./test.sh`，或手动双隔离 + 覆盖 `DAILY_COMPANION_MEMORY`。

### 铁律三：长期记忆必须经用户批准
`target=daily` 可立即写；`target=user`/`memory` 必须进 `pending.md` 待批准，用户点头后经 `memory_review` 落档。

❌ 反例：直接写 `memory/USER.md` / `memory/MEMORY.md`。
✅ 正例：`memory(add,target=user,…)` → pending → 用户确认 → `memory_review(approve)`。

### 铁律四：绝不写入凭据
❌ 反例：把密码/token/密钥写进记忆、代码、配置、日志、文档。
✅ 正例：只说"去某本地文件读"；密钥交给 opencode 认证或 App 安全存储。

### 铁律五：公开仓库红线（提交/推送前必做自检）
仓库是**公开**的，任何隐私一旦推送即不可收回。

- 提交前**必须**跑一次自检（见 §5），确认无个人数据、无凭据。
- 仓库**只存模板**（`*.template.md`）；实盘记忆、`auth.json`、`workspace/`、`*.db` 一律由 `.gitignore` 排除。
- 模型密钥**不在仓库**（在 `~/.local/share/opencode/auth.json`）；**禁止**把 `provider.apiKey` 写进提交的配置。

❌ 反例：`git add -A && git commit && git push` 不看 `git status`。
✅ 正例：先 `git status --short` + §5 自检脚本，确认干净再提交。

---

## 3. 项目须知

### 3.1 项目结构与关键路径

```
~/daily-assistant/
├── AGENTS.md / README.md / HANDOFF.md / 优化清单.md
├── install.sh              # 安装到 OpenCode（不覆盖已有记忆/配置）
├── test.sh                 # 一键双隔离测试
├── .gitignore              # 排除实盘记忆/凭据/沙箱/DB
├── plugin/                 # ★ 交付物（含 *.template.md 模板）
│   ├── opencode.jsonc / agent/ / skills/ / memory/ / plugin/
└── workspace/              # 沙箱：opencode-src（源码+Bun）、termux-app（已暂缓）
```
（opencode 二进制与全局配置位置见全局 §2。）

### 3.2 命令速查

```bash
# 隔离测试
./test.sh
./test.sh /tmp/t monitor "看看我手机"
./test.sh /tmp/t dream "开始今晚的复盘"

# 安装到隔离配置目录（安全）
OPENCODE_CONFIG_DIR=/tmp/oc ./install.sh

# 从源码编译（含 android/arm64）
cd workspace/opencode-src/packages/opencode
bun run script/build.ts --single --skip-install --skip-embed-web-ui

# 提交前自检
./test.sh >/dev/null 2>&1; git status --short; git ls-files | grep -E "memory/(USER|MEMORY)\.md$|auth|workspace/|\.db$"
git log -p --all | grep -Ei "sk-[a-z0-9]{10}|ghp_[A-Za-z0-9]{20}|github_pat_[A-Za-z0-9_]{20}"
```

### 3.3 关键环境变量（供 App 集成）

- `DAILY_COMPANION_MEMORY`：记忆目录（默认随 `XDG_CONFIG_HOME/opencode/memory`）。
- `DAILY_COMPANION_SESSION_DB`：会话库路径（默认随 `XDG_DATA_HOME/opencode/opencode.db`）。
- `OPENCODE_CONFIG_DIR`：`install.sh` 的目标目录（默认 `~/.config/opencode`）。

### 3.4 从源码编译要点

- `script/build.ts` 需自行加入 `{ os: "android", arch: "arm64" }` 目标（沙箱里已加）；Bun 认 `bun-android-arm64`。
- musl 版：`bun build --compile --target=bun-linux-arm64-musl`。
- 缺原生依赖时报错（如 `@ff-labs/fff-bun`）：用 `bun install --os="*" --cpu="*" <pkg>` 补。
- 上游 dev 分支的 `bun install` 可能因 DNS 或原生模块失败，可 `--ignore-scripts` 兜底。

### 3.5 插件接口约定

- 工具参数类型用 `tool.schema`（如 `tool.schema.string()`），**不要 `import { z } from "zod"`**。
- 记忆条目格式：**一行一条**，忽略空行与 `#` 开头行。
- 会话检索范围：**只搜** `session.agent IN (companion, monitor, scheduler, dream)`。
- 记忆目录跟随 `XDG_CONFIG_HOME`，允许 `DAILY_COMPANION_MEMORY` 覆盖。

---

## 4. 坑与反例

### 坑 1：dream 角色写文件
❌ 让 `dream` 用 `edit`/`write` 写 `dreams.md`（该角色 `edit: deny`，静默失败）。
✅ 用插件工具 `dream_diary`。

### 坑 2：插件记忆目录写死成全局
❌ 插件里硬编码 `~/.config/opencode/memory`。
✅ 跟随 `XDG_CONFIG_HOME` + `DAILY_COMPANION_MEMORY` 覆盖。
后果：隔离测试仍写全局，污染主目录（已踩，已修）。

### 坑 3：检索时把编程会话也搜出来
❌ `select … from session`（不过滤 agent）。
✅ `where s.agent in ('companion','monitor','scheduler','dream')`。
后果：违背"只搜手机端、不碰电脑端"。

### 坑 4：插件里直接 import zod
❌ `import { z } from "zod"`。✅ `const z = tool.schema`。
后果：依赖解析失败，插件加载报错。

### 坑 5：在主实例上派子进程做实验
❌ 在运行实例用 `task` 派子进程跑测试。
✅ 调研可做，但须知子会话会进主库；实验一律双隔离。
后果：子会话写进主库、用户 App 可见（已发生）。
附：本环境 `task(subagent_type="general")` 可能被权限拒绝；被拒时改用自带 `websearch`/`gh`。

### 坑 6：运行 OpenClaw 的安装脚本
❌ `curl … | bash` 安装 OpenClaw。
✅ 只读其文档/源码作设计参考（仓库指标异常、安装脚本不在仓库内无法核验）。

### 坑 7：把实盘记忆提交进公开仓库
❌ `git add plugin/memory/USER.md`（含个人数据）。
✅ 只存 `*.template.md`；实盘文件已被 `.gitignore` 排除。
后果：个人记忆泄露且不可收回。**提交前务必 `git status` + §5 自检。**

### 坑 8：对全局配置跑 install.sh
❌ `./install.sh` 直接写 `~/.config/opencode/`，重启影响运行实例。
✅ `OPENCODE_CONFIG_DIR=<隔离目录> ./install.sh`，或经用户同意。
后果：污染用户全局配置（agent/skills 被覆盖）。

---

## 5. 脱敏与凭证（公开仓库必读）

**不入库的（`.gitignore` 已排除）**：实盘记忆（`USER.md`/`MEMORY.md`/`daily/`/`pending.md`/`dreams.md`）、凭据（`auth.json`/`*.key`/`*.keystore`/`*.pem`/`.env`）、沙箱（`workspace/`）、数据库（`*.db*`）、临时与备份。

**可以入库的**：模板（`*.template.md`）、人设 `SOUL.md`、角色/技能/插件代码、文档。

**模型密钥位置**：`~/.local/share/opencode/auth.json`（项目外，永不入库）。配置里只写模型 ID，不写 key。

**App 集成时的密钥存放**：Android 安全存储（加密 + Keystore），**禁止**明文落文件/代码/仓库。

**提交前自检（必做）**：
```bash
git status --short
git ls-files | grep -E "memory/(USER|MEMORY)\.md$|/auth\.json|workspace/|\.db$" && echo "⚠️ 发现敏感，停止提交"
git log -p --all | grep -Ei "sk-[a-z0-9]{10}|ghp_[A-Za-z0-9]{20}|github_pat_[A-Za-z0-9_]{20}|-----BEGIN.*PRIVATE"
```

---

## 6. 文档维护约定

- 迭代编号 `DC-N`，完成即闭合，追加到 `优化清单.md` 末尾。
- 状态标记：⏳ 待定 / 🔄 进行中 / ✅ 完成 / ❌ 阻塞。
- `优化清单.md` 只跟踪未完成与在办项。
- 新增坑：在本文件 §4 补"❌ 反例 / ✅ 正例 / 后果"。

---

## 7. 交接

- 接手先读 `HANDOFF.md`。
- 改动前确认未违反 §2 五条铁律。
- 收尾更新 `优化清单.md`；有新坑补进 §4；提交前跑 §5 自检。
