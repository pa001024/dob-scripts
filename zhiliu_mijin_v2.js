// ==UserScript==
// @id JYVs5DxWME
// @name zhiliu_mijin_v2
// @description 止流迷津测试版V2 纯后台
// @author pa
// @version 2.0.0
// @category 其他
// @date 2026/2/20 22:05:21
// ==/UserScript==

// 止流带专武赘生雷月卡/球球蜂 不推荐带防御魔灵 打慢了缺蓝死循环 潜质攻击减CD复活

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
    /** @type {ROI} */ minimapLoc: [30, 35, 180, 180],
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
}

/** @typedef {[number, number, number, number]} ROI */

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) {
    throw new Error("未找到窗口或非管理员权限")
}
checkSize(hwnd)

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
function findColors(img, colors, names, threshold = 10, mode = "single") {
    // x: 290~1312 y: 168~681
    const xOffset = config.mainLoc[0]
    const yOffset = config.mainLoc[1]
    const roi = img.roi(...config.mainLoc)
    const filtered = colorFilter(roi, colors, threshold)
    const closed = morphologyEx(filtered, "close", 4)
    // imshow("filtered", closed)
    const contours = findContours(closed, 100).filter(c => c.area < 420 && c.bbox[2] < 28 && c.bbox[3] < 28)
    // const ccc = drawContours(closed, contours)
    // imshow("contours", ccc)
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
/**
 * 使用技能
 * @param {Mat} frame 窗口截图
 * @param {'q'|'q1'|'q2'|'Q2'|'q3'|'z'} skill 技能编号
 */
async function useSkill(frame, skill) {
    let currentSkill = checkSkill(frame)
    /** @param {"long" | "short"} type 长E或短E */
    async function useSkillEAndCheck(type) {
        // console.log(`useSkillEAndCheck(${type})`)
        await kb(hwnd, "e", type === "long" ? 800 : 10)
        await sleep(type === "long" ? 1500 : 400)
        // 更新画面
        frame = captureWindow(hwnd)
        currentSkill = checkSkill(frame)
    }
    while (checkStop()) {
        switch (skill) {
            case "q":
                await kb(hwnd, "q", 10)
                return true
            case "q1":
                if (currentSkill !== 1) await useSkillEAndCheck("long")
                if (currentSkill !== 1) await useSkillEAndCheck("long")
                if (currentSkill === 1) {
                    await kb(hwnd, "q", 10)
                    await sleep(2000)
                    return true
                }
                break
            case "q2":
                if (currentSkill !== 2 && currentSkill !== 3) await useSkillEAndCheck("short")
                if (currentSkill !== 2) await useSkillEAndCheck("long")
                if (currentSkill === 2) {
                    await kb(hwnd, "q", 10)
                    await sleep(4000)
                    return true
                }
                break
            case "Q2":
                if (currentSkill !== 2 && currentSkill !== 3) await useSkillEAndCheck("short")
                if (currentSkill !== 2) await useSkillEAndCheck("long")
                if (currentSkill === 2) {
                    await kb(hwnd, "q", 500)
                    await sleep(4000)
                    return true
                }
                break
            case "q3":
                if (currentSkill !== 3) await useSkillEAndCheck("short")
                if (currentSkill !== 3) await useSkillEAndCheck("short")
                if (currentSkill === 3) {
                    await kb(hwnd, "q", 10)
                    await sleep(2000)
                    return true
                }
                break
            case "z":
                await kb(hwnd, "z", 10)
                return true
        }
        await sleep(200)
        frame = captureWindow(hwnd)
        currentSkill = checkSkill(frame)
    }
}
async function doge() {
    // 原地二段跳
    await kb(hwnd, "space", 100)
    await sleep(500)
    await kb(hwnd, "space", 100)
    await sleep(500)
}

/**
 * 检查状态
 * @param {Mat} frame 窗口截图
 */
function checkState(frame) {
    // #8FD19E
    if ((cc(frame, 1557, 32, 0xffffff, 10) && !cc(frame, 1560, 36, 0xffffff, 10)) || cc(frame, 126, 859, 0x8fd19e, 10)) {
        // #FFFFC5
        if (frame.find_color(44, 270, 4, 0xffffc5, 10, "ttb")) {
            if (cc(frame, 86, 249, 0xffffff, 10) || cc(frame, 47, 327, 0xffffff, 10)) {
                return "door" // 继续探索
            } else {
                if (cc(frame, 531, 59, 0x000000, 10) && cc(frame, 1080, 60, 0x000000, 10)) {
                    return "boss" // BOSS
                }
                if (cc(frame, 767, 819, 0x000000, 10) && cc(frame, 800, 745, 0x000000, 10)) {
                    return "dead" // 死了
                }
                return "event" // 奇遇
            }
        }
        // #eb3a43
        if (cc(frame, 42, 277, 0xeb3a43, 10)) {
            if (cc(frame, 93, 310, 0xffffff, 10)) {
                return "battle" // 战斗
            }
            return "event" // 战斗
        }
        return "normal"
    }
    // #FFFEBC
    if (cc(frame, 26, 26, 0xfffebc, 10) && cc(frame, 1408, 875, 0x000000, 10)) {
        return "esc" // 退出
    }
    // #dddfe0
    if (cc(frame, 800, 860, 0xdddfe0, 10)) {
        return "buff" // 弹窗
    }
    // #ffffff
    if (cc(frame, 800, 224, 0xffffff, 10) && cc(frame, 781, 234, 0x000000, 10)) {
        return "buff" // 弹窗
    }

    if (cc(frame, 1263, 45, 0xffffff, 10)) {
        return "shop" // 商店
    }
    // #8FD19E
    if (cc(frame, 640, 850, 0x8fd19e, 10)) {
        return "paotai" // 炮台
    }
    // #FBFBFB
    if (cc(frame, 1116, 817, 0xfbfbfb, 10)) {
        return "esc" // 退出
    }
    // #870200
    if (cc(frame, 56, 17, 0x870200, 10) && cc(frame, 1395, 874, 0x000000, 10)) {
        return "esc" // 退出
    }
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
            case "01110000010":
            case "11110000010":
            case "11111000010":
            case "10101000110":
            case "11101000110":
            case "11110000000":
            case "11110000011":
            case "11101000000":
            case "11100000110":
            case "11110000110":
            case "11111000000":
                return "zuoguai"
            case "00000111001":
                return "paotai_reset" // 炮台背面
            case "00010111011":
            case "00010111111":
                return "paotai" // 炮台正面
            case "00000000011":
                return "bossfang"
            default:
                return "unknown"
        }
    }
    const state = getMap(points)
    setStatus("map", `${state}: ${points}`)
    // console.log(`${state}: ${points}`)
    return state
}
/** @param {number} deg */
function normalizeDeg180(deg) {
    return ((deg + 540) % 360) - 180
}

/** @param {Mat} [frame] */
function getRotation(frame) {
    const src = frame || captureWindowWGC(hwnd)
    return predictRotation(src.roi(...config.minimapLoc))
}

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

/** @param {number} delta */
function pickSnapAngle(delta) {
    const candidates = [-180, -135, -90, -45, 45, 90, 135, 180]
    let best = candidates[0]
    let bestErr = Number.MAX_SAFE_INTEGER
    for (const c of candidates) {
        const err = Math.abs(normalizeDeg180(delta - c))
        if (err < bestErr) {
            best = c
            bestErr = err
        }
    }
    return best
}

/**
 * 通过 wasd + mt 旋转到相对方向
 * @param {number} angle 取值建议: ±45/±90/±135/180
 * @param {number} [duration]
 */
async function faceRelative(angle, duration = 120) {
    const key = turnKeyMap[`${angle}`]
    if (!key) return
    await tapTurnKeys(key, duration)
    await sleep(16)
    mt()
    await sleep(300)
    mt()
    await sleep(300)
}

/**
 * 转视角
 * @param {number} angle 相对角度
 */
async function turn(angle) {
    await turnByDelta(angle)
}

/**
 * 按相对角度离散转向（wasd + mt）
 * @param {number} delta 相对角度
 */
async function turnByDelta(delta) {
    if (Math.abs(delta) <= 18) return
    const snap = pickSnapAngle(delta)
    await faceRelative(snap, Math.abs(snap) >= 90 ? 90 : 70)
}

/**
 * 转视角到绝对角度
 * @param {number} angle 角度
 * @param {Mat} [frame] 窗口截图
 */
async function turnAbs(angle, frame) {
    let current = frame
    const target = degTo360(angle)
    for (let i = 0; i < 6 && checkStop(); i++) {
        const rotation = getRotation(current)
        const delta = normalizeDeg180(target - rotation)
        if (Math.abs(delta) <= 18) return
        await turnByDelta(delta)
        await sleep(60)
        current = undefined
    }
}

/** @param {number} v @param {number} min @param {number} max */
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v))
}

/**
 * 快速移动
 * @param {number} [angle] 角度
 * @param {number} [distance] 距离
 */
async function fastMove(angle, distance) {
    setStatus("fn", "fastMove")
    if (angle !== undefined) await turnAbs(angle)
    kd(hwnd, "w")
    await sleep(33)
    await kb(hwnd, "space")
    await sleep(500)
    await kb(hwnd, "4", 33)
    await sleep(500)
    if (distance === undefined || distance > 4) {
        await kb(hwnd, "shift", 33)
        await sleep(500)
        await kb(hwnd, "space")
        await sleep(500)
        await kb(hwnd, "4", 33)
        await sleep(500)
    }
    const moveTime = distance === undefined ? 1400 : clamp(Math.round(500 + distance * 220), 500, 3200)
    await sleep(moveTime)
    ku(hwnd, "w")
}

/** @param {number} dx */
function pickAimCoarseStep(dx) {
    const adx = Math.abs(dx)
    if (adx <= 30) return 0
    if (adx >= 280) return Math.sign(dx) * 180
    if (adx >= 120) return Math.sign(dx) * 90
    return Math.sign(dx) * 45
}

/** @param {number} dx */
function pickAimFineStep(dx) {
    return Math.abs(dx) > 30 ? Math.sign(dx) * 45 : 0
}

/** @param {number} dy */
function shouldJumpByDy(dy) {
    // 俯仰固定时，目标在画面越上方，dy 越小（更负）
    return dy <= -90
}

/** @param {{out:boolean, angle:number}} door */
function isOutDoorBehind(door) {
    if (!door.out) return false
    // angle≈180 为画面下方（背后），取下半圆中间 90 度扇区
    return Math.abs(normalizeDeg180(door.angle - 180)) <= 45
}

/**
 * 自动瞄准（离散转向版）
 * @param {number} dx 水平偏移
 * @param {number} _dy 垂直偏移
 * @param {number} [offsetY=0] 垂直修正，按 dy+offsetY 计算
 */
async function autoAim(dx, _dy, offsetY = 0, fn = findDoor) {
    setStatus("fn", "autoAim")
    let lastDx = dx
    for (let i = 0; i < 2 && checkStop(); i++) {
        const frame = captureWindowWGC(hwnd)
        if (cc(frame, 957, 451, 0x000000, 10)) return
        const door = fn(frame)
        if (!door) {
            const fallback = i === 0 ? pickAimCoarseStep(lastDx) : pickAimFineStep(lastDx)
            if (fallback) await faceRelative(fallback, 60)
            continue
        }

        drawBorder(hwnd, ...door.match.bbox)
        const adjustedDy = door.dy + offsetY
        lastDx = door.dx
        const centeredX = Math.abs(door.dx) <= 30
        const centeredY = Math.abs(adjustedDy) <= 75
        if (centeredX && centeredY) {
            return
        }

        const step = i === 0 ? pickAimCoarseStep(door.dx) : pickAimFineStep(door.dx)
        if (step) {
            await faceRelative(step, Math.abs(step) >= 90 || door.out ? 95 : 70)
        }
        await sleep(25)
    }
}

let isPaopai = false
let resetFlag = false
/**
 * 自动寻路
 * @param {Mat} frame 窗口截图
 */
async function moveLoop(frame, fn = findDoor) {
    setStatus("fn", "moveLoop")
    async function checkFinish() {
        if (cc(frame, 957, 451, 0x000000, 10)) {
            const state = checkState(frame)
            if (state === "battle" || state === "boss") {
                resetFlag = false
                return true
            }
            console.log("找到出口")
            await kb(hwnd, "f", 33)
            await sleep(1000)
            resetFlag = false
            return true
        }
        return false
    }
    if (isPaopai) {
        await resetLoop()
        await sleep(1000)
        isPaopai = false
        return
    }
    let map = checkMap(frame)
    for (let i = 0; i < 10; i++) {
        await sleep(1000)
        frame = captureWindowWGC(hwnd)
        // 多等待几帧 等地图稳定
        const newmap = checkMap(frame)
        if (newmap === map) break
        map = newmap
    }
    // 未识别到重置后再试一次
    if (map === "unknown") {
        await resetLoop()
        await sleep(1000)
        map = checkMap(frame)
        for (let i = 0; i < 10; i++) {
            await sleep(1000)
            frame = captureWindowWGC(hwnd)
            // 多等待几帧 等地图稳定
            const newmap = checkMap(frame)
            if (newmap === map) break
            map = newmap
        }
    }
    switch (map) {
        case "zuoguai":
            await fastMove()
            await sleep(700)
            kd(hwnd, "w")
            await sleep(200)
            kb(hwnd, "shift", 33)
            await sleep(300)
            ku(hwnd, "w")
            await turn(-90)
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
                await kb(hwnd, "a", 1500)
                frame = captureWindowWGC(hwnd)
                if (await checkFinish()) {
                    setStatus("err")
                    return
                }
                await kb(hwnd, "w", 700)
                isPaopai = true
                frame = captureWindowWGC(hwnd)
                if (await checkFinish()) {
                    setStatus("err")
                }
                return
            }
            break
        case "bossfang":
            await turn(-45)
            await fastMove()
            await sleep(700)
            await turn(-45)
            await fastMove()
            await sleep(700)
            break
    }
    const totalTimeout = new Timer()
    let state = checkState(frame)
    const shiftCooldown = new Timer()
    const jumpCooldown = new Timer()
    let triedBackTurn = false
    let stage = "init"
    while (checkStop() && (state === "event" || state === "door")) {
        frame = captureWindowWGC(hwnd)
        state = checkState(frame)
        setStatus("state", state)
        if (state !== (fn === findDoor ? "door" : "event")) {
            ku(hwnd, "w")
            setStatus("err")
            return
        }
        if (await checkFinish()) {
            ku(hwnd, "w")
            setStatus("err")
            return
        }
        const door = fn(frame)
        if (door) {
            drawBorder(hwnd, ...door.match.bbox)
            if (isOutDoorBehind(door)) {
                if (!triedBackTurn) {
                    console.log("目标疑似在背后，尝试180度转向")
                    await turn(180)
                    triedBackTurn = true
                    stage = "init"
                    await sleep(100)
                    continue
                }
            } else {
                triedBackTurn = false
            }
            if (door.out) {
                const mDoor = findDoorMinimap(frame)
                if (mDoor && mDoor.match.color === door.match.color) {
                    if (mDoor.distance > 20) {
                        console.log(`通过小地图找到${mDoor.match.color}门`)
                        await fastMove(mDoor.angle, mDoor.distance)
                    } else {
                        await autoAim(door.dx, door.dy, -120, fn)
                    }
                } else {
                    await autoAim(door.dx, door.dy, -120, fn)
                    await sleep(50)
                    stage = "init"
                }
            } else {
                // 闭环移动
                if (stage === "init") {
                    await autoAim(door.dx, door.dy, -120, fn)
                    kd(hwnd, "w")
                    stage = "forward"
                }
                if (shiftCooldown.elapsed() > 2e3 && totalTimeout.elapsed() < 6e3) {
                    await kb(hwnd, "shift", 33)
                    shiftCooldown.reset()
                }
                const needJump = shouldJumpByDy(door.dy)
                if (stage === "forward" && needJump && jumpCooldown.elapsed() > 4e3) {
                    await kb(hwnd, "space", 33)
                    stage = "jumping"
                }
                if (stage === "jumping" && needJump && jumpCooldown.elapsed() > 4500) {
                    await kb(hwnd, "space", 33)
                    jumpCooldown.reset()
                    stage = "forward"
                }
                if (!needJump && stage === "jumping") {
                    stage = "forward"
                }
            }
        } else {
            setStatus("err", "未找到门")
        }
        if (totalTimeout.elapsed() > 13e3) {
            ku(hwnd, "w")
            console.log("移动超时")
            await resetLoop()
            resetFlag = true
            return
        }
        await sleep(10)
    }
}

/**
 * 自动战斗
 * @param {string} state 战斗状态
 * @param {Mat} frame 窗口截图
 */
async function battleLoop(state, frame) {
    setStatus("fn", "battleLoop")
    console.log("进入战斗")
    ku(hwnd, "w")
    const timer = new Timer()
    mt() // 锁定BOSS
    await sleep(300)
    await kb(hwnd, "w", 30)
    await useSkill(frame, "q2")
    for (let i = 0; i < 20; i++) {
        frame = captureWindowWGC(hwnd)
        const x = frame.get_hsl(744, 821)
        if (x && x[2] > 0.8) {
            break
        }
        kb(hwnd, "q")
        await sleep(300)
    }
    await useSkill(frame, "z")
    if (state === "boss" && config.useQ1) {
        await useSkill(frame, "q1")
    }
    while (checkStop()) {
        frame = captureWindowWGC(hwnd)
        const state = checkState(frame)
        setStatus("state", state)
        if (state === "buff") {
            console.log("战斗中识别到buff")
            mc(hwnd, 1456, 808)
            await sleep(300)
            continue
        }
        if (state === "unknown") {
            mc(hwnd, 1456, 808)
            kb(hwnd, "x")
            await sleep(300)
        }
        if (state !== "boss" && state !== "battle" && state !== "unknown") {
            console.log(`战斗结束`)
            return
        }
        if (state === "boss") {
            mt() // 锁定BOSS
            await sleep(300)
            await kb(hwnd, "w", 30)
            const x = frame.get_hsl(1366, 863)
            if (x && x[2] > 0.6) {
                await useSkill(frame, "q3")
            }
        }
        await doge()
        await sleep(100)
        if (timer.elapsed() > 35e3) {
            mt() // 锁定BOSS
            await sleep(300)
            await kb(hwnd, "w", 30)
            await useSkill(frame, "q2")
            await useSkill(frame, "z")
            if (state === "boss" && config.useQ1) {
                await useSkill(frame, "q1")
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
        await sleep(500)
        mc(hwnd, 1014, 380)
        await sleep(500)
        mc(hwnd, 1010, 379)
        await sleep(500)
    }
    mc(hwnd, 999, 506)
    await sleep(500)
    mt()
    await sleep(500)
}

const rewardTpl = getTemplateB64(
    "iVBORw0KGgoAAAANSUhEUgAAABYAAAAYCAIAAABx3JocAAABX0lEQVQ4EdVSMaqDQBRcQ9BlW1P8zQWCHkCwtZAsiBZBco29SDohl8gFUn9IZy4QLSzS2IgQLGzeJ/qzoq7E3+VPs8PMvNnHsgh9KFzXXa1W0uUcx1mv11KrE6MoggabzaZTG3Y8HlvrTcvtdmtzj8dD13XREoZhqwOAbdtCl5DtdiuiSZKIhBDzPMcYC32ScM7jOK6qKggC3/ev12tRFOfzmTGmKMrkGCEEN9A0TVXVNpdlGQDs93uEECFksVgsl8s2RgjpdZmmKVadT0zT7FoMw5BOlmXJGKvrWuoahvGmIsuyNoExrqpq3NKroJTe+7hcLpqmiUt0XU/TtB+5U0pF4ElUVaWUfr0w/qAv53lSSsWTdy2MscGqvu8L+3A4DFzGmHB/ied5gxAA7HY7RVFOp9PY8jxvVgUAlGU5ngeAP1RI5z+5wrKsqZ2lumVZw+dECHHOv+eBcy6Z/+fSDw4xX94zihE4AAAAAElFTkSuQmCC"
)
/**
 * 选择商店选项
 * @param {Mat} frame 窗口截图
 */
async function selectShopOption(frame) {
    setStatus("fn", "selectShopOption")
    const offsetX = 930
    const offsetY = 430
    const roi = frame.roi(offsetX, offsetY, 43, 268)
    const match = await matchTemplate(roi, rewardTpl, 0.8)
    if (match) {
        mc(hwnd, offsetX + match[0] + 10, offsetY + match[1] + 10)
    } else {
        mc(hwnd, 1022, 696)
    }
    await sleep(100)
}

async function main() {
    await sleep(100)

    const xtimer = setInterval(() => {
        if (!checkStop()) clearInterval(xtimer)
        kb(hwnd, "x")
    }, 2e3)
    // const frame = captureWindowWGC(hwnd)
    // const r0 = findDoor(frame)
    // if (r0) drawBorder(hwnd, ...r0.match.bbox)
    // console.log(r0)
    // return

    // const mDoor = findDoorMinimap(frame)
    // if (mDoor) {
    //     await fastMove(mDoor.angle, mDoor.distance)
    //     // rollAbs(-30)
    //     return
    // }
    let i = 0
    while (checkStop()) {
        const frame = captureWindowWGC(hwnd)
        const state = checkState(frame)
        setStatus("state", state)
        switch (state) {
            case "door":
            case "event":
                i = 0
                await moveLoop(frame, state === "door" ? findDoor : findYellow)
                break
            case "paotai":
                i = 0
                await resetLoop(true)
                break
            case "battle":
            case "boss":
                i = 0
                await battleLoop(state, frame)
                break
            case "shop":
                i = 0
                await selectShopOption(frame)
                kd(hwnd, "space")
                await sleep(1000)
                ku(hwnd, "space")
                break
            case "esc":
                i = 0
                kb(hwnd, "esc")
                await sleep(1000)
                break
            case "dead":
                i = 0
                kb(hwnd, "x")
                await sleep(1000)
                break
            case "buff":
                i = 0
                mc(hwnd, 1456, 808)
                await sleep(300)
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
