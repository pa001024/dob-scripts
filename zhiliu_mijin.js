// ==UserScript==
// @id JYVs5DxWME
// @name zhiliu_mijin
// @description 止流迷津 1.5
// @author pa
// @version 1.2.5
// @category 其他
// @date 2026/08/08 02:44
// ==/UserScript==

// 说明: 键位和视角设置全默认(!!!!) 视距1.3
// 止流带专武赘生雷月卡/球球蜂 不推荐带防御魔灵 打慢了缺蓝直接寄 潜质攻击威力昂扬老道
// 难度根据情况选 6命选270/300 2命选240
// 密码: 6

const config = {
    门顺序: readConfig(
        "门顺序",
        "设置门颜色优先顺序，按从高到低优先级选择",
        {
            type: "multi-select",
            options: ["黄", "蓝", "大红", "小红"],
        },
        ["黄", "蓝", "大红", "小红"]
    ),
    useQ1: readConfig("搓BUFF", "Boss阶段是否释放Q1（6命别选）", "boolean", false),
    useTripleDoorBuffer: readConfig("三重缓冲", "一定程度上降低找门抖动", "boolean", true),
    moveTimeout: readConfig("移动超时", "移动超时重置间隔(秒)", "number", 25),
    ftime: readConfig("帧间隔", "取帧间隔(毫秒)", "number", 100),
    lock: readConfig("密码", "请查看说明以获取密码", "string"),
    frameless: readConfig("无边框", "无边框窗口", "boolean", false),
    debug: readConfig("debug", "-", "boolean", false),
    single: readConfig("single", "单帧识别", "boolean", false),
    battleTime: readConfig("战斗超时", "超时暂离(秒)", "number", 120) * 1e3,
    /** @type {ROI} */ minimapLoc: [30, 35, 180, 180],
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
}
const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
const yof = config.frameless ? 0 : 30
checkSize(hwnd, 1600, 900 + yof)

function cap13() {
    return config.frameless ? captureWindowWGC(hwnd) : captureWindowWGC(hwnd, 0, 30, 1600, 900)
}
/** @param {number} x @param {number} y */
function rmc(x, y) {
    return mc(hwnd, x, y + yof)
}

let frame = cap13()
let autoAimX = false
let autoAimY = false
const autoAimoffsetY = -150
let findFn = findDoor
/** @typedef {NonNullable<ReturnType<typeof findDoor>>} DoorInfo */
/** @type {DoorInfo[]} */
const doorTripleBuffer = []
let bufferedFindFn = findFn

/**
 * 门识别三重缓冲：
 * - 当前帧无门：不写入、不清空，直接返回空
 * - 缓冲不足3帧：直接返回当前帧结果
 * - 缓冲满3帧后：仅当最近3帧目标颜色一致时才输出
 * @param {DoorInfo | undefined} rawDoor
 * @returns {DoorInfo | undefined}
 */
function getBufferedDoor(rawDoor) {
    if (!rawDoor) {
        return
    }

    doorTripleBuffer.push(rawDoor)
    if (doorTripleBuffer.length > 3) doorTripleBuffer.shift()
    if (doorTripleBuffer.length < 3) return rawDoor

    const c0 = doorTripleBuffer[0].match.color
    const c1 = doorTripleBuffer[1].match.color
    const c2 = doorTripleBuffer[2].match.color
    if (c0 !== c1 || c1 !== c2) return
    return doorTripleBuffer[2]
}
const gameState = {
    dx: 0,
    dy: 0,
    distance: 0,
    angle: 0,
    mp: 0,
    /** @type {ReturnType<typeof checkState>} */ state: "unknown",
}
function checkStop() {
    return hwnd === getForegroundWindow()
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
function findColors(img, colors, names, threshold = 10, mode = "single") {
    // x: 290~1312 y: 168~681
    const xOffset = config.mainLoc[0]
    const yOffset = config.mainLoc[1]
    const roi = img.roi(...config.mainLoc)
    const filtered = colorFilter(roi, colors, threshold)
    const closed = morphologyEx(filtered, "close", 4)
    const contours = findContours(closed, 100).filter(
        c => c.area < 420 && c.bbox[2] < 28 && c.bbox[3] < 28 && (mode !== "multi" || Math.abs(c.bbox[2] - c.bbox[3]) < 2)
    )
    /** @type {{center: [number, number], bbox: [number, number, number, number], color: string, door: Mat}[]} */
    const matches = []
    for (const c of contours) {
        const door = roi.roi(...c.bbox)
        const match = mode === "single" ? colorKeyMatch(door, colors, 50, 10) : 0
        let color = names[match]
        {
            const x = ~~(door.cols() / 2)
            const y = ~~(door.rows() / 2)
            color = color === "红" ? (cc(door, x, y, 0xeb3a43, 40) ? "大红" : "小红") : color
            // setStatus(`doorC${i}`, `color:${color} x:${x}, y:${y}, c:${door.get_rgb(x, y)?.toString(16).padStart(6, "0")}`)
        }
        if (match !== -1) {
            if (mode === "single" && color === "黄") {
                if (!cc(door, 10, 10, 0x000000, 5)) {
                    // 非黄门跳过
                    continue
                }
            }
            matches.push({
                center: [c.center[0] + xOffset, c.center[1] + yOffset],
                bbox: [c.bbox[0] + xOffset, c.bbox[1] + yOffset, c.bbox[2], c.bbox[3]],
                color,
                door,
            })
        }
    }
    for (const color of config.门顺序) {
        const match = matches.find(v => color === v.color)
        if (match) {
            if (config.debug)
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
 * 找门
 * @param {Mat} img 窗口截图
 */
function findDoor(img) {
    // 滤色 : #EB3A43 #FFD772 #868DFF
    return findColors(img, [0xeb3a43, 0xffd772, 0x868dff], ["红", "黄", "蓝"])
}
/**
 * 找黄点
 * @param {Mat} img 窗口截图
 */
function findYellow(img) {
    // 滤色 : #FFD984 #C28334 #F0E084
    return findColors(img, [0xffd984, 0xc28334, 0xf0e084], ["黄", "黄", "黄"], 20, "multi")
}

/** @param {number} deg */
function degTo360(deg) {
    return (deg + 360) % 360
}

/**
 * 小地图找门
 * @param {Mat} img 窗口截图
 */
function findDoorMinimap(img) {
    // x: 290~1312 y: 168~681
    const xOffset = config.minimapLoc[0]
    const yOffset = config.minimapLoc[1]
    const roi = img.roi(...config.minimapLoc)
    // 滤色 : #EB3A43 #FFD772 #797FE6
    const colors = [0xeb3a43, 0xffd772, 0x797fe6]
    const filtered = colorFilterHSL(roi, colors, 60)
    const closed = morphologyEx(filtered, "close", 3)
    // imshow("filtered", closed)
    const contours = findContours(closed, 50)
    /** @type {{center: [number, number], bbox: [number, number, number, number], color: string}[]} */
    const matches = []
    for (const c of contours) {
        if (c.area > 400) continue
        const door = roi.roi(...c.bbox)
        const match = colorKeyMatch(door, colors, 20, 50)
        if (match !== -1) {
            matches.push({
                center: [c.center[0] + xOffset, c.center[1] + yOffset],
                bbox: [c.bbox[0] + xOffset, c.bbox[1] + yOffset, c.bbox[2], c.bbox[3]],
                color: ["红", "黄", "蓝"][match],
            })
        }
    }
    for (const color of config.门顺序) {
        const match = matches.find(v => color.endsWith(v.color))
        if (match) {
            const minimapCenter = [xOffset + config.minimapLoc[2] / 2, yOffset + config.minimapLoc[3] / 2]
            const dpix = Math.sqrt((match.center[0] - minimapCenter[0]) ** 2 + (match.center[1] - minimapCenter[1]) ** 2)
            const deg = Math.atan2(match.center[1] - minimapCenter[1], match.center[0] - minimapCenter[0]) * (180 / Math.PI)
            return {
                match,
                angle: degTo360(deg + 90),
                distance: (dpix * 31) / 51 - 1,
            }
        }
    }
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
        await kb(hwnd, "e", type === "long" ? 800 : 10)
        await sleep(type === "long" ? 800 : 300)
        // 更新画面
        currentSkill = checkSkill(frame)
    }
    const timer = new Timer()
    const timeout = 5e3
    function checkTimeout() {
        return timer.elapsed() < timeout && gameState.state !== "finish"
    }
    switch (skill) {
        case "q1":
            while (currentSkill !== 1 && checkTimeout()) await useSkillEAndCheck("long")
            break
        case "q2":
        case "Q2":
            if (currentSkill === 0) {
                await useSkillEAndCheck("long")
                await useSkillEAndCheck("short")
            }
            while (currentSkill !== 2 && checkTimeout()) {
                if (currentSkill !== 2 && currentSkill !== 3) await useSkillEAndCheck("short")
                if (currentSkill !== 2) await useSkillEAndCheck("long")
            }
            break
        case "q3":
            while (currentSkill !== 3 && checkTimeout()) await useSkillEAndCheck("short")
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
        while (checkStop() && timer.elapsed() < timeoutMs && (gameState.state.includes("battle") || gameState.state === "unknown")) {
            const before = gameState.mp
            await kb(hwnd, "q", pressMs)
            const pollTimer = new Timer()
            while (checkStop() && pollTimer.elapsed() < 350 && (gameState.state.includes("battle") || gameState.state === "unknown")) {
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
    return false
}
async function doge(boss = false) {
    // 原地二段跳
    if (boss) kd(hwnd, "w")
    await kb(hwnd, "space", 100)
    await sleep(500)
    await kb(hwnd, "space", 100)
    await sleep(500)
    if (boss) ku(hwnd, "w")
}

/** 检查状态 @param {Mat} frame */
function checkState(frame) {
    if (cc(frame, 49, 278, 0xffffaf, 33) || cc(frame, 49, 278, 0xd6eeb8, 33)) {
        if (cc(frame, 527, 64, 0x000000, 10)) {
            if (cc(frame, 541, 61, 0xff3e3e, 10)) {
                return "battle_boss"
            } else {
                return "battle_boss_inv"
            }
        } else {
            if (cc(frame, 45, 251, 0xffffff, 10)) {
                return "event"
            } else {
                return "door"
            }
        }
    } else {
        if (cc(frame, 44, 273, 0xff5058, 33) || cc(frame, 45, 274, 0xff4d55, 33) || cc(frame, 49, 278, 0xd56874, 33)) {
            if (cc(frame, 87, 310, 0xfcfcfc, 10)) {
                return "battle"
            } else {
                return "event"
            }
        } else {
            if (cc(frame, 1115, 375, 0xcd9999, 10)) {
                return "esc_menu"
            } else {
                if (cc(frame, 23, 25, 0xfff2ad, 10)) {
                    if (cc(frame, 1326, 28, 0xffffff, 10)) {
                        return "buy"
                    } else {
                        if (cc(frame, 1407, 874, 0x000000, 10)) {
                            return "esc"
                        } else {
                            return "enter"
                        }
                    }
                } else {
                    if (cc(frame, 688, 474, 0x000000, 10)) {
                        if (!cc(frame, 1537, 871, 0x000000, 10)) {
                            return "buff"
                        }
                    } else {
                        if (cc(frame, 640, 850, 0x8fd19e, 10)) {
                            return "esc"
                        } else {
                            if (cc(frame, 1241, 43, 0x090a17, 10)) {
                                if (cc(frame, 1230, 45, 0xffffff, 10)) {
                                    return "shop"
                                }
                            } else {
                                if (cc(frame, 1115, 818, 0xfafafa, 10)) {
                                    return "esc"
                                } else {
                                    if (cc(frame, 743, 94, 0xf2e69d, 20)) {
                                        return "finish"
                                    } else {
                                        if (cc(frame, 798, 749, 0x000000, 10)) {
                                            return "buff"
                                        } else {
                                            if (cc(frame, 1366, 356, 0xffffd6, 10)) {
                                                return "buff"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if (cc(frame, 47, 39, 0xffffff, 10) && cc(frame, 48, 209, 0xfefefe, 10)) {
        return "home"
    }
    if (matchHammingHash(perceptualHash(frame.roi(718, 72, 38, 37)), ["778eb05ec974b600"], 10) >= 0) return "finish"
    return "unknown"
}

/** 检查地图 @param {Mat} frame */
function checkMap(frame) {
    const points = [
        cc(frame, 75, 104, 0x0a0b0a, 10),
        cc(frame, 101, 110, 0x0a0b0a, 10),
        cc(frame, 125, 137, 0x0a0b0a, 10),
        cc(frame, 125, 163, 0x0a0b0a, 10),
        cc(frame, 137, 116, 0x0a0b0a, 10),
        cc(frame, 74, 146, 0x0a0b0a, 10),
        cc(frame, 95, 137, 0x0a0b0a, 10),
        cc(frame, 162, 141, 0x0a0b0a, 10),
        cc(frame, 143, 130, 0x0a0b0a, 10),
        cc(frame, 57, 156, 0x0a0b0a, 10),
        cc(frame, 94, 183, 0x0a0b0a, 10),
    ]
        .map(v => (v ? "1" : "0"))
        .join("")
    /** @param {string} points  */
    function getMap(points) {
        switch (points) {
            case "00101000010":
            case "00101110010":
                return "dash"
            case "01110000010":
            case "11111000010":
            case "10101000110":
            case "11101000110":
            case "11101000000":
            case "11100000110":
            case "11111000000":
            case "11111000011":
                return "zuoguai"
            case "00000111001":
                return "paotai_reset" // 炮台背面
            case "00010111011":
            case "00010111111":
                return "paotai" // 炮台正面
            case "00000000011":
                return "bossfang"
            default:
                if (points.startsWith("1111000")) return "zuoguai"
                return "unknown"
        }
    }
    const state = getMap(points)
    setStatus("map", `${state}: ${points}`)
    // console.log(`${state}: ${points}`)
    return state
}
/**
 * 转视角
 * @param {number} angle 角度
 */
function turn(angle) {
    mm((2057 * angle) / 360, 0)
}

/**
 * 转视角到绝对角度
 * @param {number} angle 角度
 * @param {Mat} [frame] 窗口截图
 */
async function turnAbs(angle, frame) {
    if (!frame) frame = cap13()
    const roiMat = frame.roi(30, 35, 180, 180)
    const rotation = predictRotation(roiMat)
    const delta = ((rotation - angle + 180) % 360) - 180
    if (rotation === angle) return
    turn(-Math.sign(delta) * Math.max(Math.abs(delta), 1))
}

/**
 * 快速移动
 * @param {number} [angle] 角度
 * @param {number} [distance] 距离
 */
async function fastMove(angle, distance) {
    setStatus("fn", "fastMove")
    if (angle !== undefined) await turnAbs(angle)
    if (distance === undefined || distance > 15) {
        await rollAbs(-50)
        await sleep(33)
        await kb(hwnd, "4", 33)
        await sleep(500)
        await kb(hwnd, "space")
        await sleep(300)
        mt(hwnd)
        mc(hwnd) // 下落攻击
    } else {
        kd(hwnd, "w")
        await sleep(33)
        if (distance > 4) await kb(hwnd, "shift")
        await sleep(500 + distance * 300)
        ku(hwnd, "w")
    }
}

/**
 * 转视角到绝对俯仰角
 * @param {number} angle 角度
 */
async function rollAbs(angle) {
    for (let i = 0; i < 12; i++) {
        mm(0, 100) // 视角重置
        await sleep(5)
    }
    await sleep(50)
    const deg = (-700 * (-angle + 90)) / 90
    for (let i = 0; i < 10; i++) {
        mm(0, ~~(deg / 10)) // 视角重置
        await sleep(5)
    }
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

/** @param {number} v @param {number} min @param {number} max */
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v))
}

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

let isPaopai = false
let resetFlag = false
let resetOnce = false
/**
 * 自动寻路
 */
async function moveLoop(type = "door") {
    setStatus("fn", "moveLoop")
    async function checkFinish(t = 0) {
        if (gameState.state.includes("battle")) {
            setStatus("err")
            resetFlag = autoAimX = resetOnce = false
            return true
        }
        if (t ? await waitF(t) : checkF()) {
            setStatus("err")
            resetFlag = resetOnce = autoAimX = false
            await kb(hwnd, "f", 33)
            await sleep(1000)
            return true
        }
        return false
    }
    if (isPaopai) {
        kd(hwnd, "d")
        await sleep(200)
        await kb(hwnd, "space")
        await sleep(400)
        await kb(hwnd, "space")
        await sleep(600)
        ku(hwnd, "d")
        if (checkF()) {
            await kb(hwnd, "f")
        } else {
            await resetLoop()
            await sleep(1000)
        }
        isPaopai = false
        return
    }
    let map = checkMap(frame)
    for (let i = 0; i < 10; i++) {
        mt(hwnd)
        await sleep(500)
        // 多等待几帧 等地图稳定
        const newmap = checkMap(frame)
        if (newmap === map) break
        map = newmap
    }
    if (map === "maybe") {
        await resetLoop()
        await sleep(1000)
        map = checkMap(frame)
    }
    switch (map) {
        case "dash":
            kd(hwnd, "w")
            await sleep(50)
            await kb(hwnd, "shift")
            await sleep(600)
            ku(hwnd, "w")
            mc(hwnd)
            await sleep(1000)
            break
        case "zuoguai":
            await fastMove()
            await sleep(700)
            kd(hwnd, "w")
            await sleep(200)
            kb(hwnd, "shift", 33)
            await sleep(300)
            ku(hwnd, "w")
            turn(-90)
            await fastMove()
            await sleep(500)
            break
        case "paotai_reset":
            if (!cc(frame, 219, 321, 0xffffb4, 10) && resetFlag) {
                kd(hwnd, "d")
                kb(hwnd, "w", 700)
                await sleep(800)
                ku(hwnd, "d")
                isPaopai = true
                resetFlag = false
            }
            break
        case "paotai":
            if (!cc(frame, 219, 321, 0xffffb4, 10)) {
                kd(hwnd, "s")
                await kb(hwnd, "a", 300)
                ku(hwnd, "s")
                await kb(hwnd, "a", 800)
                if (await checkFinish()) {
                    setStatus("err")
                    return
                }
                await kb(hwnd, "w", 700)
                isPaopai = true
                if (await checkFinish()) {
                    setStatus("err")
                }
                await kb(hwnd, "space")
                await sleep(200)
                await kb(hwnd, "space")
                await sleep(200)
                await kb(hwnd, "d", 700)
                return
            }
            break
        case "bossfang":
            turn(-15)
            await fastMove()
            await sleep(700)
            turn(-15)
            await fastMove()
            await sleep(700)
            break
    }
    const totalTimeout = new Timer()
    let state = gameState.state
    let lastd = 0
    const notMoved = new Timer()
    const shiftcd = new Timer()
    while (checkStop() && (state === "event" || state === "door")) {
        state = gameState.state
        setStatus("state", state)
        if (state !== type || (await checkFinish())) {
            ku(hwnd, "w")
            setStatus("err")
            return
        }
        autoAimX = true
        await sleep(100)
        // 远距离移动
        if (gameState.distance > 20 || (gameState.distance > 10 && gameState.dy < -30) || gameState.dy < -220) {
            autoAimX = false
            const yew = gameState.distance > 29 ? -45 : gameState.distance > 20 ? -25 : -12
            // if (config.debug) console.log(`远距离移动: d=${gameState.distance} yew=${yew}`)
            await rollAbs(yew)
            await kb(hwnd, "4")
            await sleep(500)
            await rollAbs(0)
            autoAimY = true
            await waitF(300)
            autoAimY = false
            mt(hwnd)
            if (await checkFinish()) return
            await sleep(33)
            mc(hwnd)
            await sleep(33)
            mc(hwnd)
            if (await checkFinish(500)) return
            autoAimX = true
            notMoved.reset()
        } else {
            kd(hwnd, "w")
            await waitF(200)
            if (gameState.distance >= 7 && shiftcd.elapsed() > 2e3) {
                await kb(hwnd, "shift")
                shiftcd.reset()
            }
            if (Math.abs(lastd - gameState.distance) < 1.5) {
                if (notMoved.elapsed() > 2500) {
                    await kb(hwnd, "space")
                    await sleep(300)
                    await kb(hwnd, "space")
                    notMoved.reset()
                }
            } else if (gameState.distance > 0) {
                notMoved.reset()
            }
            await waitF(500)
            ku(hwnd, "w")
            lastd = gameState.distance
        }
        if (totalTimeout.elapsed() > config.moveTimeout * 1e3) {
            autoAimX = false
            if (resetOnce) {
                await exitAction()
                resetOnce = false
                return
            }
            console.log("移动超时")
            await resetLoop()
            resetFlag = true
            resetOnce = true
            return
        }
        await sleep(10)
    }
}

/**
 * 自动战斗
 * @param {ReturnType<typeof checkState>} state 战斗状态
 */
async function battleLoop(state) {
    setStatus("fn", "battleLoop")
    ku(hwnd, "w")
    const timer = new Timer()
    const timer2 = new Timer()
    mt(hwnd) // 锁定BOSS
    await sleep(300)
    await kb(hwnd, "w", 30)
    await useSkill("q2")
    await useSkill("z")
    if (state.includes("boss") && config.useQ1) {
        await useSkill("q1")
    }
    while (checkStop()) {
        if (config.battleTime < timer2.elapsed()) {
            await exitAction(2)
            return
        }
        const state = gameState.state
        setStatus("state", state)
        const isBoss = state.includes("boss")
        const isInv = state.includes("inv")
        if (state === "buff") {
            kb(hwnd, "esc")
            rmc(1456, 808)
            await sleep(300)
            continue
        }
        if (!isBoss) {
            await prepareSkill("q2")
        }
        if (!state.includes("battle") && state !== "unknown") {
            setStatus("fn")
            mt(hwnd)
            return
        } else if (state === "unknown") {
            rmc(1456, 808)
        }
        if (isBoss) {
            mt(hwnd) // 锁定BOSS
            await sleep(300)
            await kb(hwnd, "w", 30)
        }
        if (!isBoss || isInv) {
            await doge(isBoss)
            await sleep(100)
        }
        if ((frame.get_hsl(782, 822)[2] < 0.7 && timer.elapsed() > 8e3) || timer.elapsed() > 35e3) {
            await useSkill("q2")
            await useSkill("z")
            if (isBoss && config.useQ1) {
                await useSkill("q1")
            }
            timer.reset()
        } else if (gameState.mp > 20 && isBoss) {
            mt(hwnd) // 锁定BOSS
            await sleep(300)
            if (isInv) {
                kd(hwnd, "a")
                await kb(hwnd, "w", 300)
                await kb(hwnd, "shift", 50)
                await kb(hwnd, "space", 50)
                await sleep(300)
                ku(hwnd, "a")
            } else {
                await kb(hwnd, "w", 30)
                await useSkill("q3") // 有蓝放q3
            }
        }
    }
}

async function exitAction(type = 1) {
    kb(hwnd, "esc", 33)
    await sleep(800)
    if (type === 2)
        rmc(1358, 826) // 暂离
    else rmc(1498, 816) // 退出
    await sleep(500)
    rmc(982, 501)
    await sleep(500)
}
/** 重置 */
async function resetLoop(skip = false) {
    setStatus("fn", "resetLoop")
    await kb(hwnd, "esc", 33)
    await sleep(800)
    if (!skip) {
        await moveC(hwnd, 1115, 820 + yof, 300) // 设置
        await sleep(500)
        await moveC(hwnd, 563, 28 + yof, 500) // 其他
        await moveC(hwnd, 1356, 632 + yof, 500) // 重置
        await sleep(200)
        mc(hwnd, 1010, 379)
    }
    await moveC(hwnd, 999, 506 + yof, 100) // 确定
    await sleep(500)
    mt()
    await sleep(500)
}

const rewardTpl = getTemplateB64(
    "iVBORw0KGgoAAAANSUhEUgAAABYAAAAYCAIAAABx3JocAAABX0lEQVQ4EdVSMaqDQBRcQ9BlW1P8zQWCHkCwtZAsiBZBco29SDohl8gFUn9IZy4QLSzS2IgQLGzeJ/qzoq7E3+VPs8PMvNnHsgh9KFzXXa1W0uUcx1mv11KrE6MoggabzaZTG3Y8HlvrTcvtdmtzj8dD13XREoZhqwOAbdtCl5DtdiuiSZKIhBDzPMcYC32ScM7jOK6qKggC3/ev12tRFOfzmTGmKMrkGCEEN9A0TVXVNpdlGQDs93uEECFksVgsl8s2RgjpdZmmKVadT0zT7FoMw5BOlmXJGKvrWuoahvGmIsuyNoExrqpq3NKroJTe+7hcLpqmiUt0XU/TtB+5U0pF4ElUVaWUfr0w/qAv53lSSsWTdy2MscGqvu8L+3A4DFzGmHB/ied5gxAA7HY7RVFOp9PY8jxvVgUAlGU5ngeAP1RI5z+5wrKsqZ2lumVZw+dECHHOv+eBcy6Z/+fSDw4xX94zihE4AAAAAElFTkSuQmCC"
)
/**
 * 选择商店选项
 */
async function selectShopOption() {
    setStatus("fn", "selectShopOption")
    const offsetX = 930
    const offsetY = 430
    const roi = frame.roi(offsetX, offsetY, 43, 268)
    const match = await matchTemplate(roi, rewardTpl, 0.8)
    if (match) {
        rmc(offsetX + match[0] + 10, offsetY + match[1] + 10)
    } else {
        rmc(1022, 696)
    }
    await sleep(100)
}

/** @param {Mat} roi  */
function numocr(roi) {
    const ct = [
        { k: "0", v: "f14af14ae14be01e" },
        { k: "0", v: "634b634b634b630e" },
        { k: "1", v: "b0b0f0f1515b5ba4" },
        { k: "2", v: "c862624b631f9d1e" },
        { k: "3", v: "e1e0624bf15be09c" },
        { k: "4", v: "63b463e09dc94ab4" },
        { k: "5", v: "25c9c94ba5634b1e" },
        { k: "6", v: "8d9ca44b9dd8e036" },
        { k: "7", v: "c90f634b4b278de0" },
        { k: "8", v: "f10e624af1d9e01e" },
        { k: "8", v: "720f724b621f621e" },
        { k: "9", v: "4b630d634b62371e" },
        { k: "米", v: "5040145041040010" },
    ]
    const chasharr = ct.map(v => v.v)
    const filterd = colorFilter(roi, [0xffffff], 40)
    const bboxs = segmentChars(filterd, 1, 2)
    const chars = bboxs.map(v => filterd.roi(...v))
    const hashs = chars.map(v => perceptualHash(v))
    const ret = hashs
        .map(v => {
            const r = matchHammingHash(v, chasharr, 30)
            return r >= 0 && ct[r].k !== "米" ? ct[r].k : ""
        })
        .join("")
    if (config.single && config.debug) setStatus("num", filterd, ret)
    if (config.single && config.debug) setStatus("chars", chars, hashs.join("\n"))
    return ret
}

/** @param {Mat} frame  */
function getMP(frame) {
    const roi = frame.roi(1303, 859, 243, 4)
    const p = roi.find_bright(243, 2, 243, 180, 0, ">", "rtl")
    const p2 = roi.find_bright(0, 2, 243, 180, 0, "<", "ltr")
    const mp = p ? Math.round(p[0] / 2.42) : 0
    const mp2 = p2 ? Math.round(p2[0] / 2.42) : 100
    const mpf = mp2 >= mp && mp2 - mp <= 2 ? mp2 : 0
    // if (mpf) setStatus("mp", roi, mpf)
    return mpf
}

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
    if (gameState.distance > 5) return false
    const phash = perceptualHash(frame.roi(955, 442, 14, 16))
    const matched = matchHammingHash(phash, ["a6a69e19631c69e2"], 10) >= 0
    return matched
}

/** @param {*} door */
function ocrDistance(door, md = 0) {
    const numroi = frame.roi(door.match.bbox[0] - 4, door.match.bbox[1] + door.match.bbox[3] + 5, 32, 15)
    let d = +numocr(numroi)
    if (d >= 100) d = ~~(d / 10)
    gameState.distance = Number.isFinite(d) ? d : md
    setStatus("route", `寻路${autoAimX ? "X" : ""}${autoAimY ? "Y" : ""}: ${~~door.dx}, ${~~door.dy}, ${gameState.distance}m`)
}

async function main() {
    if (config.lock !== "6") {
        console.error("请查看文件开头的说明并填写密码")
        return
    }
    if (config.single) {
        console.log("single")
        gameState.state = checkState(frame)
        if (gameState.state === "door") {
            const door = findDoor(frame)
            if (door) ocrDistance(door)
        }
        if (gameState.state === "event") {
            const door = findYellow(frame)
            if (door) ocrDistance(door)
        }
        return
    }

    const xtimer = setInterval(async () => {
        kb(hwnd, "x")
    }, 2e3)

    const ftimer = setInterval(() => {
        frame = cap13()
        gameState.mp = getMP(frame)
        gameState.state = checkState(frame)
        if (gameState.state === "buff") {
            rmc(1456, 808)
        }
        if (autoAimX || autoAimY) {
            if (bufferedFindFn !== findFn) {
                bufferedFindFn = findFn
                doorTripleBuffer.length = 0
            }
            const rawDoor = findFn(frame)
            const door = config.useTripleDoorBuffer ? getBufferedDoor(rawDoor) : rawDoor
            if (door) {
                let md = 0
                if (config.debug) drawBorder(hwnd, ...door.match.bbox)
                if (door.out) {
                    const mDoor = findDoorMinimap(frame)
                    if (mDoor && mDoor.match.color === door.match.color && mDoor.distance > 15) {
                        setStatus(
                            "route",
                            frame.roi(...mDoor.match.bbox),
                            `小地图寻路${autoAimX ? "X" : ""}${autoAimY ? "Y" : ""}: ${~~mDoor.angle}°, ${~~mDoor.distance}m`
                        )
                        const roiMat = frame.roi(30, 35, 180, 180)
                        const rotation = predictRotation(roiMat)
                        const delta = ((rotation - mDoor.angle + 180) % 360) - 180
                        if (delta > 30) {
                            turn(-Math.sign(delta) * Math.max(Math.abs(delta), 1))
                            // console.log("mm旋转", delta)
                            return
                        }
                        gameState.angle = mDoor.angle
                        md = gameState.distance = mDoor.distance
                    }
                }
                ocrDistance(door, md)
                const first = projectOffsetToMm(door.dx, door.dy + autoAimoffsetY, { out: door.out, rawDy: door.dy })
                let fastX = clamp(first.mmx, -320, 320)
                let fastY = clamp(first.mmy, -320, 320)
                if (Math.abs(fastX) < 5) fastX = 0
                if (Math.abs(fastY) < 5) fastY = 0
                gameState.dx = first.mmx
                gameState.dy = first.mmy
                mm(autoAimX ? fastX : 0, autoAimY || door.out ? fastY : 0)
            } else {
                gameState.distance = 0
                turn(1)
            }
        } else {
            doorTripleBuffer.length = 0
            setStatus("route")
        }
    }, config.ftime)
    setForegroundWindow(hwnd)
    await sleep(100)
    await moveTo(hwnd, 200, 1 + yof, 100)
    mt()
    await sleep(100)

    let i = 0
    let finished = 0
    const timer = new Timer()
    while (checkStop()) {
        const state = gameState.state
        setStatus("state", state)
        setStatus("fn", "main")
        autoAimX = false
        if (state !== "unknown") i = 0
        switch (state) {
            case "home":
                await kb(hwnd, "esc")
                await sleep(1e3)
                rmc(153, 454)
                await sleep(1e3)
                rmc(893, 28)
                await sleep(1e3)
                rmc(889, 595)
                await sleep(1200)
                break
            case "door":
            case "event":
                findFn = state === "door" ? findDoor : findYellow
                await moveLoop(state)
                break
            case "shop":
                await selectShopOption()
                await kb(hwnd, "space", 1000)
                break
            case "esc_menu":
                rmc(999, 506)
                break
            case "esc":
            case "buy":
                kb(hwnd, "esc")
                await sleep(1000)
                break
            case "buff":
                rmc(1456, 808)
                await sleep(300)
                break
            case "finish": {
                const secs = timer.elapsed() / 1e3
                if (secs > 5) {
                    timer.reset()
                    console.info(`完成 ${++finished}次 用时 ${~~(secs / 60)}分${~~(secs % 60)}秒`)
                }
                rmc(1456, 808)
                await sleep(1500)
                break
            }
            case "enter":
                rmc(1456, 808)
                break
            case "unknown":
                if (i++ > 5) {
                    rmc(1456, 808)
                    i = 0
                }
                await sleep(300)
                break
            default:
                if (state.includes("battle")) await battleLoop(state)
                break
        }
        // 超时
        if (timer.elapsed() > 10 * 60e3) {
            await moveTo(0, 0)
            console.error("循环超时")
            await exitAction()
            timer.reset()
        }
        await sleep(100)
    }
    clearInterval(ftimer)
    clearInterval(xtimer)
    console.log("切换窗口 自动退出")
}
main()
