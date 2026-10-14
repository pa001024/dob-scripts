// ==UserScript==
// @id 5-lP9j_W-J
// @name 巅峰赛
// @description 1.5
// @author pa
// @version 1.0.0
// @category 活动
// @date 2026/10/12 08:52
// ==/UserScript==

import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))
initOcr()
const config = {
    zhukong: readConfig(
        "主控",
        "-",
        [
            //"菲娜",
            "伊薇",
        ],
        "伊薇"
    ),
    marcoi: readConfig("进场宏", "默认", "string", "#1.5 q#2.2 +4(e #0.5) w0 +2(#1 >) d0 w2 d^"),
    marcob: readConfig("战斗宏", "默认为ws交替按e", "string", "z0.1 w0.2 e0.1 e2 w^ #0.3 s0.2 s0 e0.1 e2 s^ #0.3"),
    skip: readConfig("跳过结算", "不记录分数", "boolean", false),
}

const gameState = {
    mp: 0,
    state: "unknown",
}

/** @param {Mat} frame */
function checkState(frame) {
    if (cc(frame, 46, 25, 0xffffff, 20)) {
        if (cc(frame, 44, 276, 0xeb3a43, 20) || cc(frame, 41, 280, 0xe33841, 10)) {
            return "battle"
        } else {
            return "move"
        }
    } else {
        if (cc(frame, 582, 791, 0xe1b454, 10)) {
            return "finish"
        } else {
            if (cc(frame, 60, 704, 0x000000, 20)) {
                return "start"
            }
        }
    }
    return "unknown"
}

async function battleLoop() {
    switch (config.zhukong) {
        case "伊薇":
            while (gameState.state === "battle") {
                await c.play(config.marcob)
                await sleep(1)
            }
            break
    }
}

async function moveLoop() {
    await sleep(1000)
    mt(c.hwnd)
    switch (config.zhukong) {
        default:
            await c.play(config.marcoi)
            break
    }
}

// 巅峰赛通用
let times = 0
let last = new Timer()
let max = 0
/** @param {Mat} frame  */
async function handleFinish(frame, skip = false) {
    if (!skip) {
        let roi = frame.roi(724, 381, 147, 55)
        let text = +await ocrText(roi)
        const timer = new Timer()
        while (isNaN(text) || !text) {
            await sleep(300)
            roi = frame.roi(724, 381, 147, 55)
            text = +await ocrText(roi)
            if (timer.elapsed() > 3e3) break
        }
        if (text) {
            if (text > max) {
                console.log(`第${++times}次, 新纪录: ${text} 用时: ${Math.ceil(last.elapsed() / 1e3)}s`)
            } else {
                console.log(`第${++times}次, 分数: ${text} 最高: ${max} 用时: ${Math.ceil(last.elapsed() / 1e3)}s`)
            }
            max = Math.max(text, max)
            last.reset()
        }
        c.mc(674, 792)
        await sleep(2000)
    } else {
        console.log(`第${++times}次, 用时: ${Math.ceil(last.elapsed() / 1e3)}s`)
        last.reset()
    }
}
async function main() {
    setInterval(() => {
        gameState.state = checkState(c.cap())
    }, 100)
    await sleep(100)
    let moved = false
    while (true) {
        setStatus("state", gameState.state)
        switch (gameState.state) {
            case "unknown":
                if (config.skip) {
                    c.mc(674, 792)
                    moved = false
                }
                break
            case "finish":
                if (config.skip) {
                    c.mc(674, 792)
                } else {
                    await handleFinish(c.frame)
                }
                moved = false
                break
            case "battle":
                await battleLoop()
                break
            case "move":
                if (moved) {
                    await battleLoop()
                } else {
                    await moveLoop()
                    if (config.skip) {
                        handleFinish(c.frame, true)
                    }
                }
                moved = true
                break
            case "start":
                c.mc(1370, 812)
                await sleep(1000)
                break
        }
        await sleep(100)
    }
}
main()
