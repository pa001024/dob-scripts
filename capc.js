const hwnd = getForegroundWindow()
if (!hwnd) throw new Error("未找到窗口")
// checkSize(hwnd, 1600, 930)
function printPos() {
    const pos = getMousePos(hwnd)
    const text = `c.mc(${pos[0]},${pos[1] - 30})`
    copyText(text)
    // console.log(text)
}

printPos()
