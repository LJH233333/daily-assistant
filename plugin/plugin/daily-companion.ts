import { tool } from "@opencode-ai/plugin"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execFileSync } from "node:child_process"
import { Database } from "bun:sqlite"

const z = tool.schema

const CONFIG_DIR = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config")
const MEMORY_DIR = process.env.DAILY_COMPANION_MEMORY ?? path.join(CONFIG_DIR, "opencode", "memory")
const DATA_DIR = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share")
const SESSION_DB = process.env.DAILY_COMPANION_SESSION_DB ?? path.join(DATA_DIR, "opencode", "opencode.db")

const LIMITS: Record<string, number> = { user: 1375, memory: 2200 }

// Only these agents count as the phone daily assistant. Never search PC/coding sessions.
const COMPANION_AGENTS = ["companion", "monitor", "scheduler", "dream"]

const THREAT_PATTERNS = [
  /ignore (all )?(previous|above) (instructions|rules)/i,
  /disregard (all )?(previous|above)/i,
  /system prompt/i,
  /\b(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*\S{6,}/i,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
]
function scanThreat(text: string): string | null {
  for (const re of THREAT_PATTERNS) if (re.test(text)) return "内容疑似指令注入或密钥，已拒绝。"
  return null
}

function ensureDir(d: string) {
  fs.mkdirSync(d, { recursive: true })
}
function fileFor(target: string): string {
  if (target === "user") return path.join(MEMORY_DIR, "USER.md")
  if (target === "memory") return path.join(MEMORY_DIR, "MEMORY.md")
  return dailyFile()
}
function dailyFile(d = new Date()): string {
  const n = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return path.join(MEMORY_DIR, "daily", `${n}.md`)
}
function stamp() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
function dateTag(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function withDateTag(content: string): string {
  // 长记忆条目统一盖日期戳（新鲜度/回忆录装订的地基）；已有则不重复盖。
  if (/^【\d{4}-\d{2}-\d{2}】/.test(content)) return content
  return `【${dateTag()}】${content}`
}
function readEntries(file: string): string[] {
  let raw = ""
  try {
    raw = fs.readFileSync(file, "utf8")
  } catch {
    return []
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}
function writeEntries(file: string, entries: string[]) {
  ensureDir(path.dirname(file))
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, entries.join("\n") + "\n", "utf8")
  fs.renameSync(tmp, file)
}
function charCount(e: string[]) {
  return e.join("\n").length
}
function budgetError(target: string, content: string, entries: string[], limit: number) {
  return (
    `${target} 已用 ${charCount(entries)}/${limit} 字，再加 ${content.length} 字会超。` +
    `请先用 replace 合并或 remove 删除，再重试。当前条目：\n` +
    entries.map((e, i) => `${i + 1}. ${e}`).join("\n")
  )
}
function findIndex(entries: string[], oldText: string) {
  const hits = entries.map((e, i) => (e.includes(oldText) ? i : -1)).filter((i) => i >= 0)
  return { index: hits[0] ?? -1, ambiguous: hits.length > 1 }
}

// ----- pending queue: long-term writes need the user's approval -----
const PENDING = path.join(MEMORY_DIR, "pending.md")
const SCORES = path.join(MEMORY_DIR, "scores.json")
type PendingItem = { id: string; target: string; score: number; content: string }
function clampScore(s: any): number {
  const n = typeof s === "number" ? s : parseInt(String(s ?? "3"), 10)
  if (isNaN(n)) return 3
  return Math.min(5, Math.max(1, n))
}
function readPending(): PendingItem[] {
  const raw = (() => {
    try {
      return fs.readFileSync(PENDING, "utf8")
    } catch {
      return ""
    }
  })()
  const out: PendingItem[] = []
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t.startsWith("|")) continue
    const cols = t.split("|").map((x) => x.trim())
    if (cols[1] === "id" || cols[1] === "---") continue
    // 新格式 | id | target | score | content |，兼容老格式 | id | target | content |
    if (cols.length >= 6 && cols[1]) {
      out.push({ id: cols[1], target: cols[2], score: clampScore(cols[3]), content: cols[4] })
    } else if (cols.length >= 5 && cols[1]) {
      out.push({ id: cols[1], target: cols[2], score: 3, content: cols[3] })
    }
  }
  return out
}
function writePending(items: PendingItem[]) {
  ensureDir(MEMORY_DIR)
  const head = "# 待批准写入长期记忆\n\n| id | target | score | content |\n|---|---|---|---|\n"
  fs.writeFileSync(PENDING, head + items.map((i) => `| ${i.id} | ${i.target} | ${i.score} | ${i.content} |`).join("\n") + "\n", "utf8")
}
// 分数侧车账本：条目 -> {分数,日期}，快照排序/回忆录装订用。用户不可见，批准落袋时记。
function recordScores(rows: { target: string; content: string; score: number }[]) {
  ensureDir(MEMORY_DIR)
  const lines = rows.map((r) => JSON.stringify({ entry: r.content, target: r.target, score: r.score, date: dateTag() }))
  if (lines.length) fs.appendFileSync(SCORES, lines.join("\n") + "\n", "utf8")
}
function nextId(): string {
  return `m${Date.now().toString(36)}`
}

function mutate(target: string, action: string, content: string, oldText: string, score: any): string {
  const file = fileFor(target)

  if (target === "daily") {
    if (action !== "add") return "daily 只支持 add。"
    const bad = scanThreat(content)
    if (bad) return bad
    ensureDir(path.dirname(file))
    fs.appendFileSync(file, `- ${stamp()} ${content}\n`, "utf8")
    return `已记入今日流水：${content}`
  }

  // user / memory: long-term -> stage for approval instead of writing.
  const bad = scanThreat(content || oldText)
  if (bad) return bad
  const items = readPending()
  if (action === "add" || action === "replace") {
    const s = clampScore(score)
    if (s < 3) return `这条重要性只有 ${s} 分（3 分以下不进长期），已留在今日流水里，不用再记。`
    const id = nextId()
    items.push({ id, target, score: s, content: withDateTag(content) })
    writePending(items)
    return `已提交待批准（id=${id}，${target}，${s} 分）：${content}。等用户确认后再正式写入长期档案。`
  }
  if (action === "remove") {
    // Removing an existing durable entry still needs approval; encode as a special proposal.
    const id = nextId()
    items.push({ id, target, score: 5, content: `__REMOVE__ ${oldText}` })
    writePending(items)
    return `已提交删除待批准（id=${id}，${target}）：${oldText}`
  }
  return `未知操作：${action}`
}

function applyPending(ids: string[] | "all"): string {
  const items = readPending()
  const chosen = ids === "all" ? items : items.filter((i) => ids.includes(i.id))
  if (!chosen.length) return "没有匹配的待批准条目。"
  const results: string[] = []
  const remaining = items.filter((i) => !chosen.includes(i))

  for (const it of chosen) {
    const file = fileFor(it.target)
    const limit = LIMITS[it.target] ?? 2200
    let entries = readEntries(file)
    if (it.content.startsWith("__REMOVE__ ")) {
      const oldText = it.content.slice("__REMOVE__ ".length)
      const { index, ambiguous } = findIndex(entries, oldText)
      if (index < 0) results.push(`✗ ${it.id} 未找到：${oldText}`)
      else if (ambiguous) results.push(`✗ ${it.id} 匹配多条：${oldText}`)
      else {
        entries = entries.filter((_, i) => i !== index)
        writeEntries(file, entries)
        results.push(`✓ 已删除：${oldText}`)
      }
    } else {
      if (entries.some((e) => e.toLowerCase() === it.content.toLowerCase())) {
        results.push(`· ${it.id} 已存在，跳过`)
      } else if (charCount(entries) + it.content.length + 1 > limit) {
        results.push(`✗ ${it.id} 超出 ${it.target} 上限，需先整理`)
      } else {
        entries.push(it.content)
        writeEntries(file, entries)
        recordScores([{ target: it.target, content: it.content, score: it.score }])
        results.push(`✓ 已写入 ${it.target}：${it.content}`)
      }
    }
  }
  writePending(remaining)
  return results.join("\n")
}

function rejectPending(ids: string[] | "all"): string {
  const items = readPending()
  const chosen = ids === "all" ? items : items.filter((i) => ids.includes(i.id))
  if (!chosen.length) return "没有匹配的待批准条目。"
  writePending(items.filter((i) => !chosen.includes(i)))
  return `已丢弃 ${chosen.length} 条待批准。`
}

// ----- history search, scoped to the phone companion agents only -----
function recallHistory(query: string, limit: number): string {
  if (!fs.existsSync(SESSION_DB)) return "会话库不存在。"
  let db: Database
  try {
    db = new Database(SESSION_DB, { readonly: true })
  } catch (e: any) {
    return `打不开会话库：${e?.message ?? e}`
  }
  try {
    const placeholders = COMPANION_AGENTS.map(() => "?").join(",")
    const rows = db
      .query(
        `select s.agent as agent, s.title as title, s.time_created as ts, p.data as pdata, m.data as mdata
         from part p
         join message m on m.id = p.message_id
         join session s on s.id = p.session_id
         where s.agent in (${placeholders})
           and p.data like ?
         order by p.time_created desc
         limit ?`,
      )
      .all(...COMPANION_AGENTS, `%${query}%`, limit) as any[]
    if (!rows.length) return `没找到跟「${query}」有关的陪伴记录。`
    const out: string[] = []
    for (const r of rows) {
      let text = ""
      try {
        const pd = JSON.parse(r.pdata)
        if (pd.type === "text") text = pd.text ?? ""
        else continue
      } catch {
        continue
      }
      let role = "?"
      try {
        role = JSON.parse(r.mdata)?.role ?? "?"
      } catch {}
      const d = new Date(r.ts)
      const when = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      out.push(`[${when} ${role}] ${text.slice(0, 300)}`)
    }
    return out.join("\n\n") || `没找到跟「${query}」有关的文字记录。`
  } finally {
    db.close()
  }
}

function memorySnapshot(): string {
  const parts: string[] = []
  const user = readEntries(fileFor("user"))
  const mem = readEntries(fileFor("memory"))
  parts.push(`## USER（${charCount(user)}/${LIMITS.user}）\n${user.map((e) => `- ${e}`).join("\n") || "(空)"}`)
  parts.push(`## MEMORY（${charCount(mem)}/${LIMITS.memory}）\n${mem.map((e) => `- ${e}`).join("\n") || "(空)"}`)
  let today = ""
  try {
    today = fs.readFileSync(dailyFile(), "utf8").trim()
  } catch {}
  parts.push(`## 今日流水\n${today || "(空)"}`)
  const pend = readPending()
  if (pend.length) parts.push(`## 待批准（${pend.length}）\n${pend.map((p) => `${p.id} [${p.target}] ${p.score}分 ${p.content}`).join("\n")}`)
  return parts.join("\n\n")
}

function run(cmd: string, args: string[]) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", timeout: 15000 }).trim()
  } catch (e: any) {
    return `(失败: ${e?.message ?? String(e)})`
  }
}
function phoneSnapshot() {
  const lines: string[] = []
  const battery = run("termux-battery-status", [])
  if (battery && !battery.startsWith("(失败")) {
    try {
      const b = JSON.parse(battery)
      lines.push(`电量 ${b.percentage}%${b.plugged && b.plugged !== "UNPLUGGED" ? "（充电中）" : ""}，电池温度 ${b.temperature}°C`)
    } catch {
      lines.push(battery)
    }
  } else lines.push(`电池信息不可用 ${battery}`)
  try {
    const t = fs.readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf8").trim()
    if (t) lines.push(`CPU 温度 ${(Number(t) / 1000).toFixed(1)}°C`)
  } catch {}
  const free = run("free", ["-m"])
  const memLine = free.split("\n").find((l) => l.startsWith("Mem:"))
  if (memLine) {
    const p = memLine.split(/\s+/)
    if (p.length > 2) lines.push(`内存 已用 ${p[2]}MB / 共 ${p[1]}MB`)
  }
  const up = run("uptime", [])
  if (up) lines.push(`运行状态：${up}`)
  return lines.join("\n")
}

export default async function DailyCompanion() {
  return {
    tool: {
      memory: tool({
        description:
          "管理记忆。target=daily 立即写入当天流水；target=user/memory 是长期档案，会先进入待批准队列，等用户确认。action=add/replace/remove，replace/remove 用 old_text 子串定位。score 给 1~5 的重要性分（默认 3，3 分以下不进长期，只留流水）。",
        args: {
          action: z.enum(["add", "replace", "remove"]),
          target: z.enum(["user", "memory", "daily"]),
          content: z.string().optional(),
          old_text: z.string().optional(),
          score: z.number().optional().describe("1~5 重要性分"),
        },
        async execute(args) {
          const content = (args.content ?? "").trim()
          const oldText = (args.old_text ?? "").trim()
          if ((args.action === "add" || args.action === "replace") && !content) return "content 不能为空。"
          if ((args.action === "replace" || args.action === "remove") && !oldText) return "old_text 不能为空。"
          return mutate(args.target, args.action, content, oldText, args.score)
        },
      }),

      memory_review: tool({
        description:
          "查看/批准/丢弃待写入长期档案的条目。action=list 列出；action=approve 批准（ids 传 'all' 或 id 列表）；action=reject 丢弃。",
        args: {
          action: z.enum(["list", "approve", "reject"]),
          ids: z.string().optional().describe("'all' 或逗号分隔的 id"),
        },
        async execute(args) {
          if (args.action === "list") {
            const items = readPending()
            if (!items.length) return "没有待批准条目。"
            return items.map((i) => `${i.id} [${i.target}] ${i.score}分 ${i.content}`).join("\n")
          }
          const raw = (args.ids ?? "all").trim()
          const ids: string[] | "all" =
            raw === "all" || raw === "" ? "all" : raw.split(",").map((s) => s.trim()).filter(Boolean)
          return args.action === "approve" ? applyPending(ids) : rejectPending(ids)
        },
      }),

      recall: tool({
        description: "读取全部记忆（USER、MEMORY、今日流水、待批准）。需要回忆时使用。",
        args: {},
        async execute() {
          return memorySnapshot()
        },
      }),

      recall_history: tool({
        description:
          "在【手机端日常助手】的历史对话里搜索原话（只搜陪伴/管家/定时会话，不碰电脑端与编程会话）。用户提到以前聊过的事、需要翻旧账时使用。",
        args: {
          query: z.string(),
          limit: z.number().optional(),
        },
        async execute(args) {
          return recallHistory(args.query, args.limit ?? 5)
        },
      }),

      phone_status: tool({
        description: "读取手机当前状态：电量、充电、电池温度、CPU 温度、内存、运行时长。",
        args: {},
        async execute() {
          return phoneSnapshot()
        },
      }),

      dream_diary: tool({
        description: "追加一条第一人称的梦境日记到 memory/dreams.md。只给人看，不作为记忆来源。梦境复盘时使用。",
        args: {
          entry: z.string().describe("两三句、半梦半醒口吻的独白"),
        },
        async execute(args) {
          const text = args.entry.trim()
          if (!text) return "内容为空。"
          const file = path.join(MEMORY_DIR, "dreams.md")
          ensureDir(MEMORY_DIR)
          const when = new Date().toISOString().slice(0, 16).replace("T", " ")
          fs.appendFileSync(file, `\n## ${when}\n\n${text}\n`, "utf8")
          return "已写入梦境日记。"
        },
      }),
    },
  }
}
