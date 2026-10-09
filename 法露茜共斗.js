// ==UserScript==
// @id ceVS8EbEGi
// @name 法露茜共斗
// @description 没细调 but it works
// @author pa
// @version 1.1.0
// @category 活动
// @date 2026/10/06 18:05
// ==/UserScript==

import { Cap } from "cap"

const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

// initOcr()

const g = {
    /** @type ReturnType<checkState> */
    state: "unknown",
    ehp: 0,
    php: 0,
    stage: 0,
    debug: false,
}

// ===== 可调参数 =====
const CFG = {
    lowHp: 40, // 低血量阈值(0-100)。原代码写 0.4 在 0-100 刻度下几乎永不触发，已修正
    eVerifyMs: 600, // E 之后观察窗口：放宽到 600ms，等回血/掉血动画走完，避免误判刷Q
    phpUpNeed: 0.5, // 认定"回上血"的 php 涨幅(百分点)。窗口放宽后阈值同步放宽，原 0.8 太严
    ehpDownNeed: 0.3, // 认定"打出伤害"的 ehp 降幅(百分点)。ehp条537px，1px≈0.19%，0.3可滤1px抖动
    atkWindowMs: 2500, // 常态攻击检测窗口：这么久 ehp 还不掉就认为没打中(原1500太紧，BOSS转阶段无敌会误触发)
    eMinGap: 800, // E 节流：两次 E 至少间隔
    qMinGap: 4000, // Q/M追踪节流：避免高频刷屏(原2500太短)
    eFailNeed: 2, // E验证连续失败几次才补Q/追踪：单次失败只记数，不动作，过滤偶发抖动
}

/** @param {Mat} frame  */
function checkState(frame) {
    if (cc(frame, 46, 26, 0xffffff, 30)) {
        return "battle"
    } else {
        if (c.croi(c.frame.roi(649, 552, 14, 16), "625e93e4ec0b5354", 10)) {
            return "finish"
        } else {
            if (cc(frame, 1537, 880, 0x000000, 10)) {
                if (cc(frame, 1180, 769, 0xcbd3eb, 10)) {
                    return "enter"
                }
                if (cc(frame, 121, 509, 0xffde9e, 10)) {
                    return "room"
                }
                if (cc(frame, 114, 509, 0x717684, 10)) {
                    return "room_esc"
                }
            } else {
                if (cc(frame, 536, 63, 0xff3e3e, 10)) {
                    if (cc(frame, 522, 60, 0x000000, 10)) {
                        return "battle_lowhp"
                    }
                } else {
                    if (cc(frame, 1350, 206, 0xc79b99, 10)) {
                        return "x"
                    }
                }
            }
        }
    }
    return "unknown"
}

/** @param {Mat} roi  */
function numocr(roi) {
    const ct = [
        { k: "0", v: "4bd04b530f5b170e" },
        { k: "1", v: "3c38b0b0b3b3936c" },
        { k: "2", v: "f0a0a2b9b2a78dca" },
        { k: "3", v: "e5d0abb265c329c8" },
        { k: "4", v: "e56c336ccd989a48" },
        { k: "5", v: "04f02bf9b4531f0e" },
        { k: "6", v: "667cc55b3d985282" },
        { k: "6", v: "7516cdc99dd83222" },
        { k: "7", v: "330b6b4b1b370d68" },
        { k: "8", v: "0df6e1638dd02b0e" },
        { k: "9", v: "63cc9363c9720f2a" },
        { k: "", v: "52c956bbc336f00c" },
    ]
    const chasharr = ct.map(v => v.v)
    const filterd = colorFilter(roi, [0xfbfbbb], 100)
    const bboxs = segmentChars(filterd, 1, 2)
    const chars = bboxs.map(v => filterd.roi(...v))
    const hashs = chars.map(v => perceptualHash(v))

    if (g.debug) setStatus("roi", filterd)
    if (g.debug) setStatus("chars", chars, chars.map(v => perceptualHash(v)).join("\n"))
    const ret = hashs
        .map(v => {
            const r = matchHammingHash(v, chasharr, 30)
            return r >= 0 && ct[r].k !== "米" ? ct[r].k : ""
        })
        .join("")
    return ret
}

async function main() {
    let count = 0
    let fi = false
    const qcd = new Timer()
    const ecd = new Timer()
    /**  @param {Mat} f @param {number} x @param {number} y @param {number} w @param {number} cc */
    const fp = (f, x, y, w, cc) => {
        const p = f.find_color(x, y, w, cc, 40, "ltr")
        if (!p) return 0
        return ((p[0] - x) * 100) / w
    }
    // 同步读双血条：直接 cap，不依赖后台采样，避免 E 前后对比拿到旧帧
    // find_color 找不到返回 0，这里保留 0 并标记 ok=false，调用方自行决定是否采信
    const readBarsSync = () => {
        const f = c.cap()
        const ehpRaw = fp(f, 536, 63, 537, 0x2d2d2d)
        const phpRaw = fp(f, 125, 863, 175, 0x394047)
        return {
            php: ehpRaw === 0 || phpRaw === 0 ? 0 : phpRaw,
            ehp: ehpRaw === 0 || phpRaw === 0 ? 0 : ehpRaw,
            ok: ehpRaw !== 0 && phpRaw !== 0,
            phpRaw,
            ehpRaw,
        }
    }
    setInterval(async () => {
        g.state = checkState(c.cap())
        setStatus("state", g.state)
        if (g.state.startsWith("battle")) {
            const r = readBarsSync()
            // 找不到血条时保持旧值，避免 0/100 跳变污染趋势判断
            if (r.ok) {
                g.ehp = r.ehp
                g.php = r.php
            }
            setStatus("php", g.php)
            setStatus("ehp", g.ehp)
        }
    }, 100)

    // ===== 检测1：E 回血验证 =====
    // E 前快照 before，窗口内分两次采样取最优(php取最大/ehp取最小)，
    // 避免单次采样正好卡在回血动画前导致误判刷Q
    // 返回 "ok"(php升且ehp降) | "needQ"(ehp降但php没升=有伤害无回血=标记掉了) | "lost"(都没动=不在范围)
    /** @param {{php:number,ehp:number}} before */
    const verifyE = async before => {
        await sleep(CFG.eVerifyMs - 200)
        const a1 = readBarsSync()
        await sleep(200)
        const a2 = readBarsSync()
        const ok1 = a1.ok
        const ok2 = a2.ok
        if (!ok1 && !ok2) return "lost"
        // php取大(抓住延迟回血)、ehp取小(抓住延迟掉血)，比平均更抗窗口抖动
        const after = {
            php: Math.max(ok1 ? a1.php : -1, ok2 ? a2.php : -1),
            ehp: Math.min(ok1 ? a1.ehp : 999, ok2 ? a2.ehp : 999),
            ok: true,
        }
        if (!after.ok) return "lost"
        g.php = after.php
        g.ehp = after.ehp
        const dPhp = after.php - before.php
        const dEhp = after.ehp - before.ehp
        setStatus("verify", `dPhp=${dPhp.toFixed(2)} dEhp=${dEhp.toFixed(2)}`)
        console.debug(`E验证 dPhp=${dPhp.toFixed(2)} dEhp=${dEhp.toFixed(2)}`)
        const phpUp = dPhp > CFG.phpUpNeed
        const ehpDown = dEhp < -CFG.ehpDownNeed
        if (phpUp && ehpDown) return "ok"
        if (ehpDown && !phpUp) return "needQ"
        return "lost"
    }

    // 怪物不在攻击范围内：M 中键锁定 + 跳起下落追踪 + Q 重挂 + 左键蹭一下
    const chaseTarget = async () => {
        qcd.reset()
        console.debug("E验证失败/目标丢失：M锁定跳追+补Q")
        await c.play("M#0.1 _#0.3_#0.3 +3(q#0.3)#0.8 L")
    }
    // 有伤害无回血：Q 标记掉了，轻量补 Q + 左键，不跳追
    const remarkTarget = async () => {
        qcd.reset()
        console.debug("有伤害无回血：补Q重挂标记")
        await c.play("q#0.3 L #0.2")
    }

    // ===== 检测2：常态攻击掉血检测 =====
    // 记录窗口起点 ehp，超过 atkWindowMs 还没掉 ehpDownNeed 就认为没打中
    let atkEhpRef = null
    let atkTRef = Date.now()
    // E验证连续失败计数：达到 eFailNeed 才补Q/追踪，单次失败只记数
    let eFailStreak = 0

    const timer = new Timer()
    while (true) {
        switch (g.state) {
            case "battle":
            case "battle_lowhp": {
                const roi = c.frame.roi(60, 72, 24, 24)
                const s = +numocr(roi)
                if (fi) {
                    await c.play("M#0.1_#0.3_#0.3 +3(q#0.3)#0.8 L")
                    fi = false
                }
                if (s && s <= 10) {
                    if (s > g.stage && timer.elapsed() > 2e3) {
                        qcd.reset()
                        timer.reset()
                        console.debug("切换stage 执行跳QE")
                        await c.play("M#0.1 _#0.3_#0.3 +3(q#0.3)#0.8 L #0.3e") // 追BOSS
                    }
                    g.stage = s
                    setStatus("stage", s)
                }

                // --- 检测2：攻击是否掉血(先做，窗口到了就处理一次) ---
                const now = Date.now()
                if (atkEhpRef == null) {
                    atkEhpRef = g.ehp
                    atkTRef = now
                } else if (now - atkTRef > CFG.atkWindowMs) {
                    const dEhp = g.ehp - atkEhpRef
                    if (dEhp > -CFG.ehpDownNeed && qcd.elapsed() > CFG.qMinGap) {
                        // ehp defs 几乎没动：在打空气
                        console.debug(`攻击无掉血 dEhp=${dEhp.toFixed(2)}，执行追踪`)
                        await chaseTarget()
                        atkEhpRef = g.ehp
                        atkTRef = Date.now()
                        break // 本轮不再普攻，下轮重新观察
                    }
                    atkEhpRef = g.ehp
                    atkTRef = now
                }

                // --- 检测1：低血量 E + 趋势验证(替代原来"过一段时间就Q") ---
                if (g.php < CFG.lowHp && ecd.elapsed() > CFG.eMinGap) {
                    ecd.reset()
                    const before = readBarsSync()
                    if (!before.ok) {
                        console.debug("读不到血条，跳过本次E验证")
                        break
                    }
                    console.debug("低血量 执行E")
                    await c.play("M +2(e0.05#0.05)")
                    const res = await verifyE(before)
                    // 验证后刷新攻击检测参考点，避免重复触发检测2
                    atkEhpRef = g.ehp
                    atkTRef = Date.now()
                    if (res === "ok") {
                        console.debug("E验证通过：回上血且怪掉血")
                        eFailStreak = 0
                    } else if (res === "needQ") {
                        // 怪掉血但自己没回 = Q标记掉了，连续失败才补Q
                        eFailStreak++
                        console.debug(`E验证:有伤害无回血(${eFailStreak}/${CFG.eFailNeed})`)
                        if (eFailStreak >= CFG.eFailNeed && qcd.elapsed() > CFG.qMinGap) {
                            await remarkTarget()
                            eFailStreak = 0
                        }
                    } else {
                        // 两者都没动 = 怪不在范围，连续失败才M锁定跳追
                        eFailStreak++
                        console.debug(`E验证:目标丢失(${eFailStreak}/${CFG.eFailNeed})`)
                        if (eFailStreak >= CFG.eFailNeed && qcd.elapsed() > CFG.qMinGap) {
                            await chaseTarget()
                            eFailStreak = 0
                        }
                        // 节流中或次数不够：什么都不做，等下次E再验证(之前这里会绕过节流直接补Q，是频繁Q的主因)
                    }
                    break // 本轮不再发普攻串，避免掩盖刚验证出的趋势
                }
                await c.play("z+4(ML0.1#0.15) MR0.2 e#0.1")
                break
            }
            case "room":
                // 剩余进度检测
                if (cc(c.frame, 121, 509, 0xffde9e, 10)) {
                    await c.play("L(940,742) #2")
                } else await c.play("{esc}")
                break
            case "room_esc":
                await c.play("{esc} #1 L(1190,775) #1")
                break
            case "enter":
                // 筛选并进房
                await c.play(
                    "L(839, 742)#0.1 L(137,779)#0.4 L(644,671)#0.1 L(281, 377)#0.1 L(377, 381)#0.1 L(474, 376)#0.1 L(969,673)#0.4 L(1416,227)#0.1"
                ) // 铜币 红豆 JJB
                if (cc(c.frame, 130, 779, 0xcdd4ec, 10)) {
                    await c.play("L(1512,191)#0.1 L(1418,279)#0.1L(1190,775)#0.5")
                    fi = true
                } else {
                    await c.kb("esc")
                }
                break
            case "finish":
                console.log(`Excellent! finished ${++count} times`)
                c.mc(839, 742)
                await sleep(2e3)
                break
            default:
            case "unknown":
                await sleep(1000)
                if (g.state === "unknown") c.mc(839, 742)
                break
        }
        await sleep(100)
    }
}
main()
