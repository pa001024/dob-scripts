// ==UserScript==
// @id s91v3ejWgT
// @name yh-mg
// @description 异环自动音游 可后台
// @author pa
// @version 1.0.0
// @category 异环
// @date 2026/04/24 17:59
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
    if (cc(frame, 1529, 54, 0xc2c2c4, 10)) {
        return "mg"
    }
    return "unknown"
}

let ks = new Set()
/**
 * @param {KeyEnum} k
 * @param {number} d
 */
async function sendKey(k, d) {
    if (ks.has(k)) return
    ks.add(k)
    await sleep(d)
    await kb(hwnd, k)
    ks.delete(k)
}

async function mgLoop() {
    /** @type{KeyEnum[]} */
    let key = ["d", "f", "j", "k"]
    const x = [369, 650, 951, 1232]
    const c = [0x55f1ff, 0xfeca7b, 0xff7f68, 0xff8cff]
    const y = 725
    const mxl = 12
    while (checkState() === "mg") {
        for (let i = 0; i < x.length; i++) {
            const po = frame.find_color(x[i], y, mxl, c[i], 10, "btt")
            if (po) {
                const d = y - po[1]
                sendKey(key[i], ~~(d * 2.8))
            }
        }
        await sleep(33)
    }
}
async function main() {
    while (true) {
        const state = checkState()
        setStatus("state", state)
        switch (state) {
            case "mg":
                await mgLoop()
                break
        }
        await sleep(1000)
    }
}
main()
