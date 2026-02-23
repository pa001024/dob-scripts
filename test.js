// ==UserScript==
// @id -
// @name test
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/2/23 01:13:08
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
let frame = captureWindowWGC(hwnd)
const gameState = {
    mp: 0,
}
setInterval(() => {
    frame = captureWindowWGC(hwnd)
    gameState.mp = getMP(frame)
}, 20)
/** @param {Mat} frame  */
function getMP(frame) {
    const roi = frame.roi(1302, 859, 243, 4)
    const p = roi.find_bright(243, 2, 243, 150, 0, ">", "rtl")
    const mp = p ? Math.round(p[0] / 2.42) : 0
    setStatus("mp", roi, mp)
    return mp
}
async function recorded() {
    const timer = new Timer()
    kd(hwnd, "w")
    await timer.sleep(100)
    ku(hwnd, "w")
    await timer.sleep(100)
    mc(hwnd)
}

async function main() {}

main()
