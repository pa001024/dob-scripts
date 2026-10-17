// ==UserScript==
// @id ceVS8EbEGi
// @name 法露茜共斗
// @description 没细调 but it works
// @author pa
// @version 1.2.0
// @category 活动
// @date 2026/10/12 08:52
// ==/UserScript==

import { Cap } from "cap"

const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

initOcr()

const g = {
    /** @type ReturnType<checkState> */
    state: "unknown",
    ehp: 0,
    php: 0,
    stage: 0,
    debug: false,
    t: 0, // 双血条最后一次成功采样的时刻，后台 interval 维护
}

// ===== 选房(舞台大厅)：剩余进度 OCR ====
// 基于 imgs/cap129.png 标定(1600x900 客户区)：
// 每行 "100%" 数字区 ROI + 右侧箭头点击点，行间距约110px
const ROOM_ROWS = [
    { ocr: [1290, 200, 90, 40], click: [1415, 228] },
    { ocr: [1290, 312, 90, 40], click: [1415, 338] },
    { ocr: [1290, 422, 90, 40], click: [1415, 448] },
    { ocr: [1290, 532, 90, 40], click: [1415, 558] },
    { ocr: [1290, 642, 90, 40], click: [1415, 668] },
]

/** 粗判是否为满进度房：包含 "100" 即算(兼容 1000%/100/ 等误识)，87%/45%/10% 不会误命中
 * @param {any} t
 */
function isFullRoomText(t) {
    if (!t) return false
    const s = String(t).replace(/\s+/g, "")
    if (s.includes("100")) return true
    if (/1[O0]0/.test(s)) return true
    return false
}

/** OCR 5 行剩余进度，随机返回一个 100% 房下标，无则返回 -1
 * @param {Mat} frame
 */
async function pickFullRoom(frame) {
    const full = []
    for (let i = 0; i < ROOM_ROWS.length; i++) {
        const [x, y, w, h] = ROOM_ROWS[i].ocr
        try {
            const roi = frame.roi(x, y, w, h)
            const big = roi.resize(w * 2, h * 2, "cubic")
            const t = await ocrText(big)
            console.debug(`选房OCR[${i}]: ${JSON.stringify(t)}`)
            if (g.debug) setStatus("room" + i, big, String(t || ""))
            if (isFullRoomText(t)) full.push(i)
        } catch (e) {
            console.debug(`选房OCR[${i}]失败: ${e instanceof Error ? e.message : e}`)
        }
    }
    setStatus("rooms", full.length ? `100%房: ${full.join(",")}` : "无100%房")
    if (!full.length) return -1
    return full[(Math.random() * full.length) | 0]
}

// ===== 可调参数 =====
const CFG = {
    lowHp: 40, // 低血量阈值(0-100)。原代码写 0.4 在 0-100 刻度下几乎永不触发，已修正
    eVerifyMs: 600, // E 之后观察窗口：放宽到 600ms，等回血/掉血动画走完，避免误判刷Q
    phpUpNeed: 0.5, // 认定"回上血"的 php 涨幅(百分点)。窗口放宽后阈值同步放宽，原 0.8 太严
    ehpDownNeed: 0.3, // 认定"打出伤害"的 ehp 降幅(百分点)。ehp条537px，1px≈0.19%，0.3可滤1px抖动
    atkWindowMs: 2500, // 常态攻击检测窗口：这么久 ehp 还不掉就认为没打中(原1500太紧，BOSS转阶段无敌会误触发)
    eMinGap: 800, // E 节流：低血量时两次 E 至少间隔
    qMinGap: 4000, // Q补标记节流：轻量补Q至少间隔
    chaseMinGap: 10000, // M跳追重冷却：两次重追踪至少间隔10s，专治“连续Q两次”
    eFailNeed: 2, // E验证连续失败几次才补Q/追踪：单次失败只记数，不动作，过滤偶发抖动
    atkFailNeed: 2, // 攻击检测连续几个空窗口才追踪：单窗口没掉血(如dEhp=-0.19这种边缘值)只记数
    stageHealJump: 5, // ehp单窗口回涨超该值(百分点)判为转阶段/怪回血，不是没打中，直接跳过追踪
    eForceNeed: 6, // 熔断：E验证连续失败到该次数还追不出去，直接强制追怪，打破死循环
    eAsyncMinAge: 400, // 节律E无阻塞验证：pendingE最小评估年龄(正常一轮循环约1s，天然满足)
    phpCap: 95, // php高于该值视为满血：涨无可涨，验证只看怪掉不掉血
    ehpFloor: 3, // ehp低于该值视为怪将死：不做验证，避免收尾阶段误追
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
    const chaseCd = new Timer() // 重追踪专用长冷却，和轻量补Q的qcd分开
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
                g.t = Date.now()
            }
            setStatus("php", g.php)
            setStatus("ehp", g.ehp)
        }
    }, 100)

    // ===== 检测1：E 回血验证 =====
    // E 前快照 before，窗口内分两次采样取最优(php取最大/ehp取最小)，
    // 避免单次采样正好卡在回血动画前导致误判刷Q
    // 返回 "ok"(php升且ehp降) | "needQ"(ehp降但php没升=有伤害无回血=标记掉了) | "lost"(小幅抖动=疑似不在范围) | "lostHard"(完全静止=必定不在范围) | "stage"(ehp大幅回涨=转阶段/怪回血)
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
        return classifyE(before, after)
    }

    // E verdict统一分类(before/after为{php,ehp})，阻塞验证与节律无阻塞验证共用
    // 返回 "ok" | "needQ"(有伤害无回血=标记掉了) | "lost"(小幅抖动) | "lostHard"(完全静止) | "stage"(转阶段回血) | null(怪将死，不判)
    const classifyE = (before, after) => {
        const dPhp = after.php - before.php
        const dEhp = after.ehp - before.ehp
        if (dEhp > CFG.stageHealJump) return "stage"
        if (before.ehp < CFG.ehpFloor) return null // 怪将死：ehp降无可降，不判
        const ehpDown = dEhp < -CFG.ehpDownNeed
        if (before.php > CFG.phpCap) return ehpDown ? "ok" : "lost" // 满血涨无可涨：只看怪掉不掉血
        const phpUp = dPhp > CFG.phpUpNeed
        if (phpUp && ehpDown) return "ok"
        if (ehpDown && !phpUp) return "needQ"
        if (Math.abs(dPhp) < 0.1 && Math.abs(dEhp) < 0.1) return "lostHard"
        return "lost"
    }

    // 怪物不在攻击范围内：M 中键锁定 + 跳起下落追踪 + Q 重挂 + 左键蹭一下
    const chaseTarget = async () => {
        qcd.reset()
        chaseCd.reset()
        console.debug("E验证失败/目标丢失：M锁定跳追+补Q")
        await c.play("M#0.1 _#0.3_#0.3L +3(q#0.3)#0.8 L")
    }
    // 有伤害无回血：Q 标记掉了，轻量补 Q + 左键，不跳追
    const remarkTarget = async () => {
        qcd.reset()
        console.debug("有伤害无回血：补Q重挂标记")
        await c.play("+3(q0.1#0.3e0.1) L #0.2")
    }

    // ===== 检测2：常态攻击掉血检测 =====
    // 记录窗口起点 ehp，超过 atkWindowMs 还没掉 ehpDownNeed 就认为没打中
    let atkEhpRef = null
    let atkTRef = Date.now()
    // E验证连续失败计数：达到 eFailNeed 才补Q/追踪，单次失败只记数
    let eFailStreak = 0
    // 攻击检测连续空窗口计数：达到 atkFailNeed 才追踪，单窗口边缘值(如-0.19)只记数
    let atkFailStreak = 0
    // 节律E待检快照：底部单提的e打出前记录before，下轮循环用后台血条当after判定
    let pendingE = null

    // E验证统一处理入口(阻塞/无阻塞共用)：只做 streak+冷却+追踪/补Q，不sleep不break
    // src仅用于日志区分("节律"/"低血")，返回是否触发了追踪
    const handleEVerict = async (res, src) => {
        if (!res) return false
        if (res === "ok") {
            console.debug(`E验证通过(${src})：回上血且怪掉血`)
            eFailStreak = 0
            atkFailStreak = 0
            return false
        }
        if (res === "stage") {
            console.debug(`E窗口内转阶段/怪回血(${src})，跳过补Q`)
            eFailStreak = 0
            atkFailStreak = 0
            if (chaseCd.elapsed() > CFG.chaseMinGap && qcd.elapsed() > CFG.qMinGap) {
                await chaseTarget()
                atkEhpRef = g.ehp
                atkTRef = Date.now()
                return true
            }
            return false
        }
        if (res === "needQ") {
            eFailStreak++
            console.debug(`E验证:有伤害无回血(${src} ${eFailStreak}/${CFG.eFailNeed})`)
            if (eFailStreak >= CFG.eFailNeed && qcd.elapsed() > CFG.qMinGap) {
                await remarkTarget()
                eFailStreak = 0
            }
            return false
        }
        // lost / lostHard
        const hard = res === "lostHard"
        eFailStreak++
        console.debug(`E验证:目标丢失(${src} ${eFailStreak}/${CFG.eFailNeed})${hard ? "[静止]" : ""}`)
        if (eFailStreak >= CFG.eForceNeed) {
            console.debug(`!!! E验证连续失败${eFailStreak}次，强制追怪`)
            await chaseTarget()
            eFailStreak = 0
            atkFailStreak = 0
            atkEhpRef = g.ehp
            atkTRef = Date.now()
            return true
        }
        if ((hard || eFailStreak >= CFG.eFailNeed) && chaseCd.elapsed() > CFG.chaseMinGap && qcd.elapsed() > CFG.qMinGap) {
            await chaseTarget()
            eFailStreak = 0
            atkFailStreak = 0
            atkEhpRef = g.ehp
            atkTRef = Date.now()
            return true
        }
        if (hard || eFailStreak >= CFG.eFailNeed) {
            console.debug(`追踪被冷却拦住 qcd=${(qcd.elapsed() / 1000).toFixed(1)}s chaseCd=${(chaseCd.elapsed() / 1000).toFixed(1)}s`)
        }
        return false
    }

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
                        console.debug("切换stage 执行QE")
                        await c.play("M#0.1 +3(q0.1#0.3) +2(e0.2)  #0.3e") // 追BOSS
                    }
                    g.stage = s
                    setStatus("stage", s)
                }

                // --- 节律E无阻塞验证：e在上轮底部已打出，本轮用后台血条当after判定，不sleep不break ---
                if (pendingE) {
                    const age = Date.now() - pendingE.t
                    if (age > 5000 || Date.now() - g.t > 1500) {
                        pendingE = null // 快照过期或血条长时间读不到：不判，直接丢弃
                    } else if (age >= CFG.eAsyncMinAge) {
                        const eb = pendingE
                        pendingE = null
                        await handleEVerict(classifyE(eb, { php: g.php, ehp: g.ehp }), "节律")
                    }
                }

                // --- 检测2：攻击是否掉血(先做，窗口到了就处理一次) ---
                const now = Date.now()
                if (atkEhpRef == null) {
                    atkEhpRef = g.ehp
                    atkTRef = now
                } else if (now - atkTRef > CFG.atkWindowMs) {
                    const dEhp = g.ehp - atkEhpRef
                    if (dEhp > CFG.stageHealJump) {
                        // 怪大幅回血=转阶段/OCR漏检的stage切换：不是没打中，不计失败，刷新基准并补一次转阶段追击
                        console.debug(`疑似转阶段/怪回血 dEhp=+${dEhp.toFixed(2)}，跳过无掉血判定`)
                        atkFailStreak = 0
                        eFailStreak = 0
                        atkEhpRef = g.ehp
                        atkTRef = now
                        if (chaseCd.elapsed() > CFG.chaseMinGap && qcd.elapsed() > CFG.qMinGap) {
                            console.debug("转阶段补偿追击(OCR未识别到)")
                            await chaseTarget()
                            atkEhpRef = g.ehp
                            atkTRef = Date.now()
                            break
                        }
                    } else if (dEhp > -CFG.ehpDownNeed) {
                        // 单窗口没掉血只记数，连续空窗口才追踪；追踪走长冷却chaseCd
                        atkFailStreak++
                        console.debug(`攻击掉血不足 dEhp=${dEhp.toFixed(2)} (${atkFailStreak}/${CFG.atkFailNeed})`)
                        if (atkFailStreak >= CFG.atkFailNeed && chaseCd.elapsed() > CFG.chaseMinGap && qcd.elapsed() > CFG.qMinGap) {
                            console.debug(`攻击连续无掉血，执行追踪`)
                            await chaseTarget()
                            atkFailStreak = 0
                            atkEhpRef = g.ehp
                            atkTRef = Date.now()
                            break // 本轮不再普攻，下轮重新观察
                        }
                    } else {
                        atkFailStreak = 0
                    }
                    atkEhpRef = g.ehp
                    atkTRef = now
                }

                // --- 检测1：低血量 E + 趋势验证(只管低血量释放的E，底部普攻串保持老节奏不动) ---
                if (g.php < CFG.lowHp && ecd.elapsed() > CFG.eMinGap) {
                    // 打不到怪时不按验证E：E回血依赖命中，此时按E只是原地罚站，还会拖住跳追。
                    // 跳过后落到底部普攻串(老节奏自带e)，由攻击检测攒失败直接追怪
                    if (atkFailStreak >= 1) {
                        console.debug("低血量但近期无伤害，跳过E直接追怪")
                        eFailStreak++
                        if (eFailStreak >= CFG.eFailNeed && chaseCd.elapsed() > CFG.chaseMinGap && qcd.elapsed() > CFG.qMinGap) {
                            await chaseTarget()
                            eFailStreak = 0
                            atkFailStreak = 0
                        }
                        atkEhpRef = g.ehp
                        atkTRef = Date.now()
                        break
                    }
                    ecd.reset()
                    const before = readBarsSync()
                    if (!before.ok) {
                        console.debug("读不到血条，跳过本次E验证")
                        break
                    }
                    console.debug("低血量 执行E")
                    await c.play("M +2(e0.05#0.05)")
                    const res = await verifyE(before)
                    await handleEVerict(res, "低血")
                    // 基准点在动作完成后刷新：之前在chase之前刷新会导致追踪的伤害没计入，
                    // 下一个攻击窗口拿着旧基准对比，很容易再判一次“无掉血”形成连Q
                    atkEhpRef = g.ehp
                    atkTRef = Date.now()
                    break // 本轮不再发普攻串，避免掩盖刚验证出的趋势
                }
                // 普攻串：输入序列与老节奏一致，只是e单提成一个play；
                // e打出前用后台血条记before，下轮循环无阻塞判定(不sleep不break)
                await c.play("z+4(ML0.1#0.15) MR0.2")
                pendingE = { php: g.php, ehp: g.ehp, t: Date.now() }
                await c.play("e#0.1")
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
            case "enter": {
                // 筛选(铜币 红豆 JJB)：去掉原末尾固定点第一间的 L(1416,227)，改为下方OCR选100%房
                await c.play(
                    "L(839, 742)#0.1 L(137,779)#0.4 L(644,671)#0.1 L(281, 377)#0.1 L(377, 381)#0.1 L(474, 376)#0.1 L(969,673)#0.4 #0.5"
                )
                if (!cc(c.cap(), 130, 779, 0xcdd4ec, 10)) {
                    await c.kb("esc")
                    break
                }
                // 可选排序：按剩余进度排(保留原1512,191逻辑)，让100%靠前，失败也不影响OCR随机
                await c.play("L(1512,191)#0.5")
                // OCR 5行剩余进度，优先随机选100%房，避免固定点第一间踩到非100%
                let idx = -1
                try {
                    idx = await pickFullRoom(c.cap())
                } catch (e) {
                    console.debug(`选房OCR异常走兜底: ${e instanceof Error ? e.message : e}`)
                }
                if (idx < 0) {
                    console.debug("选房: 无100%房，刷新重试")
                    await c.play("L(1190,775)#0.5") // 无弹窗时命中刷新按钮，有弹窗时命中确认，复用原坐标
                    break
                }
                const [cx, cy] = ROOM_ROWS[idx].click
                console.debug(`选房: 100%房[${idx}] L(${cx},${cy})`)
                await c.play(`L(${cx},${cy})#0.5 L(1190,775)#0.5`)
                fi = true
                break
            }
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
