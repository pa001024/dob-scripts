// ==UserScript==
// @id soVQY-JOtK
// @name cap2
// @description 批量截图工具
// @author pa
// @version 1.3.0
// @category 开发工具
// @date 2026/04/15 13:48
// ==/UserScript==
const hwnd = getWindowByProcessName("HTGame.exe")
if (!hwnd) throw new Error("未找到窗口")
checkSize(hwnd)

async function main() {
    let i = Date.now()
    const t = readConfig("t", "截图间隔(ms) 设为0单次截图", "number", 0)
    const timer = new Timer()
    while (true) {
        const img = captureWindowWGC(hwnd)
        imwrite(`imgs/cap${i}.png`, img)
        console.log(`imgs/cap${i}.png`)
        if (t) await timer.sleep(t)
        else break
    }
}
main()
