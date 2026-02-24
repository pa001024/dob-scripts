// ==UserScript==
// @id minimap_stitch_realtime
// @name 小地图实时拼接
// @description 实时抓取小地图并使用 SIFT 拼接为大图
// @author codex
// @version 1.0.0
// @category 视觉
// ==/UserScript==

/**
 * 解析 `x,y,w,h` 形式的 ROI 字符串。
 *
 * @param {string} text ROI 字符串
 * @returns {{x:number,y:number,w:number,h:number}} 解析后的 ROI
 */
function parseRoi(text) {
    const parts = String(text)
        .split(",")
        .map(v => Number(v.trim()))
    if (parts.length !== 4 || parts.some(v => !Number.isFinite(v))) {
        throw new Error(`minimapRoi 配置无效: ${text}`)
    }
    const [x, y, w, h] = parts.map(v => Math.trunc(v))
    if (w <= 0 || h <= 0) {
        throw new Error(`minimapRoi 尺寸必须大于 0: ${text}`)
    }
    return { x, y, w, h }
}

/**
 * 按配置解析目标窗口句柄。
 *
 * @param {string} processName 进程名
 * @param {string} windowTitle 窗口标题（当进程名未命中时作为回退）
 * @returns {number} 窗口句柄（0 表示未找到）
 */
function resolveWindowHandle(processName, windowTitle) {
    let hwnd = 0
    if (processName.trim()) {
        hwnd = getWindowByProcessName(processName.trim())
    }
    if (!hwnd && windowTitle.trim()) {
        hwnd = findWindow(windowTitle.trim())
    }
    return hwnd
}

/**
 * 构建状态文本，便于在控制台/状态栏观察拼接进度。
 *
 * @param {number} frameCount 总帧数
 * @param {number} stitchedCount 成功拼接帧数
 * @param {number} missCount 拼接失败帧数
 * @returns {string} 状态文本
 */
function buildProgressText(frameCount, stitchedCount, missCount) {
    const successRate = frameCount > 0 ? ((stitchedCount / frameCount) * 100).toFixed(1) : "0.0"
    return `frame=${frameCount}, stitched=${stitchedCount}, miss=${missCount}, success=${successRate}%`
}

/**
 * 计算用于预处理锥形遮罩的 heading 角度。
 *
 * 角度坐标约定：
 * - `predictRotation` 输出：0=上、90=右、180=下、270=左
 * - `preprocessMinimapForSift` 需要：0=右、90=下、-90=上
 *
 * 因此默认转换为 `predict - 90`，并支持额外偏移微调。
 *
 * @param {Mat} minimap 小地图原图
 * @param {boolean} usePredict 是否启用旋转预测
 * @param {number} fallbackHeadingDeg 未启用或预测失败时回退角度
 * @param {number} headingOffsetDeg 额外偏移（用于校准）
 * @returns {number} 预处理用 headingDeg
 */
function resolveHeadingDegForPreprocess(minimap, usePredict, fallbackHeadingDeg, headingOffsetDeg) {
    if (!usePredict) {
        return fallbackHeadingDeg + headingOffsetDeg
    }
    try {
        const predicted = predictRotation(minimap)
        if (Number.isFinite(predicted)) {
            return predicted - 90 + headingOffsetDeg
        }
    } catch (_error) {
        // 预测失败时回退固定角度，避免中断主流程。
    }
    return fallbackHeadingDeg + headingOffsetDeg
}

/**
 * 主流程：实时抓取小地图并持续拼接成大图。
 *
 * 说明：
 * - 首帧直接作为初始大图；
 * - 后续帧先做小地图预处理，再进行 SIFT 自动拼接；
 * - 每隔固定帧数落盘一次，防止中断丢进度。
 */
async function main() {
    const processName = readConfig("processName", "目标进程名（优先）", "string", "Client-Win64-Shipping.exe")
    const windowTitle = readConfig("windowTitle", "目标窗口标题（进程名未命中时回退）", "string", "")
    const roiText = readConfig("minimapRoi", "小地图 ROI：x,y,w,h（相对客户区）", "string", "0,0,280,280")
    const outputPath = readConfig("outputPath", "输出大图路径", "string", "./minimap_mosaic.png")
    const captureIntervalMs = readConfig("captureIntervalMs", "采样间隔（毫秒）", "number", 200)
    const saveEveryFrames = readConfig("saveEveryFrames", "每 N 帧保存一次", "number", 10)
    const maxFrames = readConfig("maxFrames", "最大采样帧数（0 表示无限）", "number", 0)
    const minGoodMatches = readConfig("minGoodMatches", "SIFT 最小 good matches", "number", 10)
    const minInliers = readConfig("minInliers", "RANSAC 最小内点数", "number", 8)
    const ransacThreshold = readConfig("ransacThreshold", "RANSAC 重投影阈值（像素）", "number", 3.0)
    const coneAngleDeg = readConfig("coneAngleDeg", "视角高亮锥形角度（度）", "number", 70)
    const usePredictHeading = readConfig("usePredictHeading", "启用旋转预测作为 heading", "boolean", true)
    const headingDeg = readConfig("headingDeg", "预测失败时回退视角角度（默认 -90 朝上）", "number", -90)
    const headingOffsetDeg = readConfig("headingOffsetDeg", "heading 角度偏移校准", "number", 0)
    const dryRun = readConfig("dryRun", "仅检查配置后退出", "boolean", false)

    if (dryRun) {
        console.log("[stitch] dryRun=true，配置检查完成。")
        setStatus("小地图拼接", "dryRun=true，未启动采样。")
        return
    }

    const roi = parseRoi(roiText)
    const centerX = readConfig("centerX", "小地图圆心 X（ROI 内坐标）", "number", Math.trunc(roi.w / 2))
    const centerY = readConfig("centerY", "小地图圆心 Y（ROI 内坐标）", "number", Math.trunc(roi.h / 2))
    const radius = readConfig("radius", "小地图半径", "number", Math.trunc(Math.min(roi.w, roi.h) / 2 - 1))
    const innerRadius = readConfig("innerRadius", "中心角色遮罩半径", "number", Math.trunc(Math.max(1, radius * 0.22)))

    const hwnd = resolveWindowHandle(processName, windowTitle)
    if (!hwnd) {
        throw new Error(`未找到目标窗口，请检查 processName/windowTitle。processName=${processName}, windowTitle=${windowTitle}`)
    }

    console.log("[stitch] hwnd=", hwnd, "roi=", roi, "outputPath=", outputPath)
    setStatus("小地图拼接", `已连接窗口 hwnd=${hwnd}`)

    /** @type {Mat | null} */
    let bigMap = null
    let frameCount = 0
    let stitchedCount = 0
    let missCount = 0
    let lastSavedFrame = 0

    while (maxFrames <= 0 || frameCount < maxFrames) {
        const raw = captureWindowWGC(hwnd, roi.x, roi.y, roi.w, roi.h)
        const dynamicHeadingDeg = resolveHeadingDegForPreprocess(raw, usePredictHeading, headingDeg, headingOffsetDeg)
        const patch = preprocessMinimapForSift(raw, centerX, centerY, radius, coneAngleDeg, innerRadius, dynamicHeadingDeg)

        if (!bigMap) {
            bigMap = patch.clone()
            stitchedCount += 1
        } else {
            const stitched = siftStitch(bigMap, patch, minGoodMatches, minInliers, ransacThreshold)
            if (stitched?.image) {
                bigMap = stitched.image
                stitchedCount += 1
            } else {
                missCount += 1
            }
        }

        frameCount += 1
        const progressText = `${buildProgressText(frameCount, stitchedCount, missCount)}, heading=${dynamicHeadingDeg.toFixed(1)}`
        console.log("[stitch]", progressText)
        if (bigMap) {
            setStatus("小地图拼接", bigMap, progressText)
        } else {
            setStatus("小地图拼接", progressText)
        }

        if (bigMap && frameCount - lastSavedFrame >= Math.max(1, Math.trunc(saveEveryFrames))) {
            imwrite(outputPath, bigMap)
            lastSavedFrame = frameCount
            console.log(`[stitch] saved => ${outputPath}`)
        }

        await sleep(Math.max(1, Math.trunc(captureIntervalMs)))
    }

    if (bigMap) {
        imwrite(outputPath, bigMap)
        const finishText = `拼接完成，输出: ${outputPath}, ${buildProgressText(frameCount, stitchedCount, missCount)}`
        console.log("[stitch]", finishText)
        setStatus("小地图拼接", bigMap, finishText)
    } else {
        console.log("[stitch] 未获取到有效帧。")
        setStatus("小地图拼接", "未获取到有效帧。")
    }
}

void main().catch(error => {
    const message = String(error?.message ? error.message : error)
    console.error("[stitch] failed:", message)
    setStatus("小地图拼接", `执行失败: ${message}`)
    throw error
})
