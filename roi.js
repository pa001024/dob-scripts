// ==UserScript==
// @id HUqNqe9ziE
// @name roi
// @description 图片切片常用工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/4/9 20:37:19
// ==/UserScript==

const file = readConfig("file", "", "string", "")
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

initOcr()
const pre = readConfig("预处理", "预处理方法和参数", ["不处理", "滤色"], "不处理")
const color = readConfig("颜色", "滤色颜色", "string", "0xffffff")
async function main() {
    const frame = file ? imread(file) : c.cap()
    if (file) console.log(file)
    const result = await selectroi("roi", frame)
    if (!result) return
    let roi = frame.roi(...result)
    console.log(result)
    if (pre === "滤色") roi = colorFilter(roi, [+color], 30)
    const phash = perceptualHash(roi)
    setStatus("roi", roi, `frame.roi(${result.join(",")})`)
    setStatus("phash", phash)
    const chars = segmentChars(roi).map(v => roi.roi(...v))
    setStatus("chars", chars, chars.map(v => perceptualHash(v)).join("\n"))
    // setStatus("ocr", ocrText(roi))
}

main()
