// ==UserScript==
// @id -
// @name wgc
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/2/20 20:16:40
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd)
async function main() {
    let i = 0
    const timer = new Timer()
    while (true) {
        console.time("1")
        const img = captureWindowWGC(hwnd)
        console.timeEnd("1")
        imshow("img", img)
        await sleep(1000)
        i++
        if (timer.elapsed() > 1000) {
            setStatus("fps", i)
            i = 0
            timer.reset()
        }
    }
}
main()
