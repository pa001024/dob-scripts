// ==UserScript==
// @id JYVs5DxWME
// @name zhiliu_mijin
// @description 止流迷津测试版
// @author pa
// @version 1.0.1
// @category 其他
// @date 2026/2/22 01:14:26
// ==/UserScript==

// 说明: 视角设置全默认(!!!!) 视距1.3
// 止流带专武赘生雷月卡/球球蜂 不推荐带防御魔灵 打慢了缺蓝直接寄 潜质攻击减CD复活

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
    useQ1: readConfig("搓BUFF", "Boss阶段是否释放Q1（6命别选）", "boolean", false), // 6命别选
    /** @type {ROI} */ minimapLoc: [30, 35, 180, 180],
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
}

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) {
    console.log("未找到窗口或非管理员权限")
    throw new Error("未找到窗口或非管理员权限")
}
checkSize(hwnd)

let frame = captureWindowWGC(hwnd)
let autoAimX = false
let autoAimY = false
const autoAimoffsetY = -150
let findFn = findDoor
const gameState = {
    dx: 0,
    dy: 0,
    distance: 0,
    angle: 0,
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
let currentSkill = checkSkill(frame)
/**
 * 准备下一次技能
 * @param {'q'|'q1'|'q2'|'Q2'|'q3'|'z'} skill 技能编号
 */
async function prepareSkill(skill) {
    currentSkill = checkSkill(frame)
    /** @param {"long" | "short"} type 长E或短E */
    async function useSkillEAndCheck(type) {
        // console.log(`useSkillEAndCheck(${type})`)
        await kb(hwnd, "e", type === "long" ? 800 : 10)
        await sleep(type === "long" ? 1500 : 400)
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
    switch (skill) {
        case "q":
            await kb(hwnd, "q", 10)
            return true
        case "z":
            await kb(hwnd, "z", 10)
            return true
        case "q1":
            if (currentSkill === 1) {
                await kb(hwnd, "q", 10)
                await sleep(2000)
                return true
            }
            break
        case "q2":
            if (currentSkill === 2) {
                await kb(hwnd, "q", 10)
                await sleep(4000)
                return true
            }
            break
        case "Q2":
            if (currentSkill === 2) {
                await kb(hwnd, "q", 500)
                await sleep(4000)
                return true
            }
            break
        case "q3":
            if (currentSkill === 3) {
                await kb(hwnd, "q", 10)
                await sleep(2000)
                return true
            }
            break
    }
}
async function doge(boss = false) {
    // 原地二段跳
    if (boss) kd(hwnd, "a")
    await kb(hwnd, "space", 100)
    await sleep(500)
    await kb(hwnd, "space", 100)
    await sleep(500)
    if (boss) ku(hwnd, "a")
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
                return points.startsWith("1111") ? "maybe" : "unknown"
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

let isPaopai = false
let resetFlag = false
/**
 * 自动寻路
 */
async function moveLoop(type = "door") {
    setStatus("fn", "moveLoop")
    async function checkFinish() {
        const state = checkState(frame)
        if (state === "battle" || state === "boss") {
            resetFlag = false
            autoAimX = false
            return true
        }
        if (checkF()) {
            autoAimX = false
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
    while (checkStop() && (state === "event" || state === "door")) {
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
            await rollAbs(gameState.distance > 16 ? -60 : gameState.distance > 12 ? -30 : -10)
            kb(hwnd, "4")
            await sleep(500)
            await rollAbs(0)
            autoAimY = true
            await sleep(300)
            autoAimY = false
            mt()
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
        if (totalTimeout.elapsed() > 13e3) {
            autoAimX = false
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
 */
async function battleLoop(state) {
    setStatus("fn", "battleLoop")
    ku(hwnd, "w")
    const timer = new Timer()
    mt() // 锁定BOSS
    await sleep(300)
    await kb(hwnd, "w", 30)
    await useSkill("q2")
    await useSkill("z")
    if (state === "boss" && config.useQ1) {
        await useSkill("q1")
    }
    while (checkStop()) {
        const state = checkState(frame)
        setStatus("state", state)
        if (state === "buff") {
            kb(hwnd, "esc")
            mc(hwnd, 1456, 808)
            await sleep(300)
            continue
        }
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
        await doge(state === "boss")
        await sleep(100)
        if (frame.get_hsl(794, 821)[2] < 0.8) {
            await useSkill("q2")
            await useSkill("z")
            if (state === "boss" && config.useQ1) {
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
        await moveC(hwnd, 1115, 820, 300)
        await sleep(500)
        await moveC(hwnd, 563, 28, 500)
        await moveC(hwnd, 1014, 380, 500)
        await sleep(200)
        mc(hwnd, 1010, 379)
    }
    await moveC(hwnd, 999, 506, 100)
    await sleep(500)
    mt(hwnd)
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
        mc(hwnd, offsetX + match[0] + 10, offsetY + match[1] + 10)
    } else {
        mc(hwnd, 1022, 696)
    }
    await sleep(100)
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

const ftimer = setInterval(async () => {
    if (!checkStop()) clearInterval(ftimer)
    frame = captureWindowWGC(hwnd)
    if (autoAimX || autoAimY) {
        const door = findFn(frame)
        const mDoor = findDoorMinimap(frame)
        if (door) {
            drawBorder(hwnd, ...door.match.bbox)
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
                    return
                }
                gameState.angle = mDoor.angle
                gameState.distance = mDoor.distance
            } else {
                const numroi = frame.roi(door.match.bbox[0] - 10, door.match.bbox[1] + door.match.bbox[3] + 7, 30, 15)
                const d = +numocr(numroi)
                if (d) {
                    setStatus("d", numroi, d)
                } else {
                    setStatus("d")
                }
                gameState.distance = Number.isFinite(d) ? d : 0
                setStatus(
                    "route",
                    `传统寻路${autoAimX ? "X" : ""}${autoAimY ? "Y" : ""}: ${~~door.dx}, ${~~door.dy}, ${gameState.distance}m`
                )
            }
            const first = projectOffsetToMm(door.dx, door.dy + autoAimoffsetY)
            let fastX = clamp(first.mmx, -320, 320)
            let fastY = clamp(first.mmy, -320, 320)
            if (Math.abs(fastX) < 5) fastX = 0
            if (Math.abs(fastY) < 5) fastY = 0
            gameState.dx = first.mmx
            gameState.dy = first.mmy
            mm(autoAimX ? fastX : 0, autoAimY ? fastY : 0)
        } else {
            gameState.distance = 0
            turn(3)
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
    await moveTo(hwnd, 200, 1, 100)
    mc()
    await sleep(100)

    let i = 0
    let finished = 0
    const timer = new Timer()
    while (checkStop()) {
        const state = checkState(frame)
        setStatus("state", state)
        autoAimX = false
        switch (state) {
            case "door":
            case "event":
                i = 0
                findFn = state === "door" ? findDoor : findYellow
                await moveLoop(state)
                break
            case "paotai":
                i = 0
                await resetLoop(true)
                break
            case "battle":
            case "boss":
                i = 0
                await battleLoop(state)
                break
            case "shop":
                i = 0
                await selectShopOption()
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
            case "finish": {
                const secs = timer.elapsed() / 1e3
                timer.reset()
                console.info(`完成 ${++finished}次 用时 ${~~(secs / 60)}分${~~(secs % 60)}秒`)
                mc(hwnd)
                await sleep(1500)
                break
            }
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
