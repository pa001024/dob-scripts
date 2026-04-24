// ==UserScript==
// @id fCclJZwJnl
// @name cctest
// @description 分类器实时测试工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/4/15 14:34:15
// ==/UserScript==

class Cap {
    constructor() {
        this.frameless = readConfig("无边框", "游戏启动中开启无标题栏", "boolean", false)
        this.hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
        if (!this.hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
        this.yof = this.frameless ? 0 : 30
        checkSize(this.hwnd, 1600, 900 + this.yof)
        /** @type Mat */
        this.frame = this.cap()
    }
    cap() {
        this.frame = this.frameless ? captureWindowWGC(this.hwnd) : captureWindowWGC(this.hwnd, 0, 30, 1600, 900)
        return this.frame
    }
    /** @param {number} x @param {number} y */
    mc(x, y) {
        return mc(this.hwnd, x, y + this.yof)
    }
    /**
     * 按键操作（异步）
     * @param {KeyEnum} key 按键名称
     * @param {number} [duration] 按键持续时间
     */
    async kb(key, duration) {
        await kb(this.hwnd, key, duration)
    }
}
const c = new Cap()

/** @param {Mat} frame */
function checkState(frame) {
    if (cc(frame, 44, 272, 0xffffc7, 10)) {
        if (cc(frame, 527, 64, 0x000000, 10)) {
            if (cc(frame, 541, 61, 0xff3e3e, 10)) {
                return "battle_boss"
            } else {
                return "battle_boss_inv"
            }
        } else {
            if (cc(frame, 67, 239, 0xfefefe, 10)) {
                if (cc(frame, 45, 251, 0xffffff, 10)) {
                    return "event"
                } else {
                    if (cc(frame, 121, 277, 0xffffff, 10)) {
                        return "event"
                    } else {
                        return "door"
                    }
                }
            } else {
                return "door"
            }
        }
    } else {
        if (cc(frame, 44, 273, 0xff5058, 10)) {
            if (cc(frame, 87, 310, 0xfcfcfc, 10)) {
                return "battle"
            } else {
                return "event"
            }
        } else {
            if (cc(frame, 1115, 375, 0xcd9999, 10)) {
                return "esc_menu"
            } else {
                if (cc(frame, 23, 25, 0xfff2ad, 10)) {
                    if (cc(frame, 1326, 28, 0xffffff, 10)) {
                        return "buy"
                    } else {
                        if (cc(frame, 1407, 874, 0x000000, 10)) {
                            return "esc"
                        } else {
                            return "enter"
                        }
                    }
                } else {
                    if (cc(frame, 688, 474, 0x000000, 10)) {
                        if (!cc(frame, 1537, 871, 0x000000, 10)) {
                            return "buff"
                        }
                    } else {
                        if (cc(frame, 640, 850, 0x8fd19e, 10)) {
                            return "esc"
                        } else {
                            if (cc(frame, 1274, 46, 0x0b0b18, 10)) {
                                if (cc(frame, 1263, 46, 0xffffff, 10)) {
                                    return "shop"
                                }
                            } else {
                                if (cc(frame, 1115, 818, 0xfafafa, 10)) {
                                    return "esc"
                                } else {
                                    if (cc(frame, 743, 94, 0xf2e69d, 20)) {
                                        return "finish"
                                    } else {
                                        if (cc(frame, 798, 749, 0x000000, 10)) {
                                            return "buff"
                                        } else {
                                            if (cc(frame, 1366, 356, 0xffffd6, 10)) {
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
    if (cc(frame, 47, 39, 0xffffff, 10) && cc(frame, 48, 209, 0xfefefe, 10)) {
        return "home"
    }
    if (matchHammingHash(perceptualHash(frame.roi(718, 72, 38, 37)), ["778eb05ec974b600"], 10) >= 0) return "finish"
    return "unknown"
}
async function main() {
    let i = 0
    const timer = new Timer()
    while (true) {
        const frame = imread("imgs/cap196.png") || c.cap()
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
