// ==UserScript==
// @id -
// @name capc
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/09/21 20:44
// ==/UserScript==

const hwnd = getForegroundWindow()
if (!hwnd) throw new Error("未找到窗口")
// checkSize(hwnd, 1600, 930)
function printPos() {
    const pos = getMousePos(hwnd)
    const text = `L(${pos[0]},${pos[1] - 30})`
    copyText(text)
    // console.log(text)
}

printPos()
