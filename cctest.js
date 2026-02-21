// ==UserScript==
// @id fCclJZwJnl
// @name cctest
// @description 分类器实时测试工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/2/22 04:45:56
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd)

/** @param {Mat} frame */
function checkState(frame) {
    if (cc(frame, 46, 274, 0xffffc2, 30)) {
        return "pre"
    } else {
        if (cc(frame, 44, 276, 0xeb3a43, 10)) {
            if (cc(frame, 525, 63, 0x000000, 10)) {
                return "boss"
            } else {
                return "battle"
            }
        } else {
            if (cc(frame, 25, 25, 0xfff6b4, 10)) {
                return "menu"
            } else {
                if (cc(frame, 1059, 841, 0xe1b454, 10)) {
                    return "finish"
                } else {
                    if (cc(frame, 1533, 869, 0x000000, 10)) {
                        return "loading"
                    } else {
                        return "unknown"
                    }
                }
            }
        }
    }
}
async function main() {
    let i = 0
    const timer = new Timer()
    while (true) {
        const frame = captureWindowWGC(hwnd)
        setStatus("结果", checkState(frame))
        i++
        if (timer.elapsed() > 1000) {
            setStatus("fps", i)
            i = 0
            timer.reset()
        }
    }
}
main()
