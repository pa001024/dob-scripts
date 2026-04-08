class Cap {
    constructor() {
        this.frameless = readConfig("无边框", "游戏启动中开启无标题栏", "boolean", false)
        this.hwnd = getCGWindow() || getWindowByProcessName("EM-Win64-Shipping.exe")
        this.yof = this.frameless ? 0 : 30
        checkSize(this.hwnd, 1600, 900 + this.yof)
        /** @type Mat */
        this.frame = this.cap()
    }
    cap() {
        this.frame = this.frameless ? captureWindowWGC(this.hwnd) : captureWindowWGC(this.hwnd).roi(0, 30, 1600, 900)
        return this.frame
    }
    /** @param {number} x @param {number} y */
    mc(x, y) {
        return mc(this.hwnd, x, y + this.yof)
    }
}
/** @type {ROI} */
const minimapLoc = [30, 35, 180, 180]
/** @type {ROI} */
const mainLoc = [290, 169, 1020, 514]
class RouteState {
    /**
     * 找颜色
     * @param {Mat} img 窗口截图
     * @param {number[]} colors 颜色数组
     * @param {string[]} names 颜色名称数组
     */
    findColors(img, colors, names, threshold = 10, mode = "single") {
        // x: 290~1312 y: 168~681
        const xOffset = mainLoc[0]
        const yOffset = mainLoc[1]
        const roi = img.roi(...mainLoc)
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
}

const c = new Cap()
class MainState {
    state = "unknown"
    ftime = readConfig("间隔", "识图间隔", "number", 200)

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
            while (!states.includes(this.state)) await sleep(this.ftime)
        } else await sleep(this.ftime)
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
        await sleep(500)
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
    while (true) {
        main.next()
    }
}
main()
