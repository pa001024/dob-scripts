// ==UserScript==
// @id _qKFWUAUl0
// @name yh-fish
// @description 异环自动钓鱼 可后台
// @author pa
// @version 1.0.0
// @category 异环
// @date 2026/05/11 20:47
// ==/UserScript==

const hwnd = getWindowByProcessName("HTGame.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd)
let frame = captureWindowWGC(hwnd)
function cap() {
    return (frame = captureWindowWGC(hwnd))
}
function checkState() {
    cap()
    if (cc(frame, 1294, 769, 0xd9d9d9, 20)) {
        let roi = frame.roi(1294, 769, 107, 31)
        roi = colorFilter(roi, [0x2c2c2c], 30)
        const r = matchHammingHash(perceptualHash(roi), ["9a697956bc5e03a0"], 20)
        if (r >= 0) {
            return "enter"
        }
    }
    if (cc(frame, 1548, 53, 0xc3c3c6, 10)) {
        if (cc(frame, 1373, 802, 0xffffff, 10)) {
            return "f" // 钓
        }
        if (cc(frame, 1484, 777, 0x207cff, 10)) {
            return "f" // 上钩
        }
        if (cc(frame, 1490, 811, 0xffffff, 10)) {
            return "waiting"
        }
        return "fishing"
    }
    return "unknown"
}
async function fishLoop() {
    /** @type {""|"a"|"d"} */
    let key = ""
    while (checkState() === "fishing") {
        const l = 506
        const r = 1101
        const lr = frame.find_color(l, 61, r - l, 0x29c6ab, 10, "ltr")
        const rr = frame.find_color(r, 61, r - l, 0x29c6ab, 10, "rtl")
        const po = frame.find_color(l, 61, r - l, 0xfff28d, 30, "ltr")
        if (lr && rr && po) {
            const a = po[0] + 1
            const b = (lr[0] + rr[0]) / 2
            setStatus("fish", `${lr[0]} ${rr[0]} ${a}`)
            if (Math.abs(a - b) > 15) {
                const nkey = b > a ? "d" : "a"
                const n2key = b > a ? "a" : "d"
                if (key && key !== nkey) ku(hwnd, key)
                ku(hwnd, n2key)
                kd(hwnd, nkey)
                key = nkey
            } else {
                if (key) ku(hwnd, key)
                key = ""
            }
        } else {
            setStatus("fish", `${lr} ${rr} ${po}`)
            if (key) ku(hwnd, key)
            key = ""
        }
        setStatus("key", key)
        await sleep(100)
    }
}
async function main() {
    const timer = new Timer()
    while (true) {
        const state = checkState()
        setStatus("state", state)
        switch (state) {
            case "enter":
                timer.reset()
                await moveTo(hwnd, 1294, 769)
                mc(hwnd, 1294, 769)
                break
            case "f":
                await kb(hwnd, "f")
                if (timer.elapsed() > 30e3) {
                    console.error("超时")
                    return
                }
                break
            case "fishing":
                timer.reset()
                await fishLoop()
                break
            case "unknown":
                await kb(hwnd, "esc")
                await sleep(800)
                if (timer.elapsed() > 30e3) {
                    console.error("超时")
                    return
                }
        }
        await sleep(100)
    }
    console.error("切换窗口 自动退出")
}
main()
