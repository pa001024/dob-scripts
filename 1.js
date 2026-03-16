// ==UserScript==
// @id -
// @name 1
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/3/6 03:27:32
// ==/UserScript==
const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")

const config = {
    门顺序: readConfig(
        "门顺序",
        "设置门颜色优先顺序，按从高到低优先级选择",
        {
            type: "multi-select",
            options: ["黄", "蓝", "大红", "小红"],
        },
        ["黄", "蓝", "大红", "小红"]
    ),
    useQ1: readConfig("搓BUFF", "Boss阶段是否释放Q1（6命别选）", "boolean", false),
    useTripleDoorBuffer: readConfig("三重缓冲", "一定程度上降低找门抖动", "boolean", true),
    moveTimeout: readConfig("移动超时", "移动超时重置间隔(秒)", "number", 25),
    ftime: readConfig("帧间隔", "取帧间隔(毫秒)", "number", 25),
    lock: readConfig("密码", "请查看说明以获取密码", "string"),
    debug: readConfig("debug", "-", "boolean", false),
    /** @type {ROI} */ minimapLoc: [30, 35, 180, 180],
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
}
/**
 * 找颜色
 * @param {Mat} img 窗口截图
 * @param {number[]} colors 颜色数组
 * @param {string[]} names 颜色名称数组
 */
function findColors(img, colors, names, threshold = 10, mode = "single") {
    // x: 290~1312 y: 168~681
    const xOffset = config.mainLoc[0]
    const yOffset = config.mainLoc[1]
    const roi = img.roi(...config.mainLoc)
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
                // angle: degTo360(deg + 90),
                distance,
                out: distance > 420,
            }
        }
    }
}

/**
 * 找门
 * @param {Mat} img 窗口截图
 */
function findDoor(img) {
    // 滤色 : #EB3A43 #FFD772 #868DFF
    return findColors(img, [0xeb3a43, 0xffd772, 0x868dff], ["红", "黄", "蓝"])
}
let frame = imread("imgs/cap92.png")
let autoAimX = true
let autoAimY = true
async function main() {
    const ftimer = setInterval(() => {
        frame = captureWindowWGC(hwnd)
        if (autoAimX || autoAimY) {
            const rawDoor = findDoor(frame)
            const door = rawDoor
        }
    }, config.ftime)
    console.time("1")
    async function a1() {
        await sleep(1000)
    }
    await a1()
    console.timeEnd("1")
    console.log(JSON.stringify(door))
    clearInterval(ftimer)
}
main()
