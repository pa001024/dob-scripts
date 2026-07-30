// ==UserScript==
// @id -
// @name left
// @description 左键连点
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/07/28 02:35
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd, 1600, 900 + 30)
async function main() {
    while (true) {
        mc(hwnd, 1013, 623 + 30)
        await sleep(100)
        mc(hwnd, 749, 595 + 30)
        await sleep(100)
    }
}
main()
