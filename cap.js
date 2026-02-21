// ==UserScript==
// @id soVQY-JOtK
// @name cap
// @description 批量截图工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/2/22 04:00:35
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd) {
    console.log("未找到窗口")
    throw new Error("未找到窗口")
}
checkSize(hwnd)

async function main() {
    let i = readConfig("i", "文件计数", "number", 1)
    while (true) {
        const img = captureWindow(hwnd)
        imwrite(`imgs/cap${i}.png`, img)
        console.log(`imgs/cap${i}.png`)
        i++
        setConfig("i", i)
        await sleep(1000)
    }
}
main()
