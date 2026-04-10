const config = {
    ftime: readConfig("帧间隔", "取帧间隔(毫秒)", "number", 100),
    frameless: readConfig("无边框", "无边框窗口", "boolean", false),
    debug: readConfig("debug", "-", "boolean", false),
    single: readConfig("single", "单帧识别", "boolean", false),
    /** @type {ROI} */ minimapLoc: [30, 35, 180, 180],
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
}

class Cap {
    constructor() {
        this.frameless = readConfig("无边框", "游戏启动中开启无标题栏", "boolean", false)
        this.hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
        if (!this.hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
        this.yof = this.frameless ? 0 : 30
        checkSize(this.hwnd, 1600, 900 + this.yof)
        /** @type Mat */
        this.frame = this.cap()
    }
    cap() {
        this.frame = this.frameless ? captureWindowWGC(this.hwnd) : captureWindowWGC(this.hwnd, 0, 30, 1600, 900)
        return this.frame
    }
    /** @param {number} x @param {number} y */
    mc(x, y) {
        return mc(this.hwnd, x, y + this.yof)
    }
    /**
     * 按键操作（异步）
     * @param {KeyEnum} key 按键名称
     * @param {number} [duration] 按键持续时间
     */
    async kb(key, duration) {
        await kb(this.hwnd, key, duration)
    }
    /**
     * 等待窗口指定坐标颜色达到条件（异步）
     * @param {number} x X坐标（窗口客户区）
     * @param {number} y Y坐标（窗口客户区）
     * @param {number} color 目标颜色（0xRRGGBB）
     * @param {number} tolerance 容差（正数=等待符合，负数=等待不符合，按绝对值参与比较）
     * @param {number} [timeout] 超时时间（毫秒），默认 20000
     * @returns 命中条件返回 true，超时返回 false
     */
    async waitColor(x, y, color, tolerance, timeout) {
        return await waitColor(this.hwnd, x, y + this.yof, color, tolerance, timeout)
    }
}
const c = new Cap()
class RouteState {
    yellowP = getTemplateB64(
        "iVBORw0KGgoAAAANSUhEUgAAABoAAAAaCAMAAACelLz8AAABblBMVEUAAAC9dyN/h1fOnUr//55+hlfPm0p/h1cQHBl+hlZETTbOm0nPm0nPnErQnkv//57//57//55+hlZ+hVbRn0vRnUr//57//55/hleBiFd9hFV+hVbRn0vPmkn//57//57//57//57//57//57//57//56AiVgMHBz//57//57//57//57//57//558hFb//56BhlW9dyO9diP//8b//73//6H//7///7v//8P//8H//7b//6nkzY3Qn0r//8rmzZP/85D/1Yn/y4Tix37//8///7P/6LL//6///6X7z571xIbixoLjxnzku27//Lz98rn/56r++Kn51Kf/3qb/25z//Zr//5f/+pf/4pX/15X/5ZL/6Y3/4Izjx4vm0IrkzYj5yYTjyIT//LH517D/8K77267/8an/+J3/85z/8Jzy0Jj/8Jf4zpb2w5D/x47/143syYr/x4f/1oXmxILxw4Dhvn3ly3vkzXThq3Lip16Wiv2WAAAAMXRSTlMA/hr8sh/1MAUuCfjy6965tYorJ/jl2ZRHQTs0++bez8nCr6mkj2IQzaWeg3t5cGsWsWovNQAAAYpJREFUKM9t0mVzwkAQBuBcAhR3KJS6e3t3EZIQinsdd+ru+u8LDNOBwH67eeZ29u5dor+0pJoYXbs7i+7Rplxy2E2eUWZb1EOkX1cOi3VeBVtp5Ngg5TKm0ME9v9cHjFukTMwq9MVhL27bJjl4RwX3bwUO+/k0MFps6gGpH5cLIs3zdB0Z5t3anmgUKpSJnp2WGQ5HMBtG1MzySk/a3XJM/Kp0I3ojGNMNKE1vr3Qn0MFMthTI54tFJh4VaI5rIGp6WUsoTXYYjl6cJp8DgWqFSTAJMS6EkTTrIUjzJGxx9MHhefIpFHqrBAoJUQhDu0JDqF2z7cdG/Dx9ePKY+mgGq/e5b6hbsHWScJn0cA9jWji+e0k1g8HgPqIU1u6Eas+CHmREhrnOPqReQ6FfRJk0/1+7ZgDvR7GjWOzyJPmDqLmxvkDGHSDNY5ZlDz6RNGcdjHEK+Fgvi32IWtXIIrYYQScUJDkn5IGRlilQq0HJ6RqxGuMGgCine1i6NjnT6zbc09wvshXtP/0B1T1FDU6xETsAAAAASUVORK5CYII="
    )
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
}

class MainState {
    state = "unknown"

    /** @param {Mat} frame  */
    checkState(frame) {
        if (cc(frame, 44, 272, 0xf1494e, 20)) {
            return "battle_quli"
        } else {
            if (cc(frame, 39, 361, 0x88c797, 20)) {
                return "battle_def"
            } else {
                if (cc(frame, 538, 491, 0x000000, 20)) {
                    return "enter_space"
                } else {
                    if (cc(frame, 46, 28, 0xf6f6f6, 20)) {
                        return "move"
                    } else {
                        if (cc(frame, 25, 25, 0xfff6b4, 20)) {
                            return "enter"
                        } else {
                            if (!cc(frame, 1537, 871, 0x000000, 20) && cc(frame, 1207, 878, 0x000000, 20)) {
                                return "finish"
                            }
                        }
                    }
                }
            }
        }
        return "unknown"
    }

    /**@param {string[]} [states] */
    async waitUntil(states) {
        this.checkState(c.cap())
        setStatus("state", this.state)
        if (states) {
            while (!states.includes(this.state)) await sleep(config.ftime)
        } else await sleep(config.ftime)
    }
    async next() {
        const lastState = this.state
        await this.waitUntil()
        switch (this.state) {
            case "unknown":
                c.mc(757, 733)
                break
            case "battle_quli":
                if (lastState.startsWith("battle")) this.battleAction()
                else await this.battleEnter()
                break
            case "battle_def":
                if (lastState.startsWith("battle")) this.battleAction()
                else await this.battleEnter()
                break
            case "move":
        }
        await sleep(config.ftime)
    }
    async battleEnter() {
        md()
        await sleep(600)
        mu()
        await sleep(400)
        md()
        await sleep(600)
        mu()
        await sleep(600)
    }
    async battleAction() {
        await kb(c.hwnd, "r")
        await sleep(500)
        await kb(c.hwnd, "space")
        await sleep(500)
    }
}

async function main() {
    const main = new MainState()

    if (config.single) {
    } else {
    }
}
main()
