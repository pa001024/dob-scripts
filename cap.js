// ==UserScript==
// @id -
// @name cap
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/2/17
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd) {
    console.log("未找到窗口")
    throw new Error("未找到窗口")
}
checkSize(hwnd)

async function main() {
    let i = 458
    while (true) {
        const img = captureWindow(hwnd)
        imwrite(`imgs/cap${i}.png`, img)
        console.log(`imgs/cap${i}.png`)
        await sleep(1000)
        i++
    }
}
main()
