# 交接说明（给下一个会话）

> 上一个会话（2026-09-13）把 OpenCode 改造成日常陪伴助手插件并测试通过。本文件是**接手要点**，先读它，再读 `README.md` 与 `优化清单.md`。

## 一句话状态

插件后端**已跑通并实测**；**App 集成未开始**；夜间定时未接。

---

## 一、环境速查（关键事实，别重新试）

| 项 | 值 |
|---|---|
| 用户正在运行的服务 | `opencode serve --hostname 127.0.0.1 --port 4099`。**这是用户 App 连的服务，禁止杀/重启/改配置**，除非用户明确要求 |
| opencode 二进制 | `$PREFIX/bin/opencode`（1.18.29，Hope2333 Termux 移植版） |
| 全局配置 | `~/.config/opencode/`（含 superpowers 插件 + `skills.paths`） |
| 用户主库（会话） | `~/.local/share/opencode/opencode.db` |
| Bun | **已装**（1.4.2，android arm64），`bun build --compile` 能出 android/musl 二进制 |
| 源码沙箱 | `~/daily-assistant/workspace/opencode-src`（2.1G，含依赖） |
| 工作目录 | `~/daily-assistant/` |
| GitHub | 账号 `LJH233333`，`gh` 已登录（classic token，有 repo 权限） |

### 从源码编译（需要时）
```bash
cd ~/daily-assistant/workspace/opencode-src/packages/opencode
bun run script/build.ts --single --skip-install --skip-embed-web-ui
# 产物：dist/opencode-android-arm64/bin/opencode
```
> 构建脚本 `script/build.ts` 里已加 `{ os: "android", arch: "arm64" }` 目标（一次一行的改动）；musl 目标用 `bun build --compile --target=bun-linux-arm64-musl`。

---

## 二、测试方法（必须隔离！）

用现成脚本，**一键隔离测试**：

```bash
~/daily-assistant/test.sh                              # companion，默认提示
~/daily-assistant/test.sh /tmp/t monitor "看看我手机"   # 指定角色
~/daily-assistant/test.sh /tmp/t companion "今天有点累"
```

脚本会：同时隔离 `XDG_CONFIG_HOME` + `XDG_DATA_HOME`（会话只进临时库）→ 复制 auth → 跑 → 打印主库会话数（应不变）。

### 隔离铁律（血泪教训，见优化清单 DC-7）
- **只隔离配置、不隔离数据 = 会污染用户主库**，测试会话会出现在用户的 App 里（上轮已踩，已清理 13 个）。
- 任何实验**必须同时**设 `XDG_CONFIG_HOME` 与 `XDG_DATA_HOME`。
- 用户明确要求：**不得改造/污染正在运行的那套 OpenCode**。

---

## 三、四个角色与工具

| 角色 | 命令 | 作用 |
|---|---|---|
| companion | `opencode run --agent companion "…"` | 陪伴（默认） |
| monitor | `… --agent monitor "…"` | 手机管家 |
| scheduler | `… --agent scheduler "…"` | 定时唤醒（发通知） |
| dream | `… --agent dream "开始今晚的复盘"` | 深夜复盘 |

工具（插件内）：`memory`（增/改/删，daily 即写、长期待批准）、`memory_review`（批准/丢弃）、`recall`、`recall_history`（仅陪伴会话）、`phone_status`、`dream_diary`。

---

## 四、本轮定下的决策

1. **记忆哲学**：Hermes（小档案常驻 + 历史可搜 + AI 自管）＋ OpenClaw（夜间复盘、门槛化晋升）合体。
2. **写入审批**：`daily` 立即写；`user`/`memory` 长期档案**要用户点头**。
3. **检索范围**：只搜**手机端陪伴会话**，不碰电脑端与编程会话。
4. **字数上限**：USER 1375 / MEMORY 2200（对齐 Hermes）。
5. **App 路线**：用户先前选 B（嵌终端 + 完整环境），后改为"先只做插件后端"；App 集成待用户重启该议题。

---

## 五、已知坑 / 注意

- 插件记忆目录**跟随 `XDG_CONFIG_HOME`**（早期写死全局的 bug 已修）。
- `dream` 角色 `edit: deny`，写日记必须用 `dream_diary` 工具，不能写文件。
- `recall_history` 直读 `opencode.db`（只读），表结构：`session(agent,...)` / `message(session_id,data)` / `part(message_id,data)`；opencode 版本升级可能需微调。
- 记忆目录/会话库可用环境变量覆盖：`DAILY_COMPANION_MEMORY`、`DAILY_COMPANION_SESSION_DB`。
- 用户**不要语音播报**（上轮已停用 `termux-tts-speak` 打招呼）。
- 仓库只保存记忆**模板**（`*.template.md`）；实盘记忆（`USER.md`/`MEMORY.md`/`daily/`/`pending.md`/`dreams.md`）已被 `.gitignore` 排除，**绝不要提交/推送**。
- `opencode serve` 若被杀，会中断当前会话（测试时别在 4099 上动手）。
- 手机能力依赖 Termux:API 与 adb 无线调试（会掉线）。

---

## 六、用户沟通偏好（务必遵守）

- 对计算机**一窍不通**，用大白话、短、直给结论；别甩函数/代码/路径/术语。
- 大下载、删文件、动系统前先说一声。
- 不要擅自改造正在运行的 OpenCode。
- 全局规范见 `~/.config/opencode/AGENTS.md`。

---

## 七、安全提示

- **OpenClaw 仓库指标异常**（星标/issue/体积离谱）、安装脚本不在仓库内 → 只作设计参考，**禁止运行其安装脚本**。
- 用户 App 里有**明文/加密的服务器与 SMB 凭据**；**任何情况下不要把凭据写进仓库或记忆文件**。

---

## 八、未完成（见优化清单 DC-8~DC-12）

- DC-8 并入安卓 App（未开始）
- DC-9 夜间定时触发（未接）
- DC-10 晋升评分门槛（OpenClaw 式，未做）
- DC-11 向量检索（评估后暂不采用）
- DC-12 手机能力原生化（未开始）

## 九、其他遗留

- GitHub 仓库 `LJH233333/termux-assistant`：上轮"在 App 内嵌终端"实验建的空壳仓库（已 push termux-app 源码），**该路线已暂停**，留着备查。
- `workspace/termux-app`：同上，Termux 源码副本。
