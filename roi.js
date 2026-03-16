// ==UserScript==
// @id HUqNqe9ziE
// @name roi
// @description 图片切片常用工具
// @author pa
// @version 1.0.0
// @category 开发工具
// @date 2026/3/16 00:08:14
// ==/UserScript==

const cloud = readConfig("cloud", "云游戏", "boolean", false)
const hwnd = cloud ? getCGWindow() : getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) {
    throw new Error("未找到窗口或非管理员权限")
}
checkSize(hwnd)

const pre = readConfig("预处理", "预处理方法和参数", ["不处理", "滤色"], "不处理")
const color = readConfig("颜色", "滤色颜色", "string", "0xffffff")
async function main() {
    const frame = captureWindowWGC(hwnd)
    const result = await selectroi("roi", frame)
    if (!result) return
    let roi = frame.roi(...result)
    console.log(result)
    if (pre === "滤色") roi = colorFilter(roi, [+color], 60)
    const phash = perceptualHash(roi)
    setStatus("roi", roi, `frame.roi(${result.join(",")})`)
    setStatus("phash", phash)
    const chars = segmentChars(roi).map(v => roi.roi(...v))
    setStatus("chars", chars, chars.map(v => perceptualHash(v)).join("\n"))
}

main()
