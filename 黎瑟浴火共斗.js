// ==UserScript==
// @id MwAFNpKBQC
// @name 黎瑟浴火共斗
// @description 颗秒
// @author pa
// @version 1.0.0
// @category 活动
// @date 2026/11/16 19:52
// ==/UserScript==

// 黎瑟·浴火 共斗循环：
//   1. 进场判定：右下角Q图标角标显示"30"(大招未开)即视为重新进场(首次进场/重打/换场)，
//      执行开场宏
//      (按W、两次空格分别按住0.5s/0.3s、开大、松开W、隔0.1s按5和6召唤协战同伴扶疏/煜明)
//   2. 角标显示"0"(大招已开)则不按Q(Q是开关，开着再按会关掉)；
//      角标变回"30"时同样会再走一遍开场宏，所以重打不会漏召唤协战
//   3. 瞄准由主循环维护(与开枪解耦)：只要处于大招(Q)开启的战斗状态，就一直 0.3s 按住E循环瞄准
//   4. 开枪：蓄力满(准星上方一点亮度超阈值)立刻左键，按战斗主循环节奏直接轮询该点亮度(不依赖 OCR)
//   5. BOSS 血条变白 = 无敌，蓄力满了也不开枪，等血条恢复红色(见 imgs/cap28.png)
//   6. 被怪打会退出狙击：右侧倍率刻度/关镜提示消失超过 0.7s 就右键补开镜(右键是开/关切换，有冷却)
//   7. 蓄力时间上限：进图/开大后的第一枪最多蓄力 3s(第一枪蓄力更慢)；之后开枪间隔按 1.3s 循环，
//      到上限还没检测到满蓄力也直接开枪

import { Cap } from "cap"

const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

initOcr()

const g = {
    /** @type {"unknown" | "battle" | "battle_lowhp" | "enter" | "room" | "room_esc" | "finish" | "x"} */
    state: "unknown",
    debug: readConfig("debug", "调试", "boolean", false),
}

// ===== debug 开关(默认关闭，可在脚本配置页勾选开启) =====
// 开启后才打印 debug 日志 + 高频 setStatus(state/ult/invincible/stage)，避免刷屏
// 低频 status(rooms/finish) 不受影响，始终上报
/** @param {...any} a */
function dlog(...a) {
    if (g.debug) console.debug(...a)
}
/** @param {string} k @param {...any} a */
function dstatus(k, ...a) {
    if (g.debug) setStatus(k, ...a)
}

// ===== 选房(舞台大厅)：剩余进度 OCR ====
// 基于 imgs/cap1.png / cap2.png 标定(1600x900 客户区)：
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

/** OCR 5 行剩余进度，返回每行文本(失败行为"")
 * @param {Mat} frame
 * @returns {Promise<string[]>}
 */
async function ocrRoomRows(frame) {
    const texts = []
    for (let i = 0; i < ROOM_ROWS.length; i++) {
        const [x, y, w, h] = ROOM_ROWS[i].ocr
        try {
            const roi = frame.roi(x, y, w, h)
            const big = roi.resize(w * 2, h * 2, "cubic")
            const t = await ocrText(big)
            dlog(`选房OCR[${i}]: ${JSON.stringify(t)}`)
            if (g.debug) setStatus("room" + i, big, String(t || ""))
            texts.push(String(t || ""))
        } catch (e) {
            dlog(`选房OCR[${i}]失败: ${e instanceof Error ? e.message : e}`)
            texts.push("")
        }
    }
    return texts
}

/** 从5行文本中选100%房下标，无则返回 -1
 * @param {string[]} texts
 */
function chooseFullRoom(texts) {
    const full = []
    for (let i = 0; i < texts.length; i++) {
        if (isFullRoomText(texts[i])) full.push(i)
    }
    if (!full.length) return -1
    return full[(Math.random() * full.length) | 0]
}

/** OCR 5 行剩余进度，随机返回一个 100% 房下标(无则 -1)，同时带回每行文本
 * @param {Mat} frame
 * @returns {Promise<{ idx: number, texts: string[] }>}
 */
async function pickFullRoom(frame) {
    const texts = await ocrRoomRows(frame)
    const full = []
    for (let i = 0; i < texts.length; i++) {
        if (isFullRoomText(texts[i])) full.push(i)
    }
    setStatus("rooms", full.length ? `100%房: ${full.join(",")}` : "无100%房")
    const idx = full.length ? full[(Math.random() * full.length) | 0] : -1
    return { idx, texts }
}

// ===== 参数(宏直接写死) =====
const CFG = {
    // 开场宏(右下角Q图标角标显示"30"大招未开时执行 = 首次进场/重打/换场)：
    //   w -> 等0.5s -> 空格按住0.5s -> 空格按住0.3s -> q 开大 -> w^ 松开W
    //   -> {5} 等0.1s {6} 召唤协战同伴(扶疏/煜明)
    // 两次空格必须带按住时长(_0.5/_0.3)：用 {space} 瞬点会被游戏吞掉
    // 注意 5/6 必须写成 {5}..{6}：直接写 56 会被解析成"按住5键6秒"
    macroEnter: "w #0.5 _0.5 _0.3 q w^ {5}#0.1{6} #1.3 +3(e#0.35)",
    // 瞄准：不再"一枪一次"，改成主循环维护——只要处于大招(Q)瞄准状态，就一直 0.3 秒循环按住E
    aimHoldMs: 350, // 一轮瞄准按住时长(按住0.3s -> 松开 -> 间隔后再按)
    aimGapMs: 60, // 一轮瞄准按住结束到下一轮之间的间隔
    aimSettleMs: 100, // 按下E后至少按住这么久才允许开枪(等游戏真正进入瞄准状态)
    // 蓄力时间上限(ms)数组：任意长度，按顺序循环开枪
    // 开枪后最多等这么久就开枪(期间蓄力满会提前开枪)；进图/开大后的第一枪用 firstShotCapMs
    shotCycle: [1300, 1300, 1300],
    firstShotCapMs: 3000, // 进图/开大后第一枪的蓄力上限：第一枪蓄力更慢，最多等3秒
    /** 蓄力满判定点(1600x900)：准星上方这一点在满蓄力时会亮起，见 imgs/cap17/22/24/27/32.png */
    fullPoint: /** @type {[number, number]} */ ([788, 406]),
    fullBright: 128, // 该点亮度(三通道均值)过半(255的一半)即算蓄力满；实测满=206~240，未满<120
    shotCdMs: 400, // 两次开枪最小间隔(必须小于蓄力上限，防止同一发满蓄力重复点击)
    unscopedMs: 700, // 连续这么久看不到狙击界面(右侧倍率刻度/关镜提示)就判定脱镜
    recoverGapMs: 2500, // 两次补开镜的最小间隔(右键是开镜/关镜切换，防止连点把镜又关掉)
    qRetryMs: 4000, // 大招未开时按Q的重试间隔(等演出/输入生效，避免连按把大招开关来回切)
    // 选房：开启后当前屏幕没有100%房就直接随机进一间，不再自动滚屏找100%(默认关)
    randomRoomNoScroll: readConfig("无100%随机进房", "开启后屏幕内无100%房就随机进一间，不自动滚屏找", "boolean", false),
    roomScrollMax: 8, // 选房：单轮无100%时最多向下滚动次数，找遍当前列表
    roomScrollWheel: -360, // 选房：每次滚动的滚轮增量(负数向下)
    roomScrollSteps: 7, // 选房：每轮连续滚几次(一次多滚几下，一点点滚太慢)
    roomScrollStepMs: 50, // 选房：同一轮内两次滚动的间隔
    roomScrollDelayMs: 100, // 选房：滚后等待列表稳定再OCR
    roomRefreshMax: 3, // 选房：连续刷新仍无100%则兜底随便进一间，防止死循环
    finishCdMs: 3000, // 结算屏点"离开舞台"后的冷却：界面卡住/加载期间状态仍是finish，防止重复计数和重复点击
}

/** 演绎结束(结算)屏判定，见 imgs/cap7.png
 * 两个金色礼盒图标(基础贡献奖励/本场最佳奖励)实测 rgb≈(255,241,172)/(255,233,167)，
 * 40 张截图里只有结算屏是这种金色；奖励未满足、礼盒变灰时用底部"离开舞台"按钮兜底。
 * 旧版沿用《法露茜共斗》的 croi(649,552,14,16,"625e93e4ec0b5354")，
 * 本模式结算屏该区域只是空卡片背景，哈希永远匹配不上 → finish 永不触发，全部落到 default。
 * @param {Mat} f
 */
function isFinish(f) {
    if (cc(f, 643, 450, 0xfff1ac, 20) && cc(f, 925, 450, 0xffe9a7, 20)) return true
    // 兜底："离开舞台"按钮(白字 + 墨色底)
    return cc(f, 760, 742, 0xf9f9f9, 20) && cc(f, 700, 742, 0x070608, 12) && cc(f, 860, 742, 0x04080f, 12)
}

/** 状态检测，坐标沿用共斗
 * @param {Mat} frame
 * @returns {"battle" | "battle_lowhp" | "enter" | "room" | "room_esc" | "finish" | "x" | "unknown"}
 */
function checkState(frame) {
    // 战斗中左上角图标为白色；容差放宽到60兼容界面变暗(#CBCBCB)
    if (cc(frame, 46, 26, 0xffffff, 60)) {
        return "battle"
    } else {
        if (isFinish(frame)) {
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

/** 幕次数字 OCR(左上角 "幕次 X")
 * @param {Mat} roi
 */
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

/** 大招(Q)是否开启：看右下角Q图标右上角的角标
 * 角标显示 "30" = 大招未开(亮米色底板 #FFFFEx)；显示 "0" = 大招已开
 * 开大后 (1480,788) 正好落在 "0" 的深棕色笔画上(#7B5516，多帧实测完全一致)
 * @param {Mat} f
 */
function isUltActive(f) {
    return cc(f, 1480, 788, 0x7b5516, 60)
}

/** 是否处于狙击(开镜)状态：开镜时右侧会显示 ×2.5/×2/×1.5/×1 倍率刻度和"关镜"提示
 * 被怪打会退出狙击，这些 UI 随之消失(见 imgs/cap17~33、39、40 全部为狙击状态)
 * 取 5 个纯白像素点：4 个倍率刻度点实测 FFFFFF，关镜提示点约 D0D5DB；
 * 其余界面/场景这 5 点均为深色(<0xC0)。命中 ≥4 点才判定在狙击状态
 * (倍率刻度是竖排 4 个点，单独一个亮点(技能特效/白色光束)顶多命中 1~2 个)
 * @param {Mat} f
 */
function isScoped(f) {
    let n = 0
    if (cc(f, 1175, 295, 0xffffff, 60)) n++ // ×2.5
    if (cc(f, 1186, 341, 0xffffff, 60)) n++ // ×2
    if (cc(f, 1207, 391, 0xffffff, 60)) n++ // ×1.5
    if (cc(f, 1189, 450, 0xffffff, 60)) n++ // ×1
    if (cc(f, 1378, 648, 0xffffff, 60)) n++ // "关镜"提示
    return n >= 4
}

/** BOSS血条是否变白(无敌)。白色时血条填充为 #D8~#E1 的浅灰白，正常为红色 #FF3E3E
 * 变白期间不能开枪，等恢复红色再打(见 imgs/cap28.png)
 * @param {Mat} f
 */
function isBossInvincible(f) {
    let white = 0
    // 取血条左侧填充区几个点：BOSS 血量很低时左侧仍有填充，右侧可能已经空了
    for (const x of [542, 552, 562, 572]) {
        const v = f.get_rgb(x, 62)
        const r = (v >> 16) & 0xff
        const g = (v >> 8) & 0xff
        const b = v & 0xff
        if (r > 185 && g > 185 && b > 185) white++
    }
    return white >= 3
}

/** 蓄力是否满：满蓄力时准星上方 (788,406) 会亮起，只取这一个点测亮度
 * 满蓄力实测 rgb 约 (241,149,228)~(255,211,255)，三通道均值 206~240
 * 未满时该点是场景/准星，实测均值 <120(见 imgs/cap17/22/24/27/32.png)
 * @param {Mat} f
 */
function isChargeFull(f) {
    const v = f.get_rgb(CFG.fullPoint[0], CFG.fullPoint[1])
    const r = (v >> 16) & 0xff
    const g = (v >> 8) & 0xff
    const b = v & 0xff
    return (r + g + b) / 3 > CFG.fullBright
}

/** 截图偶尔会失败返回空帧(换局/加载中)：先判空，避免后续取像素直接抛异常
 * 曾导致后台瞄准循环抛异常后静默死掉，从第二局开始E再也不按
 * @param {any} f
 * @returns {boolean}
 */
function hasFrame(f) {
    return !!f && typeof f.get_rgb === "function" && typeof f.roi === "function"
}

async function main() {
    let count = 0
    let noFullStreak = 0 // 选房：连续"滚到底仍无100%"的 enter 轮数，超限则兜底进房防死循环
    let busyUntil = 0 // 进图/开大动作期间暂停蓄力判定
    let lastFinishAt = 0 // 上一次结算屏计数/点击的时刻(冷却内不重复处理)
    let finishHandled = false // 当前这张结算屏是否已处理过(离开finish状态后复位)
    let lastScopedAt = 0 // 最后一次看到狙击界面(开镜 UI)的时刻
    let scopedDbg = false // 上一次的狙击状态(仅在变化时刷新 debug 状态，便于排查)
    let lastRecoverAt = 0 // 最后一次补开镜的时刻
    let lastQAt = 0 // 最后一次按Q开大的时刻
    let lastShotAt = 0 // 最后一次开枪时刻
    let aimHeldNow = false // 此刻是否正按住E瞄准(松开间隙不开枪，避免空放)
    let aimDownAt = 0 // 本轮按下E的时刻(按下后至少 aimSettleMs 才允许开枪)
    let aimReleaseAt = 0 // 上一次松开E的时刻(控制两轮瞄准之间的间隔)
    let aimPaused = false // 暂停瞄准(开场宏/补开镜等独占输入期间)
    let shotIdx = 0 // 进图/开大后已经开了几枪(第一枪不设蓄力上限，之后按循环上限)
    let lastInvAt = 0 // 上一次提示BOSS无敌的时刻(节流)
    let lastStageAt = 0 // 上一次幕次识别的时刻(节流，战斗主循环要快)
    /** @type {string} */
    let prevState = g.state // 上一轮状态：从非战斗回到战斗时给蓄力识别一个宽限期

    /** 当前这一枪的蓄力时间上限(ms)；进图/开大后的第一枪用 firstShotCapMs(3s)
     * 之后按 shotCycle 循环：第二枪/第三枪/第四枪 各 1.3s
     */
    const chargeCapMs = () => (shotIdx === 0 ? CFG.firstShotCapMs : CFG.shotCycle[(shotIdx - 1) % CFG.shotCycle.length])

    /** 松开瞄准(E)，并记录松开时刻(用于两轮瞄准之间的间隔) */
    const releaseAim = () => {
        try {
            c.ku("e") // 松开E
        } finally {
            aimHeldNow = false
            aimReleaseAt = Date.now()
        }
    }

    /** 暂停瞄准(执行开场宏/右键补开镜等独占输入时用)：暂停时立刻松开E @param {boolean} p */
    const pauseAim = (p) => {
        aimPaused = p
        if (p && aimHeldNow) releaseAim()
    }

    /** 瞄准维护：放在主循环里推进(不再用后台 async 循环)
     * 旧版后台 while(true) 一旦某次截图/按键抛异常就静默死掉，表现为"从第二局开始E再也不按"；
     * 主循环每轮都会调用这里，任何单次异常只影响一轮。
     * 只要处于大招(Q)已开的战斗状态，就一直 按住E aimHoldMs -> 松开 aimGapMs -> 再按。
     * 不看 busyUntil：大招演出期间就提前按住E，保证演出结束后的第一枪已经是瞄准状态。
     * 用 kd/ku 而不是 play：避免和主循环的 play 宏互相打断。
     */
    const aimTick = () => {
        const inBattle = g.state === "battle" || g.state === "battle_lowhp"
        const wantAim = inBattle && !aimPaused && hasFrame(c.frame) && isUltActive(c.frame)
        const now = Date.now()
        if (aimHeldNow) {
            // 松开：不再需要瞄准 / 被暂停 / 已经按够时长
            if (!wantAim || now - aimDownAt >= CFG.aimHoldMs) releaseAim()
        } else if (wantAim && now - aimReleaseAt >= CFG.aimGapMs) {
            c.kd("e") // 按住E瞄准
            aimHeldNow = true
            aimDownAt = now
        }
    }

    /** 尝试开枪：满蓄力(准星亮点)或已到蓄力上限、且BOSS不无敌时左键。返回是否已开枪
     * @param {Mat} f @param {boolean} [force] 到蓄力上限强制开枪(不再等满蓄力判定)
     */
    const tryShoot = async (f, force = false) => {
        // 必须正处在瞄准按住期间(且已按下 aimSettleMs)：瞄准是 0.3s 循环，松开间隙或刚按下都算空放
        if (!aimHeldNow || Date.now() - aimDownAt < CFG.aimSettleMs) return false
        const full = isChargeFull(f)
        if (!full && !force) return false
        if (isBossInvincible(f)) {
            if (Date.now() - lastInvAt > 500) {
                lastInvAt = Date.now()
                dstatus("invincible", "BOSS无敌(血条白色)，等待")
                dlog("蓄力满：BOSS无敌，等待血条恢复")
            }
            return false
        }
        if (Date.now() - lastShotAt <= CFG.shotCdMs) return false
        lastShotAt = Date.now()
        shotIdx++
        dlog(full ? "蓄力满：开枪" : "到达蓄力上限：开枪")
        c.mc("l") // 瞄准由 aimTick 持续按住E，开枪只需左键
        await sleep(60)
        return true
    }

    setInterval(() => {
        try {
            const f = c.cap()
            if (!hasFrame(f)) return // 换局/加载中截图可能失败，沿用上一轮状态
            g.state = checkState(f)
            dstatus("state", g.state)
        } catch (e) {
            dlog(`状态检测异常: ${e instanceof Error ? e.message : e}`)
        }
    }, 50)

    while (true) {
        // 瞄准维护：E 的按下/松开全部在主循环里推进，与开枪解耦
        aimTick()
        // 离开结算屏后复位处理开关，下一张结算屏(下一轮结束)才能再次计数/点击
        if (g.state !== "finish") finishHandled = false
        // 从演出/过场回到战斗：重置蓄力上限计时，避免刚回战斗就提前强制开枪
        if ((g.state === "battle" || g.state === "battle_lowhp") && prevState !== "battle" && prevState !== "battle_lowhp") {
            lastShotAt = Date.now()
        }
        prevState = g.state
        try {
            switch (g.state) {
                case "battle":
                case "battle_lowhp": {
                    // 截图偶尔失败(换局/加载中)：本轮先不处理，避免空帧抛异常
                    if (!hasFrame(c.frame)) break
                    // --- 大招未开(角标"30") = 重新进场(首次/重打/换场)：执行开场宏 ---
                    // 开场宏包含 W+两次空格+Q开大+5/6召唤协战同伴；角标"0"=已开则不按(Q是开关)
                    if (!isUltActive(c.frame)) {
                        dstatus("ult", "大招未开(视为重新进场)")
                        if (Date.now() - lastQAt > CFG.qRetryMs) {
                            lastQAt = Date.now()
                            pauseAim(true) // 开场宏独占输入，暂停瞄准
                            dlog("大招未开：执行开场宏(W+空格+Q+5/6)")
                            try {
                                await c.play(CFG.macroEnter)
                            } finally {
                                pauseAim(false)
                            }
                            // 开场宏里已经按过Q：刷新Q时刻，避免角标还没刷新时再按一次把大招关掉
                            lastShotAt = Date.now() // 开大后重新计算瞄准延迟
                            shotIdx = 0 // 进场第一枪：按 firstShotCapMs(3s) 蓄力上限
                            busyUntil = Date.now() + 3000 // 大招演出期间暂停蓄力判定
                        }
                        break
                    }
                    dstatus("ult", "大招已开")
    
                    // --- 幕次识别(仅用于显示，不做任何操作；节流避免拖慢开枪判定) ---
                    if (Date.now() - lastStageAt > 1000) {
                        lastStageAt = Date.now()
                        const s = +numocr(c.frame.roi(60, 72, 24, 24))
                        if (s && s <= 10) setStatus("stage", s)
                        if(s>2) c.kb("z")
                    }
    
                    if (Date.now() < busyUntil) break

                    // --- 狙击状态检测：开镜时右侧有倍率刻度和"关镜"提示，
                    //     被怪打会退出狙击(这套 UI 全部消失，见 imgs/cap41.png)，大招还开着就一直补右键重新开镜 ---
                    const scoped = isScoped(c.frame)
                    if (scoped) lastScopedAt = Date.now()
                    if (scoped !== scopedDbg) {
                        scopedDbg = scoped
                        dstatus("scoped", scoped ? "狙击界面" : "脱镜")
                    }
                    // 连续脱镜超过 unscopedMs 才动作：右键是开镜/关镜"切换"，
                    // 单帧误判按下去反而会把镜关掉，所以要用持续消失来确认
                    if (!scoped && Date.now() - lastScopedAt > CFG.unscopedMs) {
                        if (Date.now() - lastRecoverAt > CFG.recoverGapMs) {
                            lastRecoverAt = Date.now()
                            dlog("脱镜(狙击界面消失)：右键补开镜")
                            pauseAim(true) // 先松开E再右键，避免按键冲突
                            try {
                                // 用宏按住右键0.1s：c.mc("r") 是瞬时按下+松开，实测游戏收不到这个开镜
                                await c.play("R0.1")
                            } finally {
                                pauseAim(false)
                            }
                        }
                        break // 脱镜期间不开枪(此时准星处的亮度不是蓄力指示)
                    }

                    // 瞄准已交给 aimTick 在主循环里持续按住E，这里只负责开枪判定

                    // --- 蓄力时间上限：距上一枪到达上限就开枪(不再等满蓄力判定；第一枪上限 3s) ---
                    if (Date.now() - lastShotAt >= chargeCapMs()) {
                        await tryShoot(c.frame, true) // BOSS无敌时仍会等待
                        break
                    }

                    // --- 满蓄力判定：只测准星上方一点亮度(与检测血条无敌同一节奏)，满了立刻开枪 ---
                    if (isChargeFull(c.frame)) {
                        await tryShoot(c.frame) // 满蓄力但BOSS无敌或冷却中则原地等待
                        break
                    }

                    // --- 未满：等待蓄力(瞄准由 aimTick 持续按住E) ---
                    break
                }
                case "room":
                    // 剩余进度检测；点"参与演绎"进图(进图后由大招角标判定触发开场宏)
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
                    // 无100%则向下滚动继续找，直到找到 / 滚到底 / 达到滚动上限
                    // 「无100%随机进房」开启时：当前屏幕没有100%就直接随机进一间，不滚屏
                    let idx = -1
                    let texts = []
                    try {
                        const picked = await pickFullRoom(c.cap())
                        idx = picked.idx
                        texts = picked.texts
                        if (idx < 0 && CFG.randomRoomNoScroll) {
                            const rows = []
                            for (let i = 0; i < texts.length; i++) {
                                if (String(texts[i] || "").trim()) rows.push(i)
                            }
                            idx = rows.length ? rows[(Math.random() * rows.length) | 0] : (Math.random() * ROOM_ROWS.length) | 0
                            dlog(`选房: 当前屏幕无100%，不滚屏，随机进房[${idx}]`)
                            setStatus("rooms", `随机进房: ${idx}`)
                        }
                        if (idx < 0) {
                            let prevKey = ""
                            let staleRounds = 0
                            for (let sc = 0; sc < CFG.roomScrollMax && idx < 0; sc++) {
                                // 一轮连续滚几下：多次 wheel 事件比单次大 delta 更可靠(游戏常按事件次数滚)
                                for (let k = 0; k < CFG.roomScrollSteps; k++) {
                                    wheel(c.hwnd, 800, 450, CFG.roomScrollWheel)
                                    await sleep(CFG.roomScrollStepMs)
                                }
                                await sleep(CFG.roomScrollDelayMs)
                                try {
                                    texts = await ocrRoomRows(c.cap())
                                } catch (e) {
                                    dlog(`选房滚屏OCR异常: ${e instanceof Error ? e.message : e}`)
                                    continue
                                }
                                idx = chooseFullRoom(texts)
                                const key = texts.join("|")
                                setStatus("rooms", idx >= 0 ? `100%房(滚${sc + 1}): ${idx}` : `无100%房(滚${sc + 1})`)
                                if (idx >= 0) break
                                // 到底判断：连续两轮5行文本完全不变，说明滚不动了
                                if (key === prevKey) {
                                    staleRounds++
                                    if (staleRounds >= 2) {
                                        dlog("选房: 滚到底(列表无变化)，停止滚动")
                                        break
                                    }
                                } else {
                                    staleRounds = 0
                                    prevKey = key
                                }
                            }
                        }
                    } catch (e) {
                        dlog(`选房OCR异常走兜底: ${e instanceof Error ? e.message : e}`)
                    }
                    if (idx < 0) {
                        // 防死循环：连续多轮滚到底+刷新仍无100%，兜底随便进一间(第1行)，不再无限刷新
                        noFullStreak++
                        if (noFullStreak > CFG.roomRefreshMax) {
                            dlog(`选房: 连续${noFullStreak}轮无100%房，兜底进第1间防卡死`)
                            noFullStreak = 0
                            const [fx, fy] = ROOM_ROWS[0].click
                            await c.play(`L(${fx},${fy})#0.5 L(1190,775)#0.5`)
                            break
                        }
                        dlog(`选房: 无100%房(已滚到底 ${noFullStreak}/${CFG.roomRefreshMax})，刷新重试`)
                        await c.play("L(1190,775)#0.5") // 无弹窗时命中刷新按钮，有弹窗时命中确认，复用原坐标
                        break
                    }
                    noFullStreak = 0
                    const [cx, cy] = ROOM_ROWS[idx].click
                    dlog(`选房: 房间[${idx}] L(${cx},${cy})`)
                    await c.play(`L(${cx},${cy})#0.5 L(1190,775)#0.5`)
                    break
                }
                case "finish": {
                    // 点"离开舞台"后界面会卡住/加载一会儿，状态仍是 finish：
                    // 用开关+冷却兜住，保证同一张结算屏只计数、只点一次
                    if (finishHandled || Date.now() - lastFinishAt < CFG.finishCdMs) {
                        finishHandled = true
                        await sleep(300)
                        break
                    }
                    finishHandled = true
                    lastFinishAt = Date.now()
                    console.log(`Excellent! finished ${++count} times`)
                    c.mc(839, 742)
                    await sleep(2e3)
                    break
                }
                default:
                case "unknown":
                    await sleep(1000)
                    if (g.state === "unknown") {
                        c.mc(839, 742)
                        c.mc(1307, 233)
                    }
                    break
            }
        } catch (e) {
            // 单轮异常(截图/OCR/按键偶发失败)只跳过这一轮，不让整个脚本停摆
            console.error("主循环异常，跳过本轮:", e)
            await sleep(300)
        }
        // 战斗中循环要快(蓄力/开枪判定的采样依赖它)；非战斗场景没必要高频
        await sleep(g.state === "battle" || g.state === "battle_lowhp" ? 20 : 100)
    }
}
main()
