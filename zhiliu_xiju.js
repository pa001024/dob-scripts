// ==UserScript==
// @id pF1ssKWk3X
// @name zhiliu_xiju
// @description 止流戏剧 后台
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/2/22 20:04:07
// ==/UserScript==

// 止流带专武裂魂雷月卡/球球蜂
// 队友扶疏黎瑟
// 进去再开 不识别外面的界面

const config = {
    useQ1: readConfig("搓BUFF", "Boss阶段是否释放Q1（6命别选）", "boolean", false),
    useQ1B: readConfig("小怪层搓BUFF", "小怪阶段是否释放Q1（6命别选）", "boolean", false),
    onlyL1: readConfig("LV1", "仅第一层寻路", "boolean", true),
    preBuff: readConfig("2+层提前Q", "需勾选LV1才生效", "boolean", true),
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
}

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd)

let frame = captureWindowWGC(hwnd)
let autoAimX = false
let autoAimY = false
let isFirstMap = true
const autoAimoffsetY = -100
const gameState = {
    dx: 0,
    dy: 0,
    distance: 0,
    angle: 0,
    mp: 0,
}
function checkStop() {
    return true
}

/**
 * 检查技能状态
 * @param {Mat} img 窗口截图
 */
function checkSkill(img) {
    const skill_orb = [
        cc(img, 1437, 810, 0xececed, 10),
        cc(img, 1433, 811, 0xececed, 10),
        cc(img, 1439, 819, 0xececed, 10),
        cc(img, 1439, 819, 0xececed, 10),
        cc(img, 1445, 816, 0xececed, 10),
    ]
        .map(v => (v ? "1" : "0"))
        .join("")

    // console.log(skill_orb)
    switch (skill_orb) {
        case "10110": // 无符
            return 0
        case "00110": // BUFF
            return 1
        case "01111": // 龙
            return 2
        case "00001": // 剑
            return 3
    }

    return -1
}

/**
 * 找颜色
 * @param {Mat} img 窗口截图
 * @param {number[]} colors 颜色数组
 * @param {string[]} names 颜色名称数组
 */
function findColors(img, colors, names, threshold = 10) {
    const xOffset = config.mainLoc[0]
    const yOffset = config.mainLoc[1]
    const roi = img.roi(...config.mainLoc)
    const filtered = colorFilter(roi, colors, threshold)
    const closed = morphologyEx(filtered, "close", 4)
    const contours = findContours(closed, 100).filter(c => c.area < 420 && c.bbox[2] < 28 && c.bbox[3] < 28)
    /** @type {{center: [number, number], bbox: [number, number, number, number], color: string, door: Mat}[]} */
    const matches = []
    for (const c of contours) {
        const door = roi.roi(...c.bbox)
        let match = -1
        const doorf = colorFilter(door, [0xffffc5], 20)
        const chars = segmentChars(doorf).map(v => doorf.roi(...v))
        if (chars.some(v => matchHammingHash(perceptualHash(v), ["4bccf9360638d998"]) >= 0)) {
            match = 0
        }
        const color = names[match]
        if (match !== -1) {
            matches.push({
                center: [c.center[0] + xOffset, c.center[1] + yOffset],
                bbox: [c.bbox[0] + xOffset, c.bbox[1] + yOffset, c.bbox[2], c.bbox[3]],
                color,
                door,
            })
        }
    }
    for (const color of ["黄"]) {
        const match = matches.find(v => color === v.color)
        if (match) {
            setStatus(
                "door",
                matches.map(v => v.door),
                `${matches
                    .map(v => v.color)
                    .sort()
                    .join(" ")} -> ${match.color}`
            )
            const windowCenter = [xOffset + config.mainLoc[2] / 2, yOffset + config.mainLoc[3] / 2]
            const dx = match.center[0] - windowCenter[0]
            const dy = match.center[1] - windowCenter[1]
            const dyi = (dy * 496) / 239 // 椭圆转圆形
            const deg = Math.atan2(dy, dx) * (180 / Math.PI)
            const distance = Math.hypot(dx, dyi)
            // console.log(`dx: ${dx.toFixed(2)}, dy: ${dy.toFixed(2)}, 角度: ${deg.toFixed(2)}, 距离: ${distance.toFixed(2)}m`)
            return {
                match,
                dx,
                dy,
                angle: degTo360(deg + 90),
                distance,
                out: distance > 420,
            }
        }
    }
}

/**
 * 找黄点
 * @param {Mat} img 窗口截图
 */
function findYellow(img) {
    // 滤色 : #FFD984 #C28334 #F0E084
    return findColors(img, [0xffd984, 0xc28334, 0xf0e084], ["黄", "黄", "黄"], 20)
}

/** @param {number} deg */
function degTo360(deg) {
    return (deg + 360) % 360
}

let currentSkill = checkSkill(frame)
/**
 * 准备下一次技能
 * @param {'q'|'q1'|'q2'|'Q2'|'q3'|'z'} skill 技能编号
 */
async function prepareSkill(skill) {
    currentSkill = checkSkill(frame)
    /** @param {"long" | "short"} type 长E或短E */
    async function useSkillEAndCheck(type) {
        await kb(hwnd, "e", type === "long" ? 600 : 10)
        await sleep(type === "long" ? 600 : 300)
        // 更新画面
        currentSkill = checkSkill(frame)
    }
    switch (skill) {
        case "q1":
            if (currentSkill !== 1) await useSkillEAndCheck("long")
            if (currentSkill !== 1) await useSkillEAndCheck("long")
            break
        case "q2":
            if (currentSkill !== 2 && currentSkill !== 3) await useSkillEAndCheck("short")
            if (currentSkill !== 2) await useSkillEAndCheck("long")
            break
        case "Q2":
            if (currentSkill !== 2 && currentSkill !== 3) await useSkillEAndCheck("short")
            if (currentSkill !== 2) await useSkillEAndCheck("long")
            break
        case "q3":
            if (currentSkill !== 3) await useSkillEAndCheck("short")
            if (currentSkill !== 3) await useSkillEAndCheck("short")
            break
    }
}
/**
 * 使用技能
 * @param {'q'|'q1'|'q2'|'Q2'|'q3'|'z'} skill 技能编号
 */
async function useSkill(skill) {
    await prepareSkill(skill)
    /**
     * 通过轮询 mp 是否下降判断 Q 是否成功释放，失败则重按 Q。
     * @param {number} pressMs 按键时长
     * @param {number} timeoutMs 总超时时间
     */
    async function pressQUntilMpReduced(pressMs = 10, timeoutMs = 2e3) {
        const timer = new Timer()
        while (checkStop() && timer.elapsed() < timeoutMs) {
            const before = gameState.mp
            await kb(hwnd, "q", pressMs)
            const pollTimer = new Timer()
            while (checkStop() && pollTimer.elapsed() < 350) {
                if (gameState.mp < before) {
                    return true
                }
                await sleep(20)
            }
            await sleep(60)
        }
        return false
    }
    switch (skill) {
        case "q":
            return await pressQUntilMpReduced(10, 1800)
        case "z":
            await kb(hwnd, "z", 10)
            return true
        case "q1":
            if (currentSkill === 1) {
                const ok = await pressQUntilMpReduced(10, 2e3)
                if (ok) {
                    await sleep(1000)
                }
                return ok
            }
            break
        case "q2":
            if (currentSkill === 2) {
                const ok = await pressQUntilMpReduced(10, 2500)
                if (ok) {
                    await sleep(3300)
                }
                return ok
            }
            break
        case "Q2":
            if (currentSkill === 2) {
                const ok = await pressQUntilMpReduced(500, 3e3)
                if (ok) {
                    await sleep(3300)
                }
                return ok
            }
            break
        case "q3":
            if (currentSkill === 3) {
                const ok = await pressQUntilMpReduced(10, 2e3)
                if (ok) {
                    await sleep(1600)
                }
                return ok
            }
            break
    }
}

/**
 * 检查状态
 * @param {Mat} frame 窗口截图
 */
function checkState(frame) {
    if (cc(frame, 46, 274, 0xffffc2, 30)) {
        return "pre"
    } else {
        if (cc(frame, 44, 276, 0xeb3a43, 10)) {
            if (cc(frame, 525, 63, 0x000000, 10)) {
                return "boss"
            } else {
                return "battle"
            }
        } else {
            if (cc(frame, 25, 25, 0xfff6b4, 10)) {
                return "menu"
            } else {
                if (cc(frame, 1059, 841, 0xe1b454, 10)) {
                    return "finish"
                } else {
                    if (cc(frame, 1533, 869, 0x000000, 10)) {
                        return "loading"
                    } else {
                        return "unknown"
                    }
                }
            }
        }
    }
}

/** @param {Mat} frame  */
function checkMap(frame) {
    const points = [
        cc(frame, 108, 122, 0x080908, 10),
        cc(frame, 103, 136, 0x080908, 10),
        cc(frame, 132, 134, 0x080908, 10),
        cc(frame, 68, 154, 0x080908, 10),
        cc(frame, 113, 61, 0x080908, 10),
        cc(frame, 170, 112, 0x080908, 10),
    ]
        .map(b => (b ? "1" : "0"))
        .join("")
    if (points === "111000") {
        return "left"
    } else {
        return "other"
    }
}

/**
 * 转视角
 * @param {number} angle 角度
 */
async function turn(angle) {
    /** @type {{[key: string]: KeyEnum[]}} */
    const turnKeyMap = {
        "-180": ["s"],
        "-135": ["s", "a"],
        "-90": ["a"],
        "-45": ["w", "a"],
        45: ["w", "d"],
        90: ["d"],
        135: ["s", "d"],
        180: ["s"],
    }
    /** @param {KeyEnum[]} keys @param {number} duration */
    async function tapTurnKeys(keys, duration = 70) {
        for (const key of keys) kd(hwnd, key)
        await sleep(duration)
        for (let i = keys.length - 1; i >= 0; i--) ku(hwnd, keys[i])
    }
    const key = turnKeyMap[`${angle}`]
    if (!key) return
    await tapTurnKeys(key)
    await sleep(16)
    mt(hwnd)
    await sleep(300)
    mt(hwnd)
    await sleep(300)
}

const autoAimCalib = {
    hFovDeg: 90,
    xMm: 100,
    yMm: 100,
    xDeltaPx: Math.abs(-218 - 14.5),
    yDeltaPx: Math.abs(-143.7 - 42),
}

const autoAimModel = (() => {
    const w = config.mainLoc[2]
    const h = config.mainLoc[3]
    const hFovRad = (autoAimCalib.hFovDeg * Math.PI) / 180
    const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) * (h / w))
    const fx = w / 2 / Math.tan(hFovRad / 2)
    const fy = h / 2 / Math.tan(vFovRad / 2)
    const xDegByCalib = (Math.atan(autoAimCalib.xDeltaPx / fx) * 180) / Math.PI
    const yDegByCalib = (Math.atan(autoAimCalib.yDeltaPx / fy) * 180) / Math.PI
    return {
        fx,
        fy,
        mmPerDegX: autoAimCalib.xMm / xDegByCalib,
        mmPerDegY: autoAimCalib.yMm / yDegByCalib,
    }
})()

/**
 * 屏幕投影偏移 -> 摄像机角度 -> mm参数
 * @param {number} dx
 * @param {number} dy
 * @param {{out?: boolean, rawDy?: number}} [opts]
 */
function projectOffsetToMm(dx, dy, opts = {}) {
    let yawDeg = (Math.atan(dx / autoAimModel.fx) * 180) / Math.PI
    const pitchDeg = (Math.atan(dy / autoAimModel.fy) * 180) / Math.PI
    if (opts.out && opts.rawDy) {
        // 边缘点会被压在椭圆上，使用 dx + 椭圆修正后的 dy 计算平面方向角。
        const rawDy = Number.isFinite(opts.rawDy) ? opts.rawDy : dy
        const dyi = (rawDy * 496) / 239
        yawDeg = (Math.atan2(dx, -dyi) * 180) / Math.PI
    }
    return {
        yawDeg,
        pitchDeg,
        mmx: Math.round(yawDeg * autoAimModel.mmPerDegX),
        mmy: Math.round(pitchDeg * autoAimModel.mmPerDegY),
    }
}

/**
 * 自动寻路
 */
async function moveLoop(type = "door") {
    setStatus("fn", "moveLoop")
    async function checkFinish() {
        const state = checkState(frame)
        if (state === "battle" || state === "boss") {
            autoAimX = false
            return true
        }
        if (checkF()) {
            autoAimX = false
            await kb(hwnd, "f", 33)
            await sleep(1000)
            return true
        }
        return false
    }
    const map = checkMap(frame)
    setStatus("map", map)
    switch (map) {
        case "left":
            mt(hwnd)
            await sleep(400)
            kb(hwnd, "4")
            await sleep(300)
            kb(hwnd, "space")
            await sleep(300)
            mc(hwnd)
            await sleep(1000)
            break
    }
    const totalTimeout = new Timer()
    let state = checkState(frame)
    while (checkStop() && state === "pre") {
        state = checkState(frame)
        setStatus("state", state)
        if (state !== type) {
            ku(hwnd, "w")
            setStatus("err")
            return
        }
        if (await checkFinish()) {
            ku(hwnd, "w")
            setStatus("err")
            return
        }
        autoAimX = true
        await sleep(100)
        // 远距离移动
        if (gameState.distance > 20 || (gameState.distance > 10 && gameState.dy < -30) || gameState.dy < -220) {
            autoAimX = false
            kb(hwnd, "4")
            await sleep(500)
            autoAimY = true
            await sleep(300)
            autoAimY = false
            mt(hwnd)
            await sleep(33)
            mc(hwnd)
            await sleep(33)
            mc(hwnd)
            await sleep(500)
            autoAimX = true
        } else {
            kd(hwnd, "w")
            await waitF(500)
            ku(hwnd, "w")
        }
        if (totalTimeout.elapsed() > 20e3) {
            autoAimX = false
            console.log("移动超时")
            await resetLoop()
            return
        }
        await sleep(10)
    }
}

/**
 * 自动战斗
 * @param {string} state 战斗状态
 */
async function battleLoop(state) {
    isFirstMap = false
    setStatus("fn", "battleLoop")
    ku(hwnd, "w")
    const timer = new Timer()
    mt(hwnd) // 锁定BOSS
    await sleep(300)
    await kb(hwnd, "w", 30)
    await useSkill("q2")
    await useSkill("z")
    if (state === "boss" ? config.useQ1 : config.useQ1B) {
        await useSkill("q1")
    }
    while (checkStop()) {
        const state = checkState(frame)
        setStatus("state", state)
        if (state !== "boss") {
            await prepareSkill("q2")
        }
        if (state !== "boss" && state !== "battle" && state !== "unknown") {
            setStatus("fn")
            mt(hwnd)
            return
        }
        if (state === "boss") {
            mt(hwnd) // 锁定BOSS
            await sleep(300)
            await kb(hwnd, "w", 30)
            const x = frame.get_hsl(1366, 863)
            // 神智大于一定值才用q3
            if (x && x[2] > 0.6) {
                await useSkill("q3")
            }
        }
        await sleep(100)
        if (frame.get_hsl(794, 821)[2] < 0.8) {
            await useSkill("q2")
            await useSkill("z")
            if (state === "boss" ? config.useQ1 : config.useQ1B) {
                await useSkill("q1")
            }
            timer.reset()
        } else if (timer.elapsed() > 35e3) {
            mt(hwnd) // 锁定BOSS
            await sleep(300)
            await kb(hwnd, "w", 30)
            await useSkill("q2")
            await useSkill("z")
            if (state === "boss" && config.useQ1) {
                await useSkill("q1")
            }
            timer.reset()
        }
    }
}

/**
 * 重置
 */
async function resetLoop(skip = false) {
    setStatus("fn", "resetLoop")
    kb(hwnd, "esc", 33)
    await sleep(800)
    if (!skip) {
        mc(hwnd, 1115, 820)
        await sleep(500)
        mc(hwnd, 563, 28)
        await sleep(200)
        mc(hwnd, 1014, 380)
        await sleep(200)
        mc(hwnd, 1010, 379)
    }
    mc(hwnd, 999, 506)
    await sleep(500)
    mt(hwnd)
    await sleep(500)
}

const xtimer = setInterval(async () => {
    if (!checkStop()) clearInterval(xtimer)
    kb(hwnd, "x")
}, 2e3)

/** @param {Mat} roi  */
function numocr(roi) {
    const chasharr = [
        "634b634b634b630e", // 0
        "b0b0f0f1515b5ba4", // 1
        "c862624b631f9d1e", // 2
        "e1e0624bf15be09c", // 3
        "0fb463e01fc94ab4", // 4
        "25c9c94ba5634b1e", // 5
        "8d9ca44b9dd8e036", // 6
        "c90f634b4b278de0", // 7
        "f11ef04be05ae01e", // 8
        "48d9f263c862379c", // 9
    ]
    const filterd = colorFilter(roi, [0xffffff], 40)
    // 分割图像
    const bboxs = segmentChars(filterd, 1, 2)
    const chars = bboxs.map(v => filterd.roi(...v))
    const hashs = chars.map(v => perceptualHash(v))
    return hashs
        .map(v => matchHammingHash(v, chasharr, 20))
        .filter(v => v >= 0)
        .join("")
}

/** @param {Mat} frame  */
function getMP(frame) {
    const roi = frame.roi(1302, 859, 243, 4)
    const p = roi.find_bright(243, 2, 243, 150, 0, ">", "rtl")
    const mp = p ? Math.round(p[0] / 2.42) : 0
    setStatus("mp", roi, mp)
    return mp
}
const ftimer = setInterval(async () => {
    if (!checkStop()) clearInterval(ftimer)
    frame = captureWindowWGC(hwnd)
    gameState.mp = getMP(frame)
    if (autoAimX || autoAimY) {
        const door = findYellow(frame)
        if (door) {
            drawBorder(hwnd, ...door.match.bbox)
            const numroi = frame.roi(door.match.bbox[0] - 10, door.match.bbox[1] + door.match.bbox[3] + 7, 30, 15)
            const d = +numocr(numroi)
            if (d) {
                setStatus("d", numroi, d)
            } else {
                setStatus("d")
            }
            gameState.distance = Number.isFinite(d) ? d : 0
            setStatus("route", `传统寻路${autoAimX ? "X" : ""}${autoAimY ? "Y" : ""}: ${~~door.dx}, ${~~door.dy}, ${gameState.distance}m`)
            const first = projectOffsetToMm(door.dx, door.dy + autoAimoffsetY, { out: door.out, rawDy: door.dy })
            setStatus("yawDeg", first.yawDeg)
            if (Math.abs(first.yawDeg) > 40) {
                turn(45 * Math.sign(first.yawDeg))
            }
        } else {
            gameState.distance = 0
        }
    } else {
        setStatus("route")
    }
}, 20)

async function waitF(timeout = 5e3) {
    const timer = new Timer()
    while (timer.elapsed() < timeout) {
        await sleep(50)
        const matched = checkF()
        if (matched) {
            return true
        }
    }
    return false
}

function checkF() {
    const phash = perceptualHash(frame.roi(955, 442, 14, 16))
    const matched = matchHammingHash(phash, ["a6a69e19631c69e2"], 10) >= 0
    return matched
}

async function main() {
    await sleep(100)

    let i = 0
    let finished = 0
    const timer = new Timer()
    while (checkStop()) {
        const state = checkState(frame)
        setStatus("state", state)
        autoAimX = false
        switch (state) {
            case "pre":
                i = 0
                if (isFirstMap || !config.onlyL1) await moveLoop(state)
                else if (config.preBuff) {
                    if (config.useQ1B) await useSkill("q1")
                    await useSkill("q2")
                }
                break
            case "battle":
            case "boss":
                i = 0
                await battleLoop(state)
                break
            case "finish": {
                isFirstMap = true
                const secs = timer.elapsed() / 1e3
                timer.reset()
                console.info(`完成 ${++finished}次 用时 ${~~(secs / 60)}分${~~(secs % 60)}秒`)
                mc(hwnd, 1476, 846)
                await sleep(1500)
                break
            }
            case "loading":
                break
            case "menu":
                mc(hwnd, 1453, 799)
                await sleep(500)
                break
            default:
                if (i++ > 5) {
                    mc(hwnd, 1456, 808)
                    i = 0
                }
                await sleep(300)
                break
        }
        await sleep(15)
    }
}
main()
