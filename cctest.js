// ==UserScript==
// @id fCclJZwJnl
// @name cctest
// @description 分类器实时测试工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/2/23 18:23:42
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd)

/** @param {Mat} frame */
function checkState(frame) {
    if (cc(frame, 46, 274, 0xffffc2, 10)) {
        if (cc(frame, 85, 354, 0x000000, 10)) {
            return "battle"
        } else {
            return "pre"
        }
    } else {
        if (cc(frame, 1044, 795, 0xe1b454, 10)) {
            return "finish"
        } else {
            if (cc(frame, 348, 285, 0x000000, 10)) {
                if (cc(frame, 508, 623, 0x34a981, 10)) {
                    return "next"
                } else {
                    return "confirm"
                }
            } else {
                if (cc(frame, 167, 353, 0x000000, 10)) {
                    if (cc(frame, 34, 358, 0x000000, 10)) {
                        return "battle2"
                    } else {
                        return "enter"
                    }
                } else {
                    if (cc(frame, 1479, 799, 0xffffff, 10)) {
                        return "esc"
                    } else {
                        if (cc(frame, 474, 371, 0x000000, 10)) {
                            return "escconfirm"
                        }
                    }
                }
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
