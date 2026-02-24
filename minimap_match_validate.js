// ==UserScript==
// @id minimap_match_validate
// @name 小地图匹配验证
// @description 输入小地图截图并在拼接大图中执行 SIFT 匹配
// @author codex
// @version 1.0.0
// @category 视觉
// ==/UserScript==

/**
 * 解析命中的结果文本。
 *
 * @param {{bbox:number[],goodMatches:number,inliers:number}} result siftLocate 返回对象
 * @returns {string} 可读文本
 */
function formatLocateResult(result) {
    const [x, y, w, h] = result.bbox
    return `bbox=(${x.toFixed(1)}, ${y.toFixed(1)}, ${w.toFixed(1)}, ${h.toFixed(1)}), good=${result.goodMatches}, inliers=${result.inliers}`
}

/**
 * 计算用于预处理锥形遮罩的 heading 角度。
 *
 * 角度坐标约定：
 * - `predictRotation` 输出：0=上、90=右、180=下、270=左
 * - `preprocessMinimapForSift` 需要：0=右、90=下、-90=上
 *
 * 默认转换：`predict - 90`，并支持可调偏移量。
 *
 * @param {Mat} minimap 小地图图像
 * @param {boolean} usePredict 是否启用旋转预测
 * @param {number} fallbackHeadingDeg 回退角度
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
        // 预测失败时回退固定角度，避免阻断验证流程。
    }
    return fallbackHeadingDeg + headingOffsetDeg
}

/**
 * 主流程：读取大图和查询小图，预处理后做 SIFT 定位。
 */
function main() {
    const bigMapPath = readConfig("bigMapPath", "拼接大图路径", "string", "./minimap_mosaic.png")
    const queryPath = readConfig("queryPath", "待匹配小地图截图路径", "string", "./minimap_query.png")
    const debugOutputPath = readConfig("debugOutputPath", "命中可视化输出路径（空字符串表示不输出）", "string", "./minimap_match_debug.png")
    const minGoodMatches = readConfig("minGoodMatches", "SIFT 最小 good matches（仅提示）", "number", 10)
    const minInliers = readConfig("minInliers", "SIFT 最小内点数（仅提示）", "number", 8)
    const coneAngleDeg = readConfig("coneAngleDeg", "视角高亮锥形角度（度）", "number", 70)
    const usePredictHeading = readConfig("usePredictHeading", "启用旋转预测作为 heading", "boolean", true)
    const headingDeg = readConfig("headingDeg", "预测失败时回退视角角度（默认 -90 朝上）", "number", -90)
    const headingOffsetDeg = readConfig("headingOffsetDeg", "heading 角度偏移校准", "number", 0)
    const dryRun = readConfig("dryRun", "仅检查配置后退出", "boolean", false)

    if (dryRun) {
        console.log("[validate] dryRun=true，配置检查完成。")
        setStatus("小地图验证", "dryRun=true，未执行匹配。")
        return
    }

    const bigMap = imread(bigMapPath)
    const queryRaw = imread(queryPath)
    const centerX = readConfig("centerX", "查询图圆心 X（ROI 内坐标）", "number", Math.trunc(queryRaw.cols() / 2))
    const centerY = readConfig("centerY", "查询图圆心 Y（ROI 内坐标）", "number", Math.trunc(queryRaw.rows() / 2))
    const radius = readConfig("radius", "查询图小地图半径", "number", Math.trunc(Math.min(queryRaw.cols(), queryRaw.rows()) / 2 - 1))
    const innerRadius = readConfig("innerRadius", "中心角色遮罩半径", "number", Math.trunc(Math.max(1, radius * 0.22)))
    const dynamicHeadingDeg = resolveHeadingDegForPreprocess(queryRaw, usePredictHeading, headingDeg, headingOffsetDeg)
    const query = preprocessMinimapForSift(queryRaw, centerX, centerY, radius, coneAngleDeg, innerRadius, dynamicHeadingDeg)

    const locate = siftLocate(bigMap, query)
    if (!locate) {
        const message = `未匹配到结果（建议调低阈值或补充大图覆盖区域）。参考阈值 good>=${minGoodMatches}, inliers>=${minInliers}`
        console.log("[validate]", message)
        setStatus("小地图验证", message)
        return
    }

    const detail = `${formatLocateResult(locate)}, heading=${dynamicHeadingDeg.toFixed(1)}`
    console.log("[validate] matched:", detail)

    const debugImage = drawContours(bigMap, [locate], 0xff5533, 2)
    const normalizedDebugPath = String(debugOutputPath || "").trim()
    if (normalizedDebugPath) {
        imwrite(normalizedDebugPath, debugImage)
        console.log(`[validate] debug image saved => ${normalizedDebugPath}`)
    }

    setStatus("小地图验证", debugImage, detail)
}

try {
    main()
} catch (error) {
    const message = String(error?.message ? error.message : error)
    console.error("[validate] failed:", message)
    setStatus("小地图验证", `执行失败: ${message}`)
    throw error
}
