// ==UserScript==
// @id 2pyOSUe1oQ
// @name yehang
// @description 夜航黎瑟/艾达基本通用
// @author pa
// @version 1.1.0
// @category 其他
// @date 2026/08/09 10:24
// ==/UserScript==

// 艾达可挂70新本/80jjb

import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))
const config = {
    ftime: readConfig("帧间隔", "取帧间隔(毫秒)", "number", 200),
    debug: readConfig("debug", "-", "boolean", false),
    single: readConfig("single", "单帧识别", "boolean", false),
    book: readConfig("倍率书", "选择用的书类型", ["不用", "绿书", "蓝书", "紫书", "金书"], "不用"),
    /** @type {ROI} */ minimapLoc: [30, 35, 180, 180],
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
    actionstart: readConfig("开始时的动作", "标准动作序列 比如+2(L0.3#0.4)", "string", "+2(L0.3#0.4)"),
    actionbattle: readConfig("途中的动作", "标准动作序列 比如+0(e0.2 R0.1 d0.5 M #1)", "string", "+0(e0.2 R0.1 d0.5 M #1)"),
    banmap: readConfig("屏蔽地图", "地图代码 逗号分隔", "string", "39e4644ccda6b998,9ac35114ae38add6,9e8d79a64c89a670"),
}

class RouteState {
    /** 找颜色 @param {Mat} img 窗口截图 */
    findYP(img, threshold = 20) {
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

    /** 转视角 @param {number} angle 角度 */
    async turn(angle) {
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

    autoAimCalib = {
        hFovDeg: 90,
        xMm: 100,
        yMm: 100,
        xDeltaPx: Math.abs(-218 - 14.5),
        yDeltaPx: Math.abs(-143.7 - 42),
    }

    autoAimModel = (() => {
        const w = config.mainLoc[2]
        const h = config.mainLoc[3]
        const hFovRad = (this.autoAimCalib.hFovDeg * Math.PI) / 180
        const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) * (h / w))
        const fx = w / 2 / Math.tan(hFovRad / 2)
        const fy = h / 2 / Math.tan(vFovRad / 2)
        const xDegByCalib = (Math.atan(this.autoAimCalib.xDeltaPx / fx) * 180) / Math.PI
        const yDegByCalib = (Math.atan(this.autoAimCalib.yDeltaPx / fy) * 180) / Math.PI
        return {
            fx,
            fy,
            mmPerDegX: this.autoAimCalib.xMm / xDegByCalib,
            mmPerDegY: this.autoAimCalib.yMm / yDegByCalib,
        }
    })()

    /**
     * 屏幕投影偏移 -> 摄像机角度 -> mm参数
     * @param {number} dx
     * @param {number} dy
     * @param {{out?: boolean, rawDy?: number}} [opts]
     */
    projectOffsetToMm(dx, dy, opts = {}) {
        let yawDeg = (Math.atan(dx / this.autoAimModel.fx) * 180) / Math.PI
        const pitchDeg = (Math.atan(dy / this.autoAimModel.fy) * 180) / Math.PI
        if (opts.out && opts.rawDy) {
            // 边缘点会被压在椭圆上，使用 dx + 椭圆修正后的 dy 计算平面方向角。
            const rawDy = Number.isFinite(opts.rawDy) ? opts.rawDy : dy
            const dyi = (rawDy * 496) / 239
            yawDeg = (Math.atan2(dx, -dyi) * 180) / Math.PI
        }
        return {
            yawDeg,
            pitchDeg,
            mmx: Math.round(yawDeg * this.autoAimModel.mmPerDegX),
            mmy: Math.round(pitchDeg * this.autoAimModel.mmPerDegY),
        }
    }

    /** @param {Mat} roi  */
    numocr(roi) {
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
    distance = 0
    /** @param {*} door */
    ocrDistance(door, md = 0) {
        const numroi = c.frame.roi(door.match.bbox[0] - 4, door.match.bbox[1] + door.match.bbox[3] + 5, 32, 15)
        let d = +this.numocr(numroi)
        if (d >= 100) d = ~~(d / 10)
        this.distance = Number.isFinite(d) ? d : md
        setStatus("distance", this.distance)
    }
    async moveLoop() {
        const t = new Timer()
        c.kd("w")
        await sleep(100)
        while (!this.distance || this.distance > 5) {
            c.ku("w")
            c.kd("w")
            const door = this.findYP(c.cap())
            if (door) {
                this.ocrDistance(door)
                setStatus("route", `传统寻路: ${~~door.dx}, ${~~door.dy}`)
                const first = this.projectOffsetToMm(door.dx, door.dy - 100, { out: door.out, rawDy: door.dy })
                setStatus("yawDeg", first.yawDeg)
                if (Math.abs(first.yawDeg) > 32) {
                    await this.turn(45 * Math.sign(first.yawDeg))
                    c.kd("w")
                }
            }
            if (t.elapsed() > 20e3) {
                console.error("超时")
                break
            }
            await sleep(100)
        }
        c.ku("w")
    }
}

class MainState {
    /** @type {ReturnType<typeof MainState.prototype.checkState>} */
    state = "unknown"
    route = new RouteState()
    /** @param {Mat} frame  */
    checkState(frame) {
        if (cc(frame, 1052, 794, 0xe1b454, 10)) {
            return "r"
        } else {
            if (cc(frame, 47, 26, 0xffffff, 10)) {
                return "battle"
            } else {
                if (cc(frame, 622, 607, 0x000000, 10)) {
                    return "space"
                }
            }
        }
        return "unknown"
    }

    /** @param {Mat} frame  */
    checkMap(frame) {
        let roi = frame.roi(55, 78, 129, 96)
        roi = colorFilter(roi, [0x080908], 20)
        const phash = perceptualHash(roi)
        setStatus("地图代码", phash)
        if (matchHammingHash(phash, config.banmap.split(","), 10) >= 0) {
            return "exit"
        }
        return "keep"
    }

    updateState() {
        this.state = this.checkState(c.cap())
    }

    /**@param {string[]} [states] */
    async waitUntil(states, timeout = 0) {
        this.updateState()
        setStatus("state", this.state)
        if (states) {
            const timer = new Timer()
            while (!states.includes(this.state) && (timeout ? timer.elapsed() < timeout : true)) {
                await sleep(config.ftime)
                this.updateState()
            }
        }
    }
    moved = false
    async next() {
        const t = new Timer()
        /** @type {any} */ let bp = null
        while (true) {
            const lastState = this.state
            await this.waitUntil()
            switch (this.state) {
                case "unknown":
                    c.mc(757, 733)
                    break
                case "battle":
                    if (!this.moved) {
                        setStatus("fn", "start move")
                        this.moved = true
                        if (this.checkMap(c.frame) === "exit") {
                            await c.kb("esc")
                            await sleep(500)
                            c.mc(1484, 822)
                            await sleep(500)
                            c.mc(978, 516)
                            await sleep(2e3)
                            break
                        }
                        await sleep(3000)
                        await c.play(config.actionstart)
                        await this.route.moveLoop()
                        setStatus("fn", "end move")
                    }
                    if (!cc(c.frame, 1437, 799, 0xffffff, 10)) {
                        await c.kb("q")
                    }
                    if (bp) {
                        if (t.elapsed() > 10e3) {
                            t.reset()
                            bp.stop()
                            setStatus("fn", "auto aim battle")
                            await this.route.moveLoop()
                            setStatus("fn", "auto aim end")
                            bp = c.play(config.actionbattle)
                        }
                        break
                    }
                    setStatus("fn", "action battle")
                    if (!bp) bp = c.play(config.actionbattle)

                    break
                case "r":
                    if (bp) {
                        setStatus("fn", "battle stop")
                        bp.stop()
                        bp = null
                    }
                    this.moved = false
                    await c.kb("r")
                    break
                case "space":
                    await this.selectBoost(config.book)
                    break
            }
            await sleep(config.ftime)
        }
    }
    /** 选择倍率书 @param {number|string} [book=0]  */
    async selectBoost(book = 0) {
        if (typeof book === "string") {
            const indexes = ["不用", "绿书", "蓝书", "紫书", "金书"]
            book = indexes.indexOf(book)
        }
        c.mc(538, 495 + (522 / 4) * book)
        await sleep(100)
        c.kb("space")
        await sleep(1000)
    }
}

async function main() {
    const mainState = new MainState()
    if (config.single) {
        // await mainState.next()
        // await mainState.route.moveLoop()
        await c.play(config.actionstart)
        let bp = null
        bp = c.play(config.actionbattle)
        await sleep(10e3)
        bp.stop()
        await sleep(10e3)
        return
    }
    await mainState.next()
}
main()
