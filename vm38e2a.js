// ==UserScript==
// @id WOGJpf3S1_
// @name vm38e2a
// @description -
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/3/24 16:18:12
// ==/UserScript==

// 煜明 止流扶疏
// 配置 https://dna-builder.cn/char/4201/xVTJj_cqrx
// 刚需穿引 设置默认

const hwnd = getCGWindow()
if (!hwnd) throw new Error("请先启动云游戏")
checkSize(hwnd, 1599, 900)
initOcr()
checkSize(hwnd)
let state = "unknown"
let frame = captureWindowWGC(hwnd)

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

async function battleLoop() {
    cgKey("z")
    for (let c = 0; c < 4; c++) {
        cgKey("e")
        await sleep(100)
        cgClick()
        await sleep(100)
        cgMove(300, 0)
    }
}

async function moveLoop() {
    const timer = new Timer()
    while (timer.elapsed() < 5e3) {
        await sleep(100)
        frame = captureWindowWGC(hwnd)
        if (cc(frame, 1540, 863, 0xf2ddaf, 50)) {
            cgKey("q")
        } else {
            break
        }
    }
    await sleep(1600)
    cgClick(undefined, undefined, "m")
    cgDown()
    await sleep(300)
    cgUp()
    await sleep(500)
    cgDown()
    await sleep(300)
    cgUp()
    await sleep(500)
    await battleLoop()
}

let i = 0
async function handleFinish() {
    let roi = frame.roi(724, 381, 147, 55)
    let text = +ocrText(roi)
    const timer = new Timer()
    while (isNaN(text) || !text) {
        await sleep(300)
        roi = frame.roi(724, 381, 147, 55)
        text = +ocrText(roi)
        if (timer.elapsed() > 3e3) break
    }
    console.log(`第${++i}次, 出分: ${text}`)
    cgClick(674, 792)
    await sleep(2000)
}
async function main() {
    let moved = false
    while (true) {
        frame = captureWindowWGC(hwnd)
        state = checkState(frame)
        setStatus("state", state)
        switch (state) {
            case "finish":
                await handleFinish()
                moved = false
                break
            case "battle":
                await battleLoop()
                break
            case "move":
                if (moved) {
                    await battleLoop()
                } else await moveLoop()
                moved = true
                break
            case "start":
                cgClick(1370, 812)
                await sleep(1000)
                break
        }
        await sleep(100)
    }
}
main()
