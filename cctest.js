// ==UserScript==
// @id fCclJZwJnl
// @name cctest
// @description 分类器实时测试工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/2/26 20:53:59
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd)

/** @param {Mat} frame */
function checkState(frame) {
    if (cc(frame,47,275,0xFFFFB8,10)) {
        if (cc(frame,67,239,0xFEFEFE,10)) {
            if (cc(frame,527,64,0x000000,10)) {
                if (cc(frame,1537,871,0x000000,10)) {
                    return "battle_boss_inv"
                } else {
                    return "battle_boss"
                }
            } else {
                if (cc(frame,45,251,0xFFFFFF,10)) {
                    return "event"
                } else {
                    if (cc(frame,121,277,0xFFFFFF,10)) {
                        return "event"
                    } else {
                        return "door"
                    }
                }
            }
        } else {
            return "door"
        }
    } else {
        if (cc(frame,44,276,0xEB3A43,10)) {
            if (cc(frame,87,310,0xFCFCFC,10)) {
                return "battle"
            } else {
                return "event"
            }
        } else {
            if (cc(frame,1115,375,0xCD9999,10)) {
                return "esc_menu"
            } else {
                if (cc(frame,23,25,0xFFF2AD,10)) {
                    if (cc(frame,1326,28,0xFFFFFF,10)) {
                        return "buy"
                    } else {
                        if (cc(frame,1407,874,0x000000,10)) {
                            return "esc"
                        } else {
                            return "enter"
                        }
                    }
                } else {
                    if (cc(frame,640,850,0x8FD19E,10)) {
                        return "esc"
                    } else {
                        if (cc(frame,688,474,0x000000,10)) {
                            if (!(cc(frame,1537,871,0x000000,10))) {
                                return "buff"
                            }
                        } else {
                            if (cc(frame,1263,46,0xFFFFFF,10)) {
                                if (cc(frame,1274,46,0x0B0B18,10)) {
                                    return "shop"
                                }
                            } else {
                                if (cc(frame,1115,818,0xFAFAFA,10)) {
                                    return "esc"
                                } else {
                                    if (cc(frame,743,94,0xF2E69D,20)) {
                                        return "finish"
                                    } else {
                                        if (cc(frame,798,749,0x000000,10)) {
                                            return "buff"
                                        } else {
                                            if (cc(frame,1366,356,0xFFFFD6,10)) {
                                                return "buff"
                                            }
                                        }
                                    }
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
        const state=  checkState(frame)
        setStatus("结果", state)
        if(state!=="unknown"&& state!=="door") {
            imwrite(state+".png",frame)
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
