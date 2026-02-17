// ==UserScript==
// @id JYVs5DxWME
// @name zhiliu_mijin
// @description 止流迷津测试版
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/2/17
// ==/UserScript==

// 说明: 视角设置全默认 视距1.3
// 止流带专武赘生雷月卡 潜质攻击减CD复活

const config = {
    门顺序: ["黄", "蓝", "大红", "小红"],
    useQ1: false, // 6命别选
    /** @type {ROI} */ minimapLoc: [30, 35, 180, 180],
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
}

/** @typedef {[number, number, number, number]} ROI */

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) {
    console.log("未找到窗口或非管理员权限")
    throw new Error("未找到窗口或非管理员权限")
}
checkSize(hwnd)

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
    if (!frame) {
        frame = captureWindowWGC(hwnd)
    }
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
        await rollAbs(-30)
        await sleep(33)
        await kb(hwnd, "space")
        await sleep(500)
        // await kb(hwnd, "space")
        // await sleep(600)
        await kb(hwnd, "4", 33)
        await sleep(900)
        mm(0, 300)
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
    mm(0, (-700 * (-angle + 90)) / 90) // 抬头
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
 */
function projectOffsetToMm(dx, dy) {
    const yawDeg = (Math.atan(dx / autoAimModel.fx) * 180) / Math.PI
    const pitchDeg = (Math.atan(dy / autoAimModel.fy) * 180) / Math.PI
    return {
        yawDeg,
        pitchDeg,
        mmx: Math.round(yawDeg * autoAimModel.mmPerDegX),
        mmy: Math.round(pitchDeg * autoAimModel.mmPerDegY),
    }
}

/**
 * 自动瞄准
 * @param {number} dx 水平偏移
 * @param {number} dy 垂直偏移
 * @param {number} [offsetY=0] 垂直修正，按 dy+offsetY 计算
 */
async function autoAim(dx, dy, offsetY = 0, fn = findDoor) {
    setStatus("fn", "autoAim")
    let stableCount = 0

    const first = projectOffsetToMm(dx, dy + offsetY)
    const fastX = clamp(first.mmx, -220, 220)
    const fastY = clamp(first.mmy, -220, 220)
    if (fastX !== 0 || fastY !== 0) {
        mm(fastX, fastY)
        await sleep(16)
    }

    const timer = new Timer()
    while (checkStop()) {
        const frame = captureWindowWGC(hwnd)
        if (cc(frame, 957, 451, 0x000000, 10)) return
        const door = fn(frame)
        if (door) {
            drawBorder(hwnd, ...door.match.bbox)
            const adjustedDy = door.dy + offsetY
            const adjustedDistance = Math.hypot(door.dx, adjustedDy)

            if (adjustedDistance <= 20) {
                // console.log(`到达${door.match.color}门 ${aimDx}, ${aimDy}`)
                return
            }
            if (Math.abs(door.dx) <= 3 && Math.abs(adjustedDy) <= 3) {
                stableCount++
                if (stableCount >= 2) return
            } else {
                stableCount = 0
            }

            const predict = projectOffsetToMm(door.dx, adjustedDy)
            const gain = adjustedDistance > 80 ? 0.65 : 0.35
            let sdx = clamp(Math.round(predict.mmx * gain), -30, 30)
            let sdy = clamp(Math.round(predict.mmy * gain), -30, 30)
            if (sdx === 0 && Math.abs(door.dx) > 2) sdx = Math.sign(predict.mmx || door.dx)
            if (sdy === 0 && Math.abs(adjustedDy) > 2) sdy = Math.sign(predict.mmy || adjustedDy)

            mm(sdx, sdy)
        }
        if (timer.elapsed() > 500) {
            // console.log("autoAim超时")
            return
        }
        await sleep(10)
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
    switch (map) {
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
            turn(-15)
            await fastMove()
            await sleep(700)
            turn(-15)
            await fastMove()
            await sleep(700)
            break
    }
    const totalTimeout = new Timer()
    let state = checkState(frame)
    const shiftCooldown = new Timer()
    const jumpCooldown = new Timer()
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
                if (stage === "forward" && jumpCooldown.elapsed() > 4e3) {
                    await kb(hwnd, "space", 33)
                    stage = "jumping"
                }
                if (stage === "jumping" && jumpCooldown.elapsed() > 4500) {
                    await kb(hwnd, "space", 33)
                    jumpCooldown.reset()
                    stage = "forward"
                }
            }
        } else {
            setStatus("err", "未找到门")
        }
        if (totalTimeout.elapsed() > 13e3) {
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
        await moveC(hwnd, 1115, 820, 300)
        await sleep(500)
        await moveC(hwnd, 563, 28, 500)
        await moveC(hwnd, 1014, 380, 500)
        await sleep(200)
        mc(hwnd, 1010, 379)
    }
    await moveC(hwnd, 999, 506, 100)
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

const xtimer = setInterval(() => {
    if (!checkStop()) clearInterval(xtimer)
    kb(hwnd, "x")
}, 2e3)

async function main() {
    setForegroundWindow(hwnd)
    await sleep(100)

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
        // const roi = await selectroi("roi", frame)
        // console.log(state, roi)
        // copyText(JSON.stringify(roi))
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
