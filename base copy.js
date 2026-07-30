// ==UserScript==
// @id UF9ucfc_L-
// @name base
// @description 基础框架 下载后将id改为-再右键发布
// @author pa
// @version 1.0.0
// @category 活动
// @date 2026/06/02 17:17
// ==/UserScript==

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
    /** @param {number | undefined} [x] @param {number | undefined} [y] @param {"left" | "right" | "middle"} [btn]  */
    mc(x, y, btn) {
        return mc(this.hwnd, x, y == null ? undefined : y + this.yof, btn)
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
     * @param {DslNode[]} nodes
     * @param {number} token
     * @returns {Promise<void>}
     */
    async #runDslNodes(nodes, token) {
        for (const node of nodes) {
            // console.log(node)
            this.#assertPlayActive(token)
            switch (node.type) {
                case "wait":
                    await sleep(node.ms)
                    break
                case "key":
                    if (node.duration == null || node.duration <= 0) {
                        await this.kb(node.key)
                    } else {
                        await this.kb(node.key, node.duration)
                    }
                    break
                case "mouse":
                    if (node.button === "middle") {
                        this.mt(node.x, node.y)
                        if (node.waitMs > 0) await sleep(node.waitMs)
                        break
                    }
                    this.md(node.x, node.y, node.button === "right" ? "right" : undefined)
                    try {
                        if (node.waitMs > 0) await sleep(node.waitMs)
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
        if (ch === "L" || ch === "R" || ch === "M") return this.parseMouse()
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
        if (buttonChar !== "L" && buttonChar !== "R" && buttonChar !== "M") this.error("invalid mouse token")
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
            button: buttonChar === "R" ? "right" : buttonChar === "M" ? "middle" : "left",
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

        if (ch === "_") {
            this.i++
            return "space"
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
initOcr()
const config = {
    zhukong: readConfig(
        "主控",
        "-",
        [
            //"菲娜",
            "苏乙",
        ],
        "苏乙"
    ),
    marcoi: readConfig("宏", "默认: L", "string", "L"),
    marco2: readConfig("宏2", "默认: #1q#2.4e#0.2_z", "string", "#1q#2.2z"),
    xu: readConfig("续buff", "扶疏", "boolean", false),
    skip: readConfig("跳过结算", "不记录分数", "boolean", false),
}

const gameState = {
    mp: 0,
    state: "unknown",
}

/** @param {Mat} frame */
function checkState(frame) {
    if (cc(frame, 46, 25, 0xffffff, 20)) {
        if (cc(frame, 44, 276, 0xeb3a43, 20) || cc(frame, 45, 273, 0xff4d52, 10) || cc(frame, 48, 277, 0xffffac, 10)) {
            return "battle"
        } else {
            return "move"
        }
    } else {
        if (cc(frame, 576, 791, 0xe1b454, 20)) {
            return "finish"
        } else {
            if (cc(frame, 60, 704, 0x000000, 20)) {
                return "start"
            }
        }
    }
    return "unknown"
}

async function battleLoop() {
    switch (config.zhukong) {
        case "苏乙":
            const timer = new Timer()
            while (gameState.state === "battle") {
                if (cc(c.frame, 1455, 794, 0xf7f7f7, 10)) {
                    if (timer.elapsed() >= 5555 && config.xu) {
                        // console.debug("续buff")
                        await c.play("R0.2+4(e0.2)_s0.3L")
                        timer.reset()
                        continue
                    }
                    await c.play(config.marcoi)
                } else {
                    await c.play(config.marco2)
                    timer.reset()
                }
                await sleep(100)
            }
            break
        case "菲娜":
            for (let i = 0; i < 4; i++) {
                await c.kb("e")
                await sleep(200)
                mc(c.hwnd, "right")
                await sleep(400)
                await c.kb("d", 100)
                mt(c.hwnd)
                await sleep(400)
            }
            break
    }
}

async function move4() {
    await c.kb("4")
    await sleep(600)
    c.mc()
    await sleep(400)
}
async function moveLoop() {
    await sleep(1000)
    mt(c.hwnd)
    switch (config.zhukong) {
        case "苏乙":
            await c.play("q#2.2+4(e#0.8_)zL")
            break
        case "菲娜":
            await move4()
            await move4()
            await move4()
            break
    }
}

let times = 0
let last = new Timer()
let max = 0
/** @param {Mat} frame  */
async function handleFinish(frame, skip = false) {
    if (!skip) {
        let roi = frame.roi(724, 381, 147, 55)
        let text = +ocrText(roi)
        const timer = new Timer()
        while (isNaN(text) || !text) {
            await sleep(300)
            roi = frame.roi(724, 381, 147, 55)
            text = +ocrText(roi)
            if (timer.elapsed() > 3e3) break
        }
        if (text) {
            if (text > max) {
                console.log(`第${++times}次, 新纪录: ${text} 用时: ${Math.ceil(last.elapsed() / 1e3)}s`)
            } else {
                console.log(`第${++times}次, 分数: ${text} 最高: ${max} 用时: ${Math.ceil(last.elapsed() / 1e3)}s`)
            }
            max = Math.max(text, max)
            last.reset()
        }
        c.mc(674, 792)
        await sleep(2000)
    } else {
        console.log(`第${++times}次, 用时: ${Math.ceil(last.elapsed() / 1e3)}s`)
        last.reset()
    }
}
async function main() {
    setInterval(() => {
        gameState.state = checkState(c.cap())
    }, 100)
    await sleep(100)
    while (true) {
        setStatus("state", gameState.state)
        switch (gameState.state) {
            default:
                await c.play("r#0.3_#2")
                break
            case "battle":
                if (!cc(c.frame, 1437, 799, 0xffffff, 10)) {
                    await c.play("#3+4(L0.4#0.3)q#3")
                }
                break
        }
        await sleep(100)
    }
}
main()
