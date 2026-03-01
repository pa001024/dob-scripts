// ==UserScript==
// @id soVQY-JOtK
// @name cap
// @description 批量截图工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/2/26 17:57:49
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd) throw new Error("未找到窗口")
checkSize(hwnd)

async function main() {
    let i = readConfig("i", "文件计数", "number", 1)
    const t = readConfig("t", "截图间隔(ms) 设为0单次截图", "number", 1000)
    const timer = new Timer()
    while (true) {
        const img = captureWindow(hwnd)
        imwrite(`imgs/cap${i}.png`, img)
        console.log(`imgs/cap${i}.png`)
        i++
        setConfig("i", i)
        if (t) await timer.sleep(t)
        else break
    }
}
main()
