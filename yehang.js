// ==UserScript==
// @id 2pyOSUe1oQ
// @name yehang
// @description 夜航黎瑟基本通用
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/08/05 23:14
// ==/UserScript==

// 艾达挂70新本/80jjb的配置: +2(L0.3#0.3) q +16(e0.1#0.5)

import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))
const config = {
    ftime: readConfig("帧间隔", "取帧间隔(毫秒)", "number", 200),
    debug: readConfig("debug", "-", "boolean", false),
    single: readConfig("single", "单帧识别", "boolean", false),
    book: readConfig("倍率书", "选择用的书类型", ["不用", "绿书", "蓝书", "紫书", "金书"], "不用"),
    /** @type {ROI} */ minimapLoc: [30, 35, 180, 180],
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
    actionstart: readConfig("开始时的动作", "标准动作序列 比如+2(L0.3#0.2)", "string", "+2(L0.3#0.2)"),
}

class RouteState {
    yellowP = getTemplateB64(
        "iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAMAAACelLz8AAABblBMVEUAAAC9dyN/h1fOnUr//55+hlfPm0p/h1cQHBl+hlZETTbOm0nPm0nPnErQnkv//57//57//55+hlZ+hVbRn0vRnUr//57//55/hleBiFd9hFV+hVbRn0vPmkn//57//57//57//57//57//57//57//56AiVgMHBz//57//57//57//57//57//558hFb//56BhlW9dyO9diP//8b//73//6H//7///7v//8P//8H//7b//6nkzY3Qn0r//8rmzZP/85D/1Yn/y4Tix37//8///7P/6LL//6///6X7z571xIbixoLjxnzku27//Lz98rn/56r++Kn51Kf/3qb/25z//Zr//5f/+pf/4pX/15X/5ZL/6Y3/4Izjx4vm0IrkzYj5yYTjyIT//LH517D/8K77267/8an/+J3/85z/8Jzy0Jj/8Jf4zpb2w5D/x47/143syYr/x4f/1oXmxILxw4Dhvn3ly3vkzXThq3Lip16Wiv2WAAAAMXRSTlMA/hr8sh/1MAUuCfjy6965tYorJ/jl2ZRHQTs0++bez8nCr6mkj2IQzaWeg3t5cGsWsWovNQAAAYpJREFUKM9t0mVzwkAQBuBcAhR3KJS6e3t3EZIQinsdd+ru+u8LDNOBwH67eeZ29u5dor+0pJoYXbs7i+7Rplxy2E2eUWZb1EOkX1cOi3VeBVtp5Ngg5TKm0ME9v9cHjFukTMwq9MVhL27bJjl4RwX3bwUO+/k0MFps6gGpH5cLIs3zdB0Z5t3anmgUKpSJnp2WGQ5HMBtG1MzySk/a3XJM/Kp0I3ojGNMNKE1vr3Qn0MFMthTI54tFJh4VaI5rIGp6WUsoTXYYjl6cJp8DgWqFSTAJMS6EkTTrIUjzJGxx9MHhefIpFHqrBAoJUQhDu0JDqF2z7cdG/Dx9ePKY+mgGq/e5b6hbsHWScJn0cA9jWji+e0k1g8HgPqIU1u6Eas+CHmREhrnOPqReQ6FfRJk0/1+7ZgDvR7GjWOzyJPmDqLmxvkDGHSDNY5ZlDz6RNGcdjHEK+Fgvi32IWtXIIrYYQScUJDkn5IGRlilQq0HJ6RqxGuMGgCine1i6NjnT6zbc09wvshXtP/0B1T1FDU6xETsAAAAASUVORK5CYII="
    )
    /** @param {Mat} frame */
    checkState(frame) {
        if (cc(frame, 96, 116, 0x080908, 10)) {
            return "zuoguai"
        } else {
            if (cc(frame, 133, 194, 0x080908, 10)) {
                return "zhizou"
            } else {
                if (cc(frame, 106, 134, 0x080908, 10)) {
                    return "youguai"
                }
            }
        }
        return "unknown"
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
    /**
     * 找颜色
     * @param {Mat} img 窗口截图
     * @param {number[]} colors 颜色数组
     */
    async findColors(img, colors = [0xffd984, 0xc28334, 0xf0e084], threshold = 10) {
        /** @param {number} deg */
        function degTo360(deg) {
            return (deg + 360) % 360
        }
        // x: 290~1312 y: 168~681
        const xOffset = config.mainLoc[0]
        const yOffset = config.mainLoc[1]
        const roi = img.roi(...config.mainLoc)
        const filtered = colorFilter(roi, colors, threshold)
        const closed = morphologyEx(filtered, "close", 4)
        const contours = findContours(closed, 100).filter(
            c => c.area < 420 && c.bbox[2] < 28 && c.bbox[3] < 28 && Math.abs(c.bbox[2] - c.bbox[3]) < 2
        )
        /** @type {{center: [number, number], bbox: [number, number, number, number], area: Mat}[]} */
        const matches = []
        for (const c of contours) {
            const area = roi.roi(...c.bbox)
            matches.push({
                center: [c.center[0] + xOffset, c.center[1] + yOffset],
                bbox: [c.bbox[0] + xOffset, c.bbox[1] + yOffset, c.bbox[2], c.bbox[3]],
                area,
            })
        }
        for (const match of matches) {
            const di = await matchTemplate(match.area, this.yellowP, 10)
            if (!di) continue
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

    async start() {
        const map = this.checkState(c.cap())
        switch (map) {
            case "zuoguai":
                await c.fastMove()
                await c.dash()
                await c.fastMove()
                await c.dash()
                await c.fastMove()
                await c.dash()
                await c.turn(-90)
                await c.fastMove()
                await c.dash()
                await c.turn(90)
                await c.fastMove()
                break
            case "zhizou":
                await c.fastMove()
                await c.dash()
                await c.fastMove()
                await c.dash()
                kd(c.hwnd, "d")
                await c.kb("w", 2000)
                ku(c.hwnd, "d")
                await c.fastMove()
                await c.dash()
                await c.fastMove()
                await c.dash()
                kd(c.hwnd, "a")
                await c.kb("w", 2000)
                ku(c.hwnd, "a")
                await c.fastMove()
                break
            case "youguai":
                await c.fastMove()
                await sleep(300)
                await c.turn(90)
                kd(c.hwnd, "a")
                await c.kb("w", 2400)
                ku(c.hwnd, "a")
                await c.fastMove()
                await c.fastMove()
                await c.dash()
                await c.fastMove()
                kd(c.hwnd, "a")
                await c.kb("w", 1000)
                ku(c.hwnd, "a")
                break
        }
    }
    async moveLoop() {
        kd(c.hwnd, "w")
        while (true) {
            const d = await this.findColors(c.cap())
            if (d) {
                if (d.out) {
                }
            } else {
                await c.turn(90)
            }
            await sleep(config.ftime)
        }
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
        const lastState = this.state
        await this.waitUntil()
        switch (this.state) {
            case "unknown":
                c.mc(757, 733)
                break
            case "r":
                this.moved = false
                await c.kb("r")
                break
            case "space":
                await this.selectBoost(config.book)
                break
            case "battle":
                if (!this.moved) {
                    this.moved = true
                    await sleep(2000)
                    await c.play(config.actionstart)
                }
                if (!cc(c.frame, 1437, 799, 0xffffff, 10)) {
                    await c.kb("q")
                }
                break
        }
        await sleep(config.ftime)
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
        await c.play("L0.4")
        return
    }
    while (true) {
        await mainState.next()
    }
}
main()
