// ==UserScript==
// @id HUqNqe9ziE
// @name roi
// @description 图片切片常用工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/08/01 10:53
// ==/UserScript==

import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))
const file = readConfig("file", "", "string", "")

initOcr()
const pre = readConfig("预处理", "预处理方法和参数", ["不处理", "滤色"], "不处理")
const color = readConfig("颜色", "滤色颜色", "string", "0xffffff")
const p1 = readConfig("滤色容差", "", "number", 30)
async function main() {
    const frame = file ? imread(file) : c.cap()
    if (file) console.log(file)
    const result = await selectroi("roi", frame)
    if (!result) return
    let roi = frame.roi(...result)
    console.log(result)
    if (pre === "滤色") roi = colorFilter(roi, [+color], p1)
    const phash = perceptualHash(roi)
    setStatus("roi", roi, `c.frame.roi(${result.join(",")})`)
    setStatus("phash", phash)
    const chars = segmentChars(roi).map(v => roi.roi(...v))
    setStatus("chars", chars, chars.map(v => perceptualHash(v)).join("\n"))
    console.time("ocr")
    const text = ocrText(roi)
    console.timeEnd("ocr")
    setStatus("ocr", text)
    setStatus("code", `c.croi(c.frame.roi(${result.join(",")}), "${phash}", 10${pre === "滤色" ? `, 1, ${color}, ${p1}` : ""})`)
    c.cap()
    console.time("croi")
    if (pre === "滤色") console.log(c.croi(roi, phash, 10, 1, +color, p1))
    else console.log(c.croi(roi, phash, 10))
    console.timeEnd("croi")
}

main()
