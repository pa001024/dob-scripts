// ==UserScript==
// @id fCclJZwJnl
// @name cctest
// @description 分类器实时测试工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/3/15 22:19:29
// ==/UserScript==

const cloud = readConfig("cloud", "云游戏", "boolean", false)
const hwnd = cloud ? getCGWindow() : getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd) throw new Error("未找到窗口")
checkSize(hwnd)

/** @param {Mat} frame */
function checkState(frame) {
    if (cc(frame, 666, 665, 0x040403, 10)) {
        return "buff"
    } else {
        if (cc(frame, 239, 403, 0x000015, 10)) {
            return "battle"
        } else {
            if (cc(frame, 54, 334, 0xfbf9a7, 10)) {
                if (cc(frame, 56, 368, 0xf4fefe, 10)) {
                    return "door2"
                } else {
                    if (cc(frame, 306, 337, 0xfdffff, 10)) {
                        return "event"
                    } else {
                        return "door"
                    }
                }
            } else {
                if (cc(frame, 53, 337, 0xec3335, 20)) {
                    return "event2"
                } else {
                    if (cc(frame, 1492, 862, 0x000001, 10)) {
                        if (cc(frame, 1522, 866, 0x26241f, 10)) {
                            if (cc(frame, 1356, 870, 0x050205, 10)) {
                                return "esc"
                            } else {
                                return "enter"
                            }
                        } else {
                            if (cc(frame, 1192, 52, 0xfffffe, 10)) {
                                return "shop"
                            }
                        }
                    } else {
                        if (cc(frame, 472, 76, 0x010002, 10)) {
                            if (cc(frame, 483, 73, 0xfd3f3e, 10)) {
                                return "battle_boss"
                            }
                        } else {
                            if (cc(frame, 1019, 797, 0xffffff, 10)) {
                                return "esc"
                            } else {
                                if (cc(frame, 407, 359, 0x000000, 10) && cc(frame, 837, 505, 0xd9b360, 10)) {
                                    return "esc_menu"
                                }
                            }
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
        const state = checkState(frame)
        setStatus("result", state)
        setStatus("img", frame)
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
