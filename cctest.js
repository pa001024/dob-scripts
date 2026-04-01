// ==UserScript==
// @id fCclJZwJnl
// @name cctest
// @description 分类器实时测试工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/3/24 15:15:36
// ==/UserScript==

const hwnd = getCGWindow() || getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd) throw new Error("未找到窗口")
checkSize(hwnd)

/** @param {Mat} frame */
function checkState(frame) {
    if (cc(frame,576,790,0xDBB361,20)) {
        return "finish"
    } else {
        if (cc(frame,46,25,0xF2FFFF,20)) {
            if (cc(frame,984,68,0x000003,20)) {
                return "battle"
            } else {
                return "move"
            }
        } else {
            if (cc(frame,1539,871,0x000000,20) && !(cc(frame,984,68,0x000003,20))) {
                return "start"
            }
        }
    }
    return "unknown"
}
async function main() {
    let i = 0
    const timer = new Timer()
    while (true) {
        const frame = captureWindowWGC(hwnd)
        const state = checkState(frame)
        setStatus("result", state)
        // setStatus("img", frame)
        // imshow("1", frame)
        if (state !== "unknown") {
            // imwrite(state+".png",frame)
        }
        i++
        if (timer.elapsed() > 1000) {
            setStatus("fps", i)
            i = 0
            timer.reset()
        }
    }
}
main()
