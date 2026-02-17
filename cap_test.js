// ==UserScript==
// @id immr2gDlW3
// @name cap_test
// @description 截图测试
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/2/17
// ==/UserScript==

async function main() {
    const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
    if (!hwnd) {
        console.log("未找到窗口")
    }
    const frame = captureWindowWGC(hwnd)
    imwrite("test.png", frame)
}

main()
