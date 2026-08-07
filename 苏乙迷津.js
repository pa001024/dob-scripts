// ==UserScript==
// @id JYVs5DxWME
// @name 苏乙迷津
// @description 苏乙迷津 1.5
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/06/11 09:33
// ==/UserScript==

import { Cap } from "cap"

// 说明: 键位和视角设置全默认(!!!!) 视距1.3
// 满命苏乙 灾厄长柄+专武
// 难度可以把血量调低为80% 其余点满 开200%打boss比较慢容易死

const config = {
    门顺序: readConfig(
        "门顺序",
        "设置门颜色优先顺序，按从高到低优先级选择",
        {
            type: "multi-select",
            options: ["黄", "蓝", "大红", "小红"],
        },
        ["大红", "小红", "黄", "蓝"]
    ),
    useTripleDoorBuffer: readConfig("三重缓冲", "一定程度上降低找门抖动", "boolean", true),
    moveTimeout: readConfig("移动超时", "移动超时重置间隔(秒)", "number", 25),
    ftime: readConfig("帧间隔", "取帧间隔(毫秒)", "number", 100),
    debug: readConfig("debug", "", "boolean", false),
    single: readConfig("single", "单帧识别", "boolean", false),
    battleTime: readConfig("战斗超时", "超时暂离(秒)", "number", 120) * 1e3,
    /** @type {ROI} */ minimapLoc: [30, 35, 180, 180],
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
}
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

let frame = c.cap()
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
    return c.hwnd === getForegroundWindow()
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
    // if (config.debug) imshow("closed", closed)
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
    if (!frame) frame = c.cap()
    const roiMat = frame.roi(30, 35, 180, 180)
    const rotation = predictRotation(roiMat)
    const delta = ((rotation - angle + 180) % 360) - 180
    if (rotation === angle) return
    turn(-Math.sign(delta) * Math.max(Math.abs(delta), 1))
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

/** @param {Mat} frame  */
async function checkSkill(frame, v = true) {
    if (v) {
        if (cc(frame, 1440, 802, 0xeeeeef, 10)) {
            await c.kb("q")
            await sleep(2e3)
            return !cc(frame, 1440, 802, 0xeeeeef, 10)
        }
    } else {
        if (!cc(frame, 1440, 802, 0xeeeeef, 10)) {
            await c.kb("q")
            await sleep(2e3)
            return !cc(frame, 1440, 802, 0xeeeeef, 10)
        }
    }
    return true
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
            await c.kb("f", 33)
            await sleep(1000)
            return true
        }
        return false
    }

    let map = checkMap(frame)
    switch (map) {
        case "zuoguai":
            autoAimX = false
            await checkSkill(frame, false)
            await sleep(1e3)
            await c.kb("e")
            await sleep(2400)
            await c.kb("space")
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
        if (state === "event") {
            await checkSkill(frame, false)
        }
        if (state !== type || (await checkFinish())) {
            setStatus("err")
            return
        }
        autoAimX = true
        await sleep(100)
        // 垂直移动
        if (config.debug) setStatus("dy", gameState.dy)
        if (gameState.dy < -100 && gameState.distance > 5 && !checkF()) {
            c.kd("space")
            while (gameState.dy < -50 && !checkF()) {
                await sleep(500)
            }
            c.ku("space")
        }
        // 远距离移动
        if (gameState.distance > 20) {
            autoAimX = true
            if (config.debug) console.debug(`远距离移动: d=${gameState.distance}`)
            await c.play("eM")
            while (gameState.distance > 10) await sleep(200)
            await c.kb("space")
            if (await checkFinish(500)) return
            notMoved.reset()
        } else {
            c.kd("w")
            await waitF(200)
            if (gameState.distance >= 7 && shiftcd.elapsed() > 2e3) {
                await c.kb("shift")
                shiftcd.reset()
            }
            if (Math.abs(lastd - gameState.distance) < 1.5) {
                if (notMoved.elapsed() > 2500) {
                    await c.kb("space")
                    await sleep(300)
                    await c.kb("space")
                    notMoved.reset()
                }
            } else if (gameState.distance > 0) {
                notMoved.reset()
            }
            await waitF(500)
            c.ku("w")
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
    c.ku("w")
    const timer = new Timer()
    const timer2 = new Timer()
    c.mt() // 锁定BOSS
    await sleep(300)
    while (checkStop()) {
        if (config.battleTime < timer2.elapsed()) {
            await exitAction(2) // 战斗超时
            return
        }
        const state = gameState.state
        setStatus("state", state)
        await checkSkill(frame)
        // const isBoss = state.includes("boss")
        const isInv = state.includes("inv")
        if (state === "buff") {
            c.kb("esc")
            c.mc(1456, 808)
            await sleep(300)
            continue
        }
        if (!state.includes("battle") && state !== "unknown") {
            setStatus("fn")
            c.mt()
            return
        } else if (state === "unknown") {
            c.mc(1456, 808)
            await sleep(1e3)
        }
        c.mt() // 锁定BOSS
        await sleep(300)
        c.mc()
        if (isInv) {
            await c.kb("space", 1e3)
        }
    }
}

async function exitAction(type = 1) {
    c.kb("esc", 33)
    await sleep(800)
    if (type === 2)
        c.mc(1358, 826) // 暂离
    else c.mc(1498, 816) // 退出
    await sleep(500)
    c.mc(1004, 521) // 确定
    await sleep(1e3)
}
/** 重置 */
async function resetLoop(skip = false) {
    setStatus("fn", "resetLoop")
    c.kb("esc", 33)
    await sleep(800)
    if (!skip) {
        await moveC(c.hwnd, 1115, 820 + c.yof, 300) // 设置
        await sleep(500)
        await moveC(c.hwnd, 563, 28 + c.yof, 500) // 其他
        await moveC(c.hwnd, 1356, 632 + c.yof, 500) // 重置
        await sleep(200)
        c.mc(1010, 379)
    }
    await moveC(c.hwnd, 999, 506 + c.yof, 100) // 确定
    await sleep(500)
    c.mt()
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
        c.mc(offsetX + match[0] + 10, offsetY + match[1] + 10)
    } else {
        c.mc(1022, 696)
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
    const filterd = colorFilter(roi, [0xffffff], 60)
    const bboxs = segmentChars(filterd, 1, 2)
    const chars = bboxs.map(v => filterd.roi(...v))
    const hashs = chars.map(v => perceptualHash(v))
    const ret = hashs
        .map(v => {
            const r = matchHammingHash(v, chasharr, 30)
            return r >= 0 && ct[r].k !== "米" ? ct[r].k : ""
        })
        .join("")
    const num = +ret > 100 ? ~~(+ret / 10) : +ret
    if (config.single && config.debug) setStatus("num", filterd, num)
    if (config.single && config.debug) setStatus("chars", chars, hashs.join("\n"))
    return num
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
    const d = +numocr(numroi)
    gameState.distance = Number.isFinite(d) ? d : md
    setStatus("route", `寻路${autoAimX ? "X" : ""}${autoAimY ? "Y" : ""}: ${~~door.dx}, ${~~door.dy}, ${gameState.distance}m`)
}

async function main() {
    if (config.single) {
        console.log("single")
        gameState.state = checkState(frame)
        setStatus("state", gameState.state)
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
        c.kb("x")
    }, 2e3)

    const ftimer = setInterval(() => {
        frame = c.cap()
        gameState.mp = getMP(frame)
        gameState.state = checkState(frame)
        if (gameState.state === "buff") {
            c.mc(1456, 808)
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
                if (config.debug) drawBorder(c.hwnd, ...door.match.bbox)
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
                if (!autoAimY) c.mt()
                mm(autoAimX ? fastX : 0, autoAimY ? fastY : 0)
            } else {
                gameState.distance = 0
                mm(1, -1)
                // turn(1)
            }
        } else {
            doorTripleBuffer.length = 0
            setStatus("route")
        }
    }, config.ftime)
    setForegroundWindow(c.hwnd)
    await sleep(100)
    await moveTo(c.hwnd, 200, 1 + c.yof, 100)
    c.mt()
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
                await c.kb("esc")
                await sleep(1e3)
                c.mc(153, 454)
                await sleep(1e3)
                c.mc(893, 28)
                await sleep(1e3)
                c.mc(889, 595)
                await sleep(1200)
                break
            case "door":
            case "event":
                findFn = state === "door" ? findDoor : findYellow
                await moveLoop(state)
                break
            case "shop":
                await selectShopOption()
                await c.kb("space", 1000)
                break
            case "esc_menu":
                c.mc(999, 506)
                break
            case "esc":
            case "buy":
                c.kb("esc")
                await sleep(1000)
                break
            case "buff":
                c.mc(1456, 808)
                await sleep(300)
                break
            case "finish": {
                const secs = timer.elapsed() / 1e3
                if (secs > 5) {
                    timer.reset()
                    console.info(`完成 ${++finished}次 用时 ${~~(secs / 60)}分${~~(secs % 60)}秒`)
                }
                c.mc(1456, 808)
                await sleep(1500)
                break
            }
            case "enter":
                c.mc(1456, 808)
                break
            case "unknown":
                if (i++ > 5) {
                    c.mc(1456, 808)
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
            await moveTo(c.hwnd, 0, 0)
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
