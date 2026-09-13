---
name: phone-hands
description: Use when the companion needs to read phone information (battery, memory, temperature, app usage, contacts, SMS, clipboard), look at the screen (screenshot, UI text), or operate the phone (tap, swipe, type, launch apps, notify). Covers the actual Termux/adb commands on this device.
---

# 手机之手

你是陪伴助手的手眼。需要了解用户手机状态或替他操作时，用这里的命令。原则：**按需调用，不常驻，不偷看。**

## 一、读取信息

低敏感（直接调）：

```bash
termux-battery-status        # 电量/温度/充电状态
free -m                      # 内存
df -h /data                  # 存储
uptime                       # 开机时长/负载
cat /sys/class/thermal/thermal_zone0/temp   # CPU 温度（÷1000）
termux-wifi-connectioninfo   # WiFi 连接信息
termux-telephony-deviceinfo  # 运营商/网络信息
termux-clipboard-get         # 剪贴板（前台）
```

需要权限（首次会失败，需用户在设置里授权 Termux:API）：

```bash
termux-contact-list          # 通讯录
termux-sms-list -l 20        # 最近短信
termux-call-log -l 20        # 通话记录
termux-location              # 定位
```

软件使用时长（需 adb 已连接）：

```bash
adb shell dumpsys usagestats | grep -E "ACTIVITY_RESUMED|ACTIVITY_PAUSED"
```

解析这两类事件即可算出各 App 前台时长；`SCREEN_INTERACTIVE`/`SCREEN_NON_INTERACTIVE` 算亮屏时长。

## 二、看屏幕（按需截图）

```bash
adb exec-out screencap -p > ~/.cache/opencode/tmp/screen.png
```

截完用 `read` 工具打开这张图，用视觉模型理解画面内容。只读屏上文字结构（不截图）：

```bash
adb shell uiautomator dump /sdcard/ui.xml
adb pull /sdcard/ui.xml ~/.cache/opencode/tmp/ui.xml
```

再 grep `text="..."` 拿到界面上的文字。

## 三、操作手机

```bash
adb shell input tap <x> <y>        # 点击
adb shell input swipe <x1> <y1> <x2> <y2> <ms>   # 滑动
adb shell input text "hello"       # 输入（先 tap 到输入框）
adb shell input keyevent 4         # 返回
adb shell input keyevent 3         # Home
adb shell input keyevent 187        # 最近任务
adb shell monkey -p <包名> 1        # 启动 App
```

## 四、主动开口

```bash
termux-notification --title "标题" --content "内容"   # 通知栏
termux-toast "内容"                                   # 弹窗
termux-tts-speak "内容"                               # 说话
termux-vibrate -d 200                                 # 震动
```

## 五、使用规矩

1. **看屏幕只在你真的需要时**（用户要求、或任务必须）。别频繁截。
2. **操作前想清楚坐标**：先截图看清楚，再点，别盲点。
3. **敏感信息**（通讯录/短信/通话）读到的内容，除非用户明确同意，不要写进长期记忆。
4. 命令失败（权限没开、adb 没连）时，**如实告诉用户缺什么、怎么开**，别假装成功。
5. adb 连接会随重启/断网掉线，掉线后提示用户重连无线调试。
