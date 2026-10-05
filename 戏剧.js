// ==UserScript==
// @id iavUWdeN9g
// @name 戏剧
// @description 1.6
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/09/28 14:20
// ==/UserScript==

import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

const config = {
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
    debug: readConfig("debug", "", "boolean", false),
    mode: readConfig("模式", "选择操作的角色", { type: "select", options: ["艾达", "芙罗拉"] }, "芙罗拉"),
}
/** 找颜色 @param {Mat} img 窗口截图 */
function findYP(img, threshold = 20) {
    const xOffset = config.mainLoc[0]
    const yOffset = config.mainLoc[1]
    const roi = img.roi(...config.mainLoc)
    const filtered = colorFilter(roi, [0xffd984, 0xc28334, 0xf0e084], threshold)
    const closed = morphologyEx(filtered, "close", 4)
    const contours = findContours(closed, 100).filter(c => c.area < 420 && c.bbox[2] < 28 && c.bbox[3] < 28)
    for (const t of contours) {
        const door = roi.roi(...t.bbox)
        let match = -1
        const doorf = colorFilter(door, [0xffffc5], 20)
        const chars = segmentChars(doorf).map(v => doorf.roi(...v))
        if (chars.some(v => matchHammingHash(perceptualHash(v), ["4bccf9360638d998"]) >= 0)) {
            match = 0
        }
        if (match !== -1) {
            const m = {
                center: [t.center[0] + xOffset, t.center[1] + yOffset],
                bbox: [t.bbox[0] + xOffset, t.bbox[1] + yOffset, t.bbox[2], t.bbox[3]],
                door,
            }
            const windowCenter = [xOffset + config.mainLoc[2] / 2, yOffset + config.mainLoc[3] / 2]
            const dx = m.center[0] - windowCenter[0]
            const dy = m.center[1] - windowCenter[1]
            const dyi = (dy * 496) / 239 // 椭圆转圆形
            const deg = Math.atan2(dy, dx) * (180 / Math.PI)
            const distance = Math.hypot(dx, dyi)
            if (config.debug) drawBorder(c.hwnd, m.bbox[0], m.bbox[1] + 30, m.bbox[2], m.bbox[3])
            // console.log(`dx: ${dx.toFixed(2)}, dy: ${dy.toFixed(2)}, 角度: ${deg.toFixed(2)}, 距离: ${distance.toFixed(2)}m`)
            return {
                match: m,
                dx,
                dy,
                angle: (deg + 90 + 360) % 360,
                distance,
                out: distance > 420,
            }
        }
    }
}

/** @param {Mat} frame */
function xijuCheck(frame) {
    if (cc(frame, 47, 27, 0xffffff, 10)) {
        if (cc(frame, 44, 273, 0xffffc8, 10)) {
            return "move"
        } else {
            return "battle"
        }
    }
    if (cc(frame, 1063, 841, 0xe1b454, 10)) {
        return "end"
    } else {
        if (cc(frame, 45, 274, 0xff4d55, 10)) {
            return "battle"
        }
    }
    if (c.croi(c.frame.roi(1417, 781, 65, 33), "357c0f762774c882", 10, 1, 0xffffd8, 70)) return "a"
    return "unknown"
}

/** 转视角 @param {number} angle 角度 */
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
        for (const key of keys) c.kd(key)
        await sleep(duration)
        for (let i = keys.length - 1; i >= 0; i--) c.ku(keys[i])
    }
    const key = turnKeyMap[`${angle}`]
    if (!key) return
    await tapTurnKeys(key)
    await sleep(16)
    mt(c.hwnd)
    await sleep(300)
    mt(c.hwnd)
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
function checkF() {
    const phash = perceptualHash(c.frame.roi(955, 442, 14, 16))
    const matched = matchHammingHash(phash, ["a6a69e19631c69e2"], 10) >= 0
    return matched
}

async function startMove() {
    const t = new Timer()
    c.kd("w")
    await sleep(100)
    while (!checkF()) {
        c.ku("w")
        c.kd("w")
        updateState()
        if (state !== "move") break
        const door = findYP(c.cap())
        if (door) {
            setStatus("route", `传统寻路: ${~~door.dx}, ${~~door.dy}`)
            const first = projectOffsetToMm(door.dx, door.dy - 100, { out: door.out, rawDy: door.dy })
            setStatus("yawDeg", first.yawDeg)
            if (Math.abs(first.yawDeg) > 32) {
                await turn(45 * Math.sign(first.yawDeg))
                c.kd("w")
            }
        }
        c.kb("f")
        if (t.elapsed() > 10e3) {
            await c.play("_0.1 #0.5 _0.2")
        }
        if (t.elapsed() > 20e3) {
            console.error("超时")
            await c.kb("esc")
            await sleep(500)
            c.mc(1316, 823) // 重新开始
            await sleep(500)
            c.mc(975, 523) // 确定
            await sleep(2500)
            break
        }
        await sleep(100)
    }
    c.ku("w")
}
let state = xijuCheck(c.cap())

function updateState() {
    state = xijuCheck(c.cap())
    setStatus("state", state)
}

async function startBattle() {
    while (true) {
        updateState()
        if (state === "unknown") c.mc(1221, 846) // 重试
        if (state !== "battle" && state !== "unknown") break
        if (config.mode === "艾达" && cc(frame, 1428, 803, 0xE9E9E9, 10)) {
            setStatus("q", "1")
            await c.play("q2")
            setStatus("q")
        }
        if (config.mode === "艾达") await c.play("w0 e0.2 w^ #0.3 s0 e0.2 s^ M #0.5 R0.1 #0.5 z")
        if (config.mode === "芙罗拉") {
            if (cc(c.frame, 1443, 803, 0xe9e9e9, 40)) await c.play("q2")
            await c.play("s0M e0.1#0.2L1 s")
        }
        await sleep(200)
    }
}

async function main() {
    let count = 0
    const room = new Timer()
    const timer = new Timer()
    while (true) {
        try {
            updateState()
            switch (state) {
                case "a":
                    c.mc(1452, 795) // 前往
                    await sleep(3e3)
                    break
                case "battle":
                    room.reset()
                    await startBattle()
                    break
                case "move":
                    if (room.elapsed() > 2e3 && state === "move") {
                        await startMove()
                    }
                    break
                case "end": {
                    room.reset()
                    const secs = timer.elapsed() / 1e3
                    if (secs > 5) {
                        timer.reset()
                        console.info(`完成 ${++count}次 用时 ${~~(secs / 60)}分${~~(secs % 60)}秒`)
                    }
                    c.mc(1476, 846)
                    await sleep(1500)
                    break
                }
                default:
                    await sleep(1000)
                    updateState()
                    if (state === "unknown") {
                        await sleep(1000)
                        updateState()
                    }
                    if (state === "unknown") c.mc(1221, 846) // 重试
                    await sleep(300)
                    break
            }
            await sleep(100)
        } catch {}
    }
}
main()
