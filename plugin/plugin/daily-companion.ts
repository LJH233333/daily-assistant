import { tool } from "@opencode-ai/plugin"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execFileSync } from "node:child_process"

const z = tool.schema

const CONFIG_DIR = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config")
const MEMORY_DIR = process.env.DAILY_COMPANION_MEMORY ?? path.join(CONFIG_DIR, "opencode", "memory")

function ensureDir(d: string) {
  fs.mkdirSync(d, { recursive: true })
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

// 记忆（存/整理/取）已由后台记忆引擎（DC-20）接管，插件不再提供记忆工具。
export default async function DailyCompanion() {
  return {
    tool: {
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
