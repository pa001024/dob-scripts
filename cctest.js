// ==UserScript==
// @id fCclJZwJnl
// @name cctest
// @description 分类器实时测试工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/3/24 15:15:36
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
        this.frame = this.frameless ? captureWindowWGC(this.hwnd) : captureWindowWGC(this.hwnd).roi(0, 30, 1600, 900)
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
    if (cc(frame, 576, 790, 0xdbb361, 20)) {
        return "finish"
    } else {
        if (cc(frame, 46, 25, 0xf2ffff, 20)) {
            if (cc(frame, 984, 68, 0x000003, 20)) {
                return "battle"
            } else {
                return "move"
            }
        } else {
            if (cc(frame, 1539, 871, 0x000000, 20) && !cc(frame, 984, 68, 0x000003, 20)) {
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
        const frame = c.cap()
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
