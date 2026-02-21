// ==UserScript==
// @id -
// @name te
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/2/22 05:36:31
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd)

let frame = captureWindowWGC(hwnd)
setInterval(() => {
    frame = captureWindowWGC(hwnd)
    setStatus("frame", frame)
}, 10)
async function main() {
    const i = 0
    const timer = new Timer()
    while (true) {
        await sleep(1000)
    }
}
main()
