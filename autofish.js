// ==UserScript==
// @id -vEa46o_NQ
// @name autofish
// @description 自动钓鱼
// @author pa
// @version 1.0.0
// @category 其他
// @date 2/5/2026
// ==/UserScript==

async function main() {
    const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
    if (!hwnd) {
        console.log("未找到窗口")
        return
    }
    checkSize(hwnd)
    setForegroundWindow(hwnd)
    await sleep(80)
    while (hwnd === getForegroundWindow()) {
        mc(hwnd, 1444, 779)
        mc(hwnd, 1504, 794)
        await sleep(80)
    }
    console.log("结束钓鱼")
}

main()
