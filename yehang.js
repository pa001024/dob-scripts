const config = {
    ftime: readConfig("帧间隔", "取帧间隔(毫秒)", "number", 100),
    frameless: readConfig("无边框", "无边框窗口", "boolean", false),
    debug: readConfig("debug", "-", "boolean", false),
    single: readConfig("single", "单帧识别", "boolean", false),
    book: readConfig("倍率书", "选择用的书类型", ["不用", "绿书", "蓝书", "紫书", "金书"], "不用"),
    /** @type {ROI} */ minimapLoc: [30, 35, 180, 180],
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
}

class Cap {
    #playToken = 0

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
    /** @param {number | undefined} [x] @param {number | undefined} [y] */
    mc(x, y) {
        return mc(this.hwnd, x, y == null ? undefined : y + this.yof)
    }
    /** @param {number | undefined} x @param {number | undefined} y @param {"left" | "right" | "middle"} [button] */
    md(x, y, button) {
        md(this.hwnd, x, y == null ? undefined : y + this.yof, button)
    }
    /** @param {number | undefined} x @param {number | undefined} y @param {"left" | "right" | "middle"} [button] */
    mu(x, y, button) {
        mu(this.hwnd, x, y == null ? undefined : y + this.yof, button)
    }
    /** @param {number | undefined} x @param {number | undefined} y */
    mt(x, y) {
        mt(this.hwnd, x, y == null ? undefined : y + this.yof)
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
    /**
     * 播放 DSL 宏。
     * @param {string} dsl
     * @returns {Promise<void>}
     */
    async play(dsl) {
        const token = this.#beginPlay()
        try {
            await this.#runDslNodes(this.#parseDsl(dsl), token)
        } catch (error) {
            if (error instanceof PlayInterruptedError) return
            throw error
        } finally {
            if (this.#playToken === token) this.#playToken = 0
        }
    }

    stopPlay() {
        this.#playToken++
    }

    async fastMove() {
        await this.kb("space")
        await sleep(400)
        await this.kb("4")
        await sleep(300)
        this.mc()
        await sleep(1000)
    }

    async dash() {
        kd(this.hwnd, "w")
        await sleep(50)
        await this.kb("shift")
        await sleep(50)
        ku(this.hwnd, "w")
        await sleep(800)
    }

    /** @param {KeyEnum[]} keys @param {number} duration */
    async tapTurnKeys(keys, duration = 70) {
        for (const key of keys) kd(this.hwnd, key)
        await sleep(duration)
        for (let i = keys.length - 1; i >= 0; i--) ku(this.hwnd, keys[i])
    }
    /**
     * 转视角
     * @param {number} angle 角度
     */
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
        const key = turnKeyMap[`${angle}`]
        if (!key) return
        await this.tapTurnKeys(key)
        await sleep(16)
        mt(this.hwnd)
        await sleep(300)
        mt(this.hwnd)
        await sleep(400)
    }

    /** @returns {readonly string[]} */
    static get #dslWordKeys() {
        return [
            "lctrl",
            "rctrl",
            "ctrl",
            "lshift",
            "rshift",
            "shift",
            "escape",
            "esc",
            "backspace",
            "space",
            "enter",
            "left",
            "right",
            "up",
            "down",
            "tab",
            "capslock",
            "numlock",
            "scrolllock",
            "printscreen",
            "insert",
            "delete",
            "del",
            "home",
            "end",
            "pageup",
            "pagedown",
            "f1",
            "f2",
            "f3",
            "f4",
            "f5",
            "f6",
            "f7",
            "f8",
            "f9",
            "f10",
            "f11",
            "f12",
            "browser_back",
            "browser_forward",
            "browser_refresh",
            "browser_stop",
            "browser_search",
            "browser_favorites",
            "browser_home",
            "launch_mail",
            "launch_media_select",
            "launch_app1",
            "launch_app2",
            "media_next_track",
            "media_prev_track",
            "media_play_pause",
            "media_stop",
            "volume_mute",
            "volume_down",
            "volume_up",
        ]
    }
    /**
     * @param {string} dsl
     * @returns {DslNode[]}
     */
    #parseDsl(dsl) {
        return new DslParser(dsl, Cap.#dslWordKeys).parse()
    }
    /**
     * @returns {number}
     */
    #beginPlay() {
        this.#playToken++
        return this.#playToken
    }
    /**
     * @param {number} token
     * @returns {void}
     */
    #assertPlayActive(token) {
        if (token !== this.#playToken) throw new PlayInterruptedError()
    }
    /**
     * @param {number} ms
     * @param {number} token
     * @returns {Promise<void>}
     */
    async #sleepInterruptible(ms, token) {
        const timer = new Timer()
        while (true) {
            this.#assertPlayActive(token)
            const remaining = ms - timer.elapsed()
            if (remaining <= 0) break
            await timer.sleep(Math.min(remaining, 50))
        }
        this.#assertPlayActive(token)
    }
    /**
     * @param {DslNode[]} nodes
     * @param {number} token
     * @returns {Promise<void>}
     */
    async #runDslNodes(nodes, token) {
        for (const node of nodes) {
            this.#assertPlayActive(token)
            switch (node.type) {
                case "wait":
                    await this.#sleepInterruptible(node.ms, token)
                    break
                case "key":
                    if (node.duration == null || node.duration <= 0) {
                        await this.kb(node.key)
                    } else {
                        kd(this.hwnd, node.key)
                        try {
                            await this.#sleepInterruptible(node.duration, token)
                        } finally {
                            ku(this.hwnd, node.key)
                        }
                    }
                    break
                case "mouse":
                    if (node.button === "middle") {
                        this.mt(node.x, node.y)
                        if (node.waitMs > 0) await this.#sleepInterruptible(node.waitMs, token)
                        break
                    }
                    this.md(node.x, node.y, node.button === "right" ? "right" : undefined)
                    try {
                        if (node.waitMs > 0) await this.#sleepInterruptible(node.waitMs, token)
                    } finally {
                        this.mu(node.x, node.y, node.button === "right" ? "right" : undefined)
                    }
                    break
                case "group":
                    await this.#runDslNodes(node.body, token)
                    break
                case "loop":
                    if (node.count === 0) {
                        while (true) {
                            this.#assertPlayActive(token)
                            await this.#runDslNodes(node.body, token)
                        }
                    } else {
                        for (let i = 0; i < node.count; i++) {
                            this.#assertPlayActive(token)
                            await this.#runDslNodes(node.body, token)
                        }
                    }
                    break
                default:
                    throw new Error("unknown dsl node")
            }
        }
    }
}
class PlayInterruptedError extends Error {
    constructor() {
        super("play interrupted")
        this.name = "PlayInterruptedError"
    }
}
/** @typedef {KeyEnum | "lctrl" | "rctrl" | "lshift" | "rshift"} DslKey */
/**
 * @typedef {Object} DslWaitNode
 * @property {"wait"} type
 * @property {number} ms
 *
 * @typedef {Object} DslKeyNode
 * @property {"key"} type
 * @property {DslKey} key
 * @property {number | undefined} duration
 *
 * @typedef {Object} DslMouseNode
 * @property {"mouse"} type
 * @property {"left" | "right" | "middle"} button
 * @property {number | undefined} x
 * @property {number | undefined} y
 * @property {number} waitMs
 *
 * @typedef {Object} DslGroupNode
 * @property {"group"} type
 * @property {DslNode[]} body
 *
 * @typedef {Object} DslLoopNode
 * @property {"loop"} type
 * @property {number} count
 * @property {DslNode[]} body
 *
 * @typedef {DslWaitNode | DslKeyNode | DslMouseNode | DslGroupNode | DslLoopNode} DslNode
 */

const c = new Cap()

class DslParser {
    /**
     * @param {string} dsl
     * @param {readonly string[]} wordKeys
     */
    constructor(dsl, wordKeys) {
        /** @type {string} */
        this.src = dsl
        /** @type {readonly string[]} */
        this.wordKeys = wordKeys
        /** @type {number} */
        this.i = 0
    }
    /** @returns {boolean} */
    eof() {
        return this.i >= this.src.length
    }
    /** @returns {string | undefined} */
    peek() {
        return this.src[this.i]
    }
    skipWs() {
        while (!this.eof()) {
            const ch = this.peek()
            if (ch == null || !/\s/.test(ch)) break
            this.i++
        }
    }
    /** @param {string} message @returns {never} */
    error(message) {
        throw new Error(`${message} @${this.i}`)
    }
    /** @param {{integer?: boolean}} [options] @returns {number | null} */
    readNumber(options) {
        const integer = options?.integer ?? false
        this.skipWs()
        const start = this.i
        while (!this.eof()) {
            const ch = this.peek()
            if (ch == null || !/[0-9]/.test(ch)) break
            this.i++
        }
        if (!integer && !this.eof()) {
            const dot = this.peek()
            if (dot === ".") {
                this.i++
                while (!this.eof()) {
                    const ch = this.peek()
                    if (ch == null || !/[0-9]/.test(ch)) break
                    this.i++
                }
            }
        }
        if (this.i === start) return null
        const value = Number(this.src.slice(start, this.i))
        if (!Number.isFinite(value)) this.error("invalid number")
        return value
    }
    /** @returns {DslNode[]} */
    parse() {
        const nodes = this.parseSequence()
        this.skipWs()
        if (!this.eof()) this.error(`unexpected token: ${this.peek()}`)
        return nodes
    }
    /** @param {string} [stopChar] @returns {DslNode[]} */
    parseSequence(stopChar = undefined) {
        /** @type {DslNode[]} */
        const nodes = []
        while (!this.eof()) {
            this.skipWs()
            if (stopChar && this.peek() === stopChar) {
                this.i++
                break
            }
            if (this.eof()) break
            const node = this.parseNode()
            if (node) nodes.push(node)
        }
        return nodes
    }
    /** @returns {DslNode | null} */
    parseNode() {
        this.skipWs()
        if (this.eof()) return null

        const ch = this.peek()
        if (ch == null) return null
        if (ch === "#") return this.parseWait()
        if (ch === "+") return this.parseLoop()
        if (ch === "(") return this.parseGroup()
        if (ch === "M" || ch === "R" || ch === "T") return this.parseMouse()
        return this.parseKey()
    }
    /** @returns {DslWaitNode} */
    parseWait() {
        this.i++
        const seconds = this.readNumber()
        if (seconds == null) this.error("missing wait duration")
        return { type: "wait", ms: Math.round(seconds * 1000) }
    }
    /** @returns {DslLoopNode} */
    parseLoop() {
        this.i++
        const count = this.readNumber({ integer: true })
        if (count == null) this.error("missing loop count")
        this.skipWs()
        if (this.eof()) this.error("missing loop body")
        /** @type {DslNode[]} */
        const body = this.peek() === "(" ? this.parseGroup().body : /** @type {DslNode[]} */ ([this.parseNode()].filter(Boolean))
        if (!body.length) this.error("missing loop body")
        return { type: "loop", count, body }
    }
    /** @returns {DslGroupNode} */
    parseGroup() {
        if (this.peek() !== "(") this.error("missing group open")
        this.i++
        return { type: "group", body: this.parseSequence(")") }
    }
    /** @returns {DslMouseNode} */
    parseMouse() {
        const buttonChar = this.peek()
        if (buttonChar !== "M" && buttonChar !== "R" && buttonChar !== "T") this.error("invalid mouse token")
        this.i++
        this.skipWs()
        /** @type {number | undefined} */
        let x
        /** @type {number | undefined} */
        let y
        if (this.peek() === "(") {
            this.i++
            const parsedX = this.readNumber({ integer: true })
            if (parsedX == null) this.error("missing mouse x")
            this.skipWs()
            if (this.peek() !== ",") this.error("missing mouse separator")
            this.i++
            const parsedY = this.readNumber({ integer: true })
            if (parsedY == null) this.error("missing mouse y")
            this.skipWs()
            if (this.peek() !== ")") this.error("missing mouse close")
            this.i++
            x = parsedX
            y = parsedY
        }
        const waitMs = this.readNumber()
        return {
            type: "mouse",
            button: buttonChar === "R" ? "right" : buttonChar === "T" ? "middle" : "left",
            x,
            y,
            waitMs: waitMs == null ? 0 : Math.round(waitMs * 1000),
        }
    }
    /** @returns {DslKeyNode} */
    parseKey() {
        const key = this.readKeyToken()
        if (!key) this.error(`unexpected token: ${this.peek() ?? "EOF"}`)
        const duration = this.readNumber()
        return {
            type: "key",
            key,
            duration: duration == null ? undefined : Math.round(duration * 1000),
        }
    }
    /** @returns {DslKey | null} */
    readKeyToken() {
        this.skipWs()
        if (this.eof()) return null

        const ch = this.peek()
        if (ch == null) return null
        if (ch === '"' || ch === "'") {
            const quote = ch
            this.i++
            const end = this.src.indexOf(quote, this.i)
            if (end < 0) this.error("missing closing quote")
            const raw = this.src.slice(this.i, end)
            this.i = end + 1
            if (raw.length === 1 && /[a-z0-9]/i.test(raw)) return /** @type {DslKey} */ (raw.toLowerCase())
            if (this.wordKeys.includes(raw)) return /** @type {DslKey} */ (raw)
            this.error(`unsupported quoted key: ${raw}`)
        }

        if (ch === ">") {
            this.i++
            return "lshift"
        }

        if (ch === "C") {
            this.i++
            return "lctrl"
        }

        for (const key of this.wordKeys) {
            if (this.src.startsWith(key, this.i)) {
                this.i += key.length
                return /** @type {DslKey} */ (key)
            }
        }

        if (/[a-z0-9]/i.test(ch)) {
            this.i++
            return /** @type {DslKey} */ (ch.toLowerCase())
        }

        return null
    }
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
        if (cc(frame, 44, 273, 0xffffc8, 10)) {
            if (cc(frame, 45, 24, 0xffffff, 10)) {
                return "yp"
            }
        } else {
            if (cc(frame, 24, 23, 0xffffce, 10)) {
                if (cc(frame, 1407, 871, 0x000000, 10)) {
                    return "esc_menu"
                } else {
                    return "enter"
                }
            } else {
                if (cc(frame, 364, 289, 0x000000, 10)) {
                    if (cc(frame, 473, 287, 0x000000, 10)) {
                        return "wave"
                    } else {
                        return "book"
                    }
                } else {
                    if (cc(frame, 473, 287, 0x000000, 10)) {
                        return "book"
                    } else {
                        if (cc(frame, 1115, 376, 0xce9997, 10)) {
                            return "confirm"
                        } else {
                            if (cc(frame, 1161, 816, 0xfefefe, 10)) {
                                return "esc"
                            } else {
                                if (cc(frame, 1043, 795, 0xe1b454, 10)) {
                                    return "r"
                                } else {
                                    if (cc(frame, 49, 278, 0xf1454e, 10)) {
                                        return "rp"
                                    } else {
                                        if (cc(frame, 45, 24, 0xffffff, 10)) {
                                            return "rp"
                                        }
                                    }
                                }
                            }
                        }
                    }
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
    async next() {
        const lastState = this.state
        await this.waitUntil()
        switch (this.state) {
            case "unknown":
                c.mc(757, 733)
                break
            case "r":
                await c.kb("r")
                break
            case "book":
                await this.selectBoost(config.book)
                break
            case "enter":
                c.mc(1357, 810)
                break
            case "yp":
                await this.route.start()
                break
            case "confirm":
                c.mc(949, 508)
                await sleep(1000)
                break
            case "esc":
                c.mc(1476, 819)
                break
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
        await mainState.route.moveLoop()
        return
    }
    while (true) {
        await mainState.next()
    }
}
main()
