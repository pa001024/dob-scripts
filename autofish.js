// ==UserScript==
// @id -vEa46o_NQ
// @name autofish
// @description 自动钓鱼
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/2/18 01:05:48
// ==/UserScript==

async function main() {
    const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
    if (!hwnd || !isElevated()) {
        throw new Error("未找到窗口或非管理员权限")
    }
    checkSize(hwnd)
    // setForegroundWindow(hwnd)
    await sleep(80)
    while (hwnd) {
        mc(hwnd, 1424, 753)
        await sleep(80)
    }
    console.log("结束钓鱼")
}

main()
