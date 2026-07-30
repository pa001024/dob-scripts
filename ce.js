// ==UserScript==
// @id -
// @name ce
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/07/13 18:35
// ==/UserScript==

const hwnd = getWindowByProcessName("SpaceCraft.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd, 1920, 1080)
async function main() {
    for (let i = 0; i < 8; i++) {
        mc(hwnd, 959, 802) // 不锈钢
        await sleep(500)
        mc(hwnd, 881, 590) // 是
        await sleep(500)
        mc(hwnd, 956, 468) // 交付
        await sleep(500)
        mc(hwnd, 881, 590) // 是
        await sleep(1400)
    }
}
main()
