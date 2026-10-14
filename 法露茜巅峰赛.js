// ==UserScript==
// @id Qi4eoqq-Ih
// @name 法露茜巅峰赛
// @description 1.6
// @author pa
// @version 1.2.0
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
            "伊薇",
            "法露茜",
        ],
        "法露茜"
    ),
    marcoi: readConfig("进场宏", "默认", "string", "#1.5 q#2.2 +4(e #0.5) w0 +2(#1 >) d0 w2 d^"),
    marcob: readConfig("战斗宏(仅伊薇用)", "默认为ws交替按e", "string", "z0.1 w0.2 e0.1 e2 w^ #0.3 s0.2 s0 e0.1 e2 s^ #0.3"),
    skip: readConfig("跳过结算", "不记录分数", "boolean", false),
}

const gameState = {
    mp: 0,
    state: "unknown",
    php: 0,
    debug: false,
    t: 0, // php最后一次成功采样的时刻，后台 interval 维护
}

// ===== 巅峰赛追怪A参数(ehp已去掉，只看php) =====
const CFG = {
    lowHp: 40, // 低血量阈值(0-100)
    eVerifyMs: 600, // E 之后观察窗口
    phpUpNeed: 0.5, // 认定"回上血"的 php 涨幅(百分点)
    eMinGap: 800, // E 节流
    qMinGap: 4000, // 补Q节流
    chaseMinGap: 6000, // 重追踪冷却(巅峰赛小怪多，比共斗10s短)
    eFailNeed: 2, // E验证连续失败几次才补Q/追踪
    eForceNeed: 6, // 熔断：连续失败到该次数直接强制追怪
    eAsyncMinAge: 400, // 节律E无阻塞验证最小评估年龄
    phpCap: 95, // php高于该值视为满血：涨无可涨，直接视为ok
    periodicQMs: 6000, // 满血无法验证时，定时轻量补Q转火
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

// ===== php读取(共斗坐标沿用，ehp已删) =====
/**  @param {Mat} f @param {number} x @param {number} y @param {number} w @param {number} cc */
const fp = (f, x, y, w, cc) => {
    const p = f.find_color(x, y, w, cc, 40, "ltr")
    if (!p) return 0
    return ((p[0] - x) * 100) / w
}
const readPhpSync = frame => {
    const f = frame || c.cap()
    const phpRaw = fp(f, 125, 863, 175, 0x394047)
    return {
        php: phpRaw,
        ok: phpRaw !== 0,
        phpRaw,
    }
}

// ===== 战斗追踪状态(无ehp) =====
const qcd = new Timer()
const ecd = new Timer()
const chaseCd = new Timer()
let needInitLock = false
let eFailStreak = 0
let pendingE = null

function resetBattleTracking() {
    eFailStreak = 0
    pendingE = null
}

// E验证统一分类(只看php)： "ok" | "lost"(小幅抖动/掉血=没回上) | "lostHard"(完全静止) | null(满血不判)
const classifyE = (before, after) => {
    if (before.php > CFG.phpCap) return null // 满血涨无可涨，不判
    const dPhp = after.php - before.php
    if (dPhp > CFG.phpUpNeed) return "ok"
    if (Math.abs(dPhp) < 0.1) return "lostHard"
    return "lost"
}

/** @param {{php:number}} before */
const verifyE = async before => {
    await sleep(CFG.eVerifyMs - 200)
    const a1 = readPhpSync()
    await sleep(200)
    const a2 = readPhpSync()
    if (!a1.ok && !a2.ok) return "lost"
    // php取大，抓住延迟回血
    const after = {
        php: Math.max(a1.ok ? a1.php : -1, a2.ok ? a2.php : -1),
        ok: true,
    }
    gameState.php = after.php
    const dPhp = after.php - before.php
    setStatus("verify", `dPhp=${dPhp.toFixed(2)}`)
    console.debug(`E验证 dPhp=${dPhp.toFixed(2)}`)
    return classifyE(before, after)
}

const chaseTarget = async () => {
    qcd.reset()
    chaseCd.reset()
    console.debug("目标丢失：M锁定跳追+补Q")
    await c.play("M#0.1 _#0.3_#0.3L +3(q#0.3)#0.8 L")
}
const remarkTarget = async () => {
    qcd.reset()
    console.debug("E没回上血：补Q重挂标记")
    await c.play("+3(q0.1#0.3e0.1) L #0.2")
}

const handleEVerict = async (res, src) => {
    if (!res) return false
    if (res === "ok") {
        console.debug(`E验证通过(${src})：回上血`)
        eFailStreak = 0
        return false
    }
    // lost / lostHard：先轻量补Q，连续失败或静止才跳追
    const hard = res === "lostHard"
    eFailStreak++
    console.debug(`E验证:没回上血(${src} ${eFailStreak}/${CFG.eFailNeed})${hard ? "[静止]" : ""}`)
    if (eFailStreak >= CFG.eForceNeed) {
        console.debug(`!!! E验证连续失败${eFailStreak}次，强制追怪`)
        await chaseTarget()
        eFailStreak = 0
        return true
    }
    if (hard || eFailStreak >= CFG.eFailNeed) {
        if (chaseCd.elapsed() > CFG.chaseMinGap && qcd.elapsed() > CFG.qMinGap) {
            // 静止=必定不在范围，直接跳追；普通失败先轻量补Q
            if (hard) {
                await chaseTarget()
            } else {
                await remarkTarget()
            }
            eFailStreak = 0
            return true
        }
        console.debug(`追踪被冷却拦住 qcd=${(qcd.elapsed() / 1000).toFixed(1)}s chaseCd=${(chaseCd.elapsed() / 1000).toFixed(1)}s`)
    }
    return false
}

// 追怪A：单轮(由外层 main 循环反复调用)
async function doFaluBattleOnce() {
    if (needInitLock) {
        await c.play("M#0.1_#0.3_#0.3 +3(q#0.3)#0.8 L")
        needInitLock = false
    }

    // 节律E无阻塞验证：e在上轮底部已打出，本轮用后台php当after判定
    if (pendingE) {
        const age = Date.now() - pendingE.t
        if (age > 5000 || Date.now() - gameState.t > 1500) {
            pendingE = null
        } else if (age >= CFG.eAsyncMinAge) {
            const eb = pendingE
            pendingE = null
            await handleEVerict(classifyE(eb, { php: gameState.php }), "节律")
        }
    }

    // 低血量 E + 回血验证
    if (gameState.php < CFG.lowHp && ecd.elapsed() > CFG.eMinGap) {
        ecd.reset()
        const before = readPhpSync()
        if (!before.ok) {
            console.debug("读不到php，跳过本次E验证")
            return
        }
        console.debug("低血量 执行E")
        await c.play("M +2(e0.05#0.05)")
        const res = await verifyE(before)
        await handleEVerict(res, "低血")
        return
    }

    // 满血无法用E验证：定时轻量补Q，保证转火不A空气
    if (gameState.php > CFG.phpCap && qcd.elapsed() > CFG.periodicQMs) {
        console.debug("满血定时补Q转火")
        await remarkTarget()
        return
    }

    // 普攻串：追着怪A
    await c.play("z+4(ML0.1#0.15) MR0.2")
    pendingE = { php: gameState.php, t: Date.now() }
    await c.play("e#0.1")
}

async function battleLoop() {
    switch (config.zhukong) {
        case "伊薇":
            while (gameState.state === "battle") {
                await c.play(config.marcob)
                await sleep(1)
            }
            break
        case "法露茜":
        default:
            await doFaluBattleOnce()
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
        let text = +(await ocrText(roi))
        const timer = new Timer()
        while (isNaN(text) || !text) {
            await sleep(300)
            roi = frame.roi(724, 381, 147, 55)
            text = +(await ocrText(roi))
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
        const f = c.cap()
        gameState.state = checkState(f)
        setStatus("state", gameState.state)
        if (gameState.state === "battle" || gameState.state === "move") {
            const r = readPhpSync(f)
            if (r.ok) {
                gameState.php = r.php
                gameState.t = Date.now()
            }
            setStatus("php", gameState.php)
        }
    }, 100)
    await sleep(100)
    let moved = false
    let prevState = "unknown"
    while (true) {
        setStatus("state", gameState.state)
        // 波次切换 move->battle：重新M+Q锁怪(替代共斗的stage OCR)
        if (prevState === "move" && gameState.state === "battle" && moved) {
            needInitLock = true
        }
        prevState = gameState.state
        switch (gameState.state) {
            case "unknown":
                if (config.skip) {
                    c.mc(674, 792)
                    moved = false
                    resetBattleTracking()
                }
                break
            case "finish":
                if (config.skip) {
                    c.mc(674, 792)
                } else {
                    await handleFinish(c.frame)
                }
                moved = false
                resetBattleTracking()
                break
            case "battle":
                await battleLoop()
                break
            case "move":
                if (moved) {
                    await battleLoop()
                } else {
                    await moveLoop()
                    resetBattleTracking()
                    needInitLock = true
                    if (config.skip) {
                        handleFinish(c.frame, true)
                    }
                }
                moved = true
                break
            case "start":
                c.mc(1370, 812)
                resetBattleTracking()
                await sleep(1000)
                break
        }
        await sleep(100)
    }
}
main()
