const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) {
    throw new Error("未找到窗口或非管理员权限")
}
checkSize(hwnd)
function checkStop() {
    return hwnd === getForegroundWindow()
}

async function fastBuy() {
    while (checkStop()) {
        await moveC(hwnd, 212, 329, 300)
        await moveC(hwnd, 1095, 518, 400)
        await moveC(hwnd, 960, 612, 400)
        await moveC(hwnd, 212, 329, 300)
        await sleep(300)
        mc(hwnd, 212, 329)
        await sleep(300)
    }
}

fastBuy()
