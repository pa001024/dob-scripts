// ==UserScript==
// @id route_test_monodepth
// @name routetest
// @description 黄点搜索 + 深度避障 自动跑图
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/3/23 18:21:03
// ==/UserScript==

const config = {
    门顺序: readConfig(
        "门顺序",
        "设置门颜色优先顺序，按从高到低优先级选择",
        {
            type: "multi-select",
            options: ["黄"],
        },
        ["黄"]
    ),
    ftime: readConfig("帧间隔", "取帧间隔(毫秒)", "number", 100),
    minRegionArea: readConfig("路径最小面积", "深度可通行区域最小面积", "number", 800),
    maxCandidates: readConfig("候选数量", "深度候选方向数量", "number", 3),
    moveTimeout: readConfig("移动超时", "移动超时重置间隔(秒)", "number", 25),
    debug: readConfig("debug", "-", "boolean", false),
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
}

const hwnd = getCGWindow() || getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd) throw new Error("未找到窗口")
checkSize(hwnd)

let frame = captureWindowWGC(hwnd)
let autoAimX = false
let autoAimY = false
const autoAimoffsetY = -100

/** @type {{dx:number,dy:number,distance:number,routeDirections:[number, number][],routeCost:number,aimSource:string,frontBlocked:boolean}} */
const gameState = {
    dx: 0,
    dy: 0,
    distance: 0,
    routeDirections: [],
    routeCost: 0,
    aimSource: "scan",
    frontBlocked: false,
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

function checkStop() {
    return hwnd === getForegroundWindow()
}

/**
 * @param {number} deg
 */
function degTo360(deg) {
    return (deg + 360) % 360
}

/**
 * @param {number} v
 * @param {number} min
 * @param {number} max
 */
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v))
}

/**
 * @param {Mat} img
 * @param {number[]} colors
 * @param {string[]} names
 * @param {number} [threshold]
 * @param {"single"|"multi"} [mode]
 */
function findColors(img, colors, names, threshold = 10, mode = "single") {
    // x: 290~1312 y: 168~681
    const xOffset = config.mainLoc[0]
    const yOffset = config.mainLoc[1]
    const roi = img.roi(...config.mainLoc)
    const filtered = colorFilter(roi, colors, threshold)
    const closed = morphologyEx(filtered, "close", 4)
    imshow("closed", closed)
    const contours = findContours(closed, 100).filter(
        c => c.area < 420 && c.bbox[2] < 28 && c.bbox[3] < 28 && (mode !== "multi" || Math.abs(c.bbox[2] - c.bbox[3]) < 2)
    )
    /** @type {{center:[number,number],bbox:[number,number,number,number],color:string,door:Mat}[]} */
    const matches = []
    for (const c of contours) {
        const door = roi.roi(...c.bbox)
        const match = mode === "single" ? colorKeyMatch(door, colors, 50, 10) : 0
        let color = names[match]
        {
            const x = ~~(door.cols() / 2)
            const y = ~~(door.rows() / 2)
            color = color === "红" ? (cc(door, x, y, 0xeb3a43, 40) ? "大红" : "小红") : color
        }
        if (match !== -1) {
            if (mode === "single" && color === "黄") {
                if (!cc(door, 10, 10, 0x000000, 5)) {
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
            const dyi = (dy * 496) / 239
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
 * @param {Mat} img
 */
function findYellow(img) {
    return findColors(img, [0xffd984, 0xc28334, 0xf0e084], ["黄", "黄", "黄"], 20, "multi")
}

/**
 * @param {number} angle
 */
function turn(angle) {
    mm((2057 * angle) / 360, 0)
}

/**
 * @param {number} angle
 */
async function rollAbs(angle) {
    for (let i = 0; i < 12; i++) {
        mm(0, 100)
        await sleep(5)
    }
    await sleep(50)
    const deg = (-700 * (-angle + 90)) / 90
    for (let i = 0; i < 10; i++) {
        mm(0, ~~(deg / 10))
        await sleep(5)
    }
}

/**
 * @param {number} dx
 * @param {number} dy
 * @param {{out?: boolean, rawDy?: number}} [opts]
 */
function projectOffsetToMm(dx, dy, opts = {}) {
    let yawDeg = (Math.atan(dx / autoAimModel.fx) * 180) / Math.PI
    const pitchDeg = (Math.atan(dy / autoAimModel.fy) * 180) / Math.PI
    if (opts.out && opts.rawDy) {
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
 * @param {[number, number]} target
 * @param {[number, number][]} routeDirections
 * @returns {[number, number] | undefined}
 */
function chooseBestDirection(target, routeDirections) {
    if (!routeDirections.length) return
    let best = routeDirections[0]
    let bestScore = Number.POSITIVE_INFINITY
    for (const point of routeDirections) {
        const dx = point[0] - target[0]
        const dy = point[1] - target[1]
        const score = dx * dx * 1.2 + dy * dy * 0.8
        if (score < bestScore) {
            bestScore = score
            best = point
        }
    }
    return best
}

/** @param {Mat} roi */
function numocr(roi) {
    const chasharr = [
        "f14af14ae14be01e",
        "b0b0f0f1515b5ba4",
        "c862624b631f9d1e",
        "e1e0624bf15be09c",
        "0fb463e01fc94ab4",
        "25c9c94ba5634b1e",
        "8d9ca44b9dd8e036",
        "c90f634b4b278de0",
        "f10e624af1d9e01e",
        "48d9f263c862379c",
    ]
    const filterd = colorFilter(roi, [0xffffff], 40)
    const bboxs = segmentChars(filterd, 1, 2)
    const chars = bboxs.map(v => filterd.roi(...v))
    const hashs = chars.map(v => perceptualHash(v))
    return hashs
        .map(v => matchHammingHash(v, chasharr, 20))
        .filter(v => v >= 0)
        .join("")
}

/**
 * 持续更新 frame 与 route/gameState。
 */
async function startFrameLoop() {
    let running = false
    return setInterval(async () => {
        if (running) return
        running = true
        try {
            frame = captureWindowWGC(hwnd)
            if (!(autoAimX || autoAimY)) {
                setStatus("route")
                return
            }

            const routeStart = Date.now()
            const route = await predictMonoRoute(frame, config.minRegionArea, config.maxCandidates)
            const routeCost = Date.now() - routeStart
            /** @type {[number, number][]} */
            const routeDirections = route.directions
            const yellow = findYellow(frame)
            const frameCenter = [config.mainLoc[0] + config.mainLoc[2] / 2, config.mainLoc[1] + config.mainLoc[3] / 2]

            /** @type {[number, number] | undefined} */
            let aimPoint
            let aimSource = "scan"
            let aimDistance = 0
            let rawDy = 0
            let out = false

            if (yellow) {
                aimPoint = yellow.match.center
                aimSource = "yellow"
                rawDy = yellow.dy
                out = yellow.out
                const numroi = frame.roi(yellow.match.bbox[0] - 4, yellow.match.bbox[1] + yellow.match.bbox[3] + 7, 24, 15)
                const d = +numocr(numroi)
                aimDistance = Number.isFinite(d) ? d : 0
            }

            if (!aimPoint) {
                gameState.distance = 0
                gameState.routeDirections = []
                gameState.aimSource = "scan"
                gameState.frontBlocked = routeDirections.length === 0
                turn(1)
                setStatus("route", "scan")
                return
            }

            const dx = aimPoint[0] - frameCenter[0]
            const dy = aimPoint[1] - frameCenter[1]
            const first = projectOffsetToMm(dx, dy + autoAimoffsetY, { out, rawDy })
            let fastX = clamp(first.mmx, -320, 320)
            let fastY = clamp(first.mmy, -320, 320)
            if (Math.abs(fastX) < 5) fastX = 0
            if (Math.abs(fastY) < 5) fastY = 0

            gameState.dx = fastX
            gameState.dy = fastY
            gameState.distance = aimDistance
            gameState.routeDirections = routeDirections
            gameState.routeCost = routeCost
            gameState.aimSource = aimSource
            gameState.frontBlocked = routeDirections.length === 0

            if (config.debug) {
                if (yellow) drawBorder(hwnd, ...yellow.match.bbox)
                // for (const [x, y] of routeDirections) {
                //     drawBorder(hwnd, x - 10, y - 10, 20, 20, 80)
                // }
                // drawBorder(hwnd, aimPoint[0] - 10, aimPoint[1] - 10, 20, 20, 80)
            }

            mm(autoAimX ? fastX : 0, autoAimY || out ? fastY : 0)
            setStatus("route", `${aimSource}: ${~~dx}, ${~~dy}, ${~~aimDistance}m`)
            setStatus("route_directions", JSON.stringify(routeDirections))
            setStatus("route_cost_ms", routeCost)
        } finally {
            running = false
        }
    }, config.ftime)
}

async function waitTick(timeout = 500) {
    const timer = new Timer()
    while (checkStop() && timer.elapsed() < timeout) {
        await sleep(50)
    }
}

/**
 * 按 zhiliu_mijin 的思路持续前进，route loop 负责大方向移动，frame loop 负责实时纠偏。
 */
async function moveLoop() {
    setStatus("fn", "moveLoop")
    const totalTimeout = new Timer()
    const notMoved = new Timer()
    const shiftcd = new Timer()
    let lastDistance = 0

    while (checkStop()) {
        setStatus("fn", "moveLoop")
        autoAimX = true
        await sleep(100)

        if (gameState.distance <= 0) {
            turn(1)
            await sleep(50)
            continue
        }

        if (gameState.distance > 20 || (gameState.distance > 10 && gameState.dy < -30) || gameState.dy < -220) {
            autoAimX = false
            const yew = gameState.frontBlocked ? -12 : gameState.distance > 29 ? -45 : gameState.distance > 20 ? -25 : -12
            await rollAbs(yew)
            await kb(hwnd, "4")
            await sleep(500)
            await rollAbs(0)
            autoAimY = true
            await waitTick(300)
            autoAimY = false
            mt(hwnd)
            await sleep(33)
            mc(hwnd)
            await sleep(33)
            mc(hwnd)
            autoAimX = true
            notMoved.reset()
        } else {
            kd(hwnd, "w")
            await waitTick(200)
            if (gameState.distance >= 8 && shiftcd.elapsed() > 2e3) {
                await kb(hwnd, "shift")
                shiftcd.reset()
            }
            if (Math.abs(lastDistance - gameState.distance) < 1.5) {
                if (notMoved.elapsed() > 2500) {
                    await kb(hwnd, "space")
                    await sleep(300)
                    await kb(hwnd, "space")
                    notMoved.reset()
                }
            } else if (gameState.distance > 0) {
                notMoved.reset()
            }
            await waitTick(500)
            ku(hwnd, "w")
            lastDistance = gameState.distance
        }

        if (totalTimeout.elapsed() > config.moveTimeout * 1e3) {
            autoAimX = false
            autoAimY = false
            ku(hwnd, "w")
            setStatus("route", "timeout")
            return
        }
        await sleep(10)
    }
}

async function main() {
    initMonoDepth()
    setForegroundWindow(hwnd)
    await sleep(100)
    mt()
    await sleep(100)

    const frameLoopTimer = await startFrameLoop()
    await moveLoop()
    clearInterval(frameLoopTimer)
    ku(hwnd, "w")
    console.log("切换窗口 自动退出")
}

main()
