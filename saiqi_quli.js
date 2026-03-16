// ==UserScript==
// @id saiqi_quli
// @name saiqi_quli
// @description 赛琪驱离副本循环脚本
// @author codex
// @version 1.0.0
// @category 其他
// @date 2026/3/16 04:27:58
// ==/UserScript==

/**
 * 调试阶段配置。
 * readConfig 会创建或更新前端配置 UI，只适合给最终用户暴露稳定参数；
 * 当前脚本处于识别与动作迭代期，先使用内联常量，避免调试过程污染脚本配置面板。
 */
const config = {
    cloud: false,
    singleStep: false,
    debugStatus: true,
    userAssistStartBattle: false,
    walkMs: 1200,
    interactDelayMs: 400,
    storyDelayMs: 600,
    loopSleepMs: 300,
    confirmX: 1123,
    confirmY: 688,
    startX: 1318,
    startY: 815,
    centerConfirmX: 942,
    centerConfirmY: 501,
    startBattleX: 965,
    startBattleY: 589,
    markedActionX: 949,
    markedActionY: 243,
    inspectMode: false,
    thumbWidth: 400,
    thumbHeight: 225,
    unknownThumbEvery: 6,
    unknownFullEvery: 12,
    unknownSleepMs: 500,
    debugImageDir: "imgs",
}

const PROCESS_NAME = "EM-Win64-Shipping.exe"
const FRAME_WIDTH = 1600
const FRAME_HEIGHT = 900
const hwnd = config.cloud ? getCGWindow() : getWindowByProcessName(PROCESS_NAME)
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd)
let unknownTick = 0

/**
 * 基于固定 1600x900 坐标系，把原图坐标映射到缩略图坐标。
 * @param {number} x
 * @param {number} y
 */
function mapToThumbPoint(x, y) {
    const tx = Math.max(0, Math.min(config.thumbWidth - 1, Math.round((x * config.thumbWidth) / FRAME_WIDTH)))
    const ty = Math.max(0, Math.min(config.thumbHeight - 1, Math.round((y * config.thumbHeight) / FRAME_HEIGHT)))
    return [tx, ty]
}

/**
 * 生成低成本缩略图，用于初步状态判断和 unknown 诊断。
 * @param {Mat} frame
 */
function buildThumbnail(frame) {
    return frame.resize(config.thumbWidth, config.thumbHeight, "area")
}

/**
 * 在缩略图上按原图坐标做颜色判定。
 * @param {Mat} thumb
 * @param {number} x
 * @param {number} y
 * @param {number} color
 * @param {number} tolerance
 */
function ccThumb(thumb, x, y, color, tolerance) {
    const [tx, ty] = mapToThumbPoint(x, y)
    return cc(thumb, tx, ty, color, tolerance)
}

/**
 * 判断是否处于夜航手册挑战选择页。
 * 这里优先使用固定坐标颜色门限，后续可以继续按 cap 图微调。
 * @param {Mat} frame
 */
function isNightManual(frame) {
    return cc(frame, 65, 118, 0xffffc9, 56) && cc(frame, 871, 677, 0xfaffff, 20) && cc(frame, 51, 28, 0x8a0400, 24)
}

/**
 * 判断是否处于剧情/奇遇文本页。
 * @param {Mat} frame
 */
function isStory(frame) {
    return cc(frame, 1099, 720, 0x111111, 10) && cc(frame, 1239, 719, 0x131313, 10) && cc(frame, 920, 555, 0xf4f0cf, 20)
}

/**
 * 判断是否已进入副本内。
 * 这里不再依赖整套 HUD，只抓左侧“驱离”任务区的红点。
 * @param {Mat} frame
 */
function isDungeon(frame) {
    return cc(frame, 44, 276, 0xeb3a43, 28)
}

/**
 * 判断是否处于结算失败页。
 * @param {Mat} frame
 */
function isFailResult(frame) {
    return cc(frame, 621, 31, 0xf5f1df, 20) && cc(frame, 676, 334, 0xa68658, 20) && cc(frame, 1038, 636, 0xdbd6c5, 20)
}

/**
 * 判断是否处于委托完成/再次进行页。
 * @param {Mat} frame
 */
function isRepeatResult(frame) {
    const classicResult =
        cc(frame, 72, 579, 0xf8ebab, 28) && cc(frame, 985, 579, 0x8a999c, 28) && cc(frame, 882, 678, 0x121516, 16)
    const statOverlayResult =
        cc(frame, 62, 576, 0xd9d69f, 52) && cc(frame, 984, 678, 0x41574e, 28) && cc(frame, 1210, 678, 0x1c3534, 24)
    return classicResult || statOverlayResult
}

/**
 * 判断是否处于“确认选择 / 开始挑战”弹窗。
 * 这一层会遮在副本入口之上，右上角关闭按钮偏粉，左下取消按钮高亮偏白，中部提示条偏深。
 * @param {Mat} frame
 */
function isConfirmSelection(frame) {
    const legacyDialog = cc(frame, 1058, 245, 0xb26c91, 40) && cc(frame, 557, 505, 0xe6e5df, 28) && cc(frame, 675, 470, 0x181918, 18)
    const repeatDialog = cc(frame, 1057, 244, 0x55483c, 28) && cc(frame, 557, 504, 0xdee1e8, 24) && cc(frame, 706, 470, 0x0c0c0c, 12)
    return legacyDialog || repeatDialog
}

/**
 * 判断是否处于人工标注过的当前按钮页。
 * 这一页目前无法靠已有规则命中，因此使用用户在完整图上给出的点位和 ROI 颜色做兜底识别。
 * @param {Mat} frame
 */
function isMarkedActionPage(frame) {
    return (
        cc(frame, config.markedActionX, config.markedActionY, 0x827c71, 24) &&
        cc(frame, 945, 243, 0x2d2b27, 16) &&
        cc(frame, 873, 229, 0x000000, 8) &&
        cc(frame, 1016, 229, 0x000000, 8)
    )
}

/**
 * 基于缩略图做低成本初判。
 * @param {Mat} thumb
 */
function checkStateQuick(thumb) {
    if (
        ccThumb(thumb, 65, 118, 0xffffc9, 64) &&
        ccThumb(thumb, 871, 677, 0xfaffff, 26) &&
        ccThumb(thumb, 51, 28, 0x8a0400, 28)
    )
        return "night_manual"
    if (
        (ccThumb(thumb, 1058, 245, 0xb26c91, 46) &&
            ccThumb(thumb, 557, 505, 0xe6e5df, 34) &&
            ccThumb(thumb, 675, 470, 0x181918, 24)) ||
        (ccThumb(thumb, 1057, 244, 0x55483c, 32) &&
            ccThumb(thumb, 557, 504, 0xdee1e8, 28) &&
            ccThumb(thumb, 706, 470, 0x0c0c0c, 16))
    )
        return "confirm_selection"
    if (
        ccThumb(thumb, 1099, 720, 0x111111, 18) &&
        ccThumb(thumb, 1239, 719, 0x131313, 18) &&
        ccThumb(thumb, 920, 555, 0xf4f0cf, 28)
    )
        return "story"
    if (
        (ccThumb(thumb, 72, 579, 0xf8ebab, 34) &&
            ccThumb(thumb, 985, 579, 0x8a999c, 34) &&
            ccThumb(thumb, 882, 678, 0x121516, 20)) ||
        (ccThumb(thumb, 62, 576, 0xd9d69f, 56) &&
            ccThumb(thumb, 984, 678, 0x41574e, 32) &&
            ccThumb(thumb, 1210, 678, 0x1c3534, 28))
    )
        return "repeat_result"
    if (
        ccThumb(thumb, 621, 31, 0xf5f1df, 28) &&
        ccThumb(thumb, 676, 334, 0xa68658, 28) &&
        ccThumb(thumb, 1038, 636, 0xdbd6c5, 28)
    )
        return "fail_result"
    if (
        ccThumb(thumb, 44, 276, 0xeb3a43, 34)
    )
        return "dungeon"
    return "unknown"
}

/**
 * 基于原图做精确判定。
 * @param {Mat} frame
 */
function checkStateExact(frame) {
    if (isNightManual(frame)) return "night_manual"
    if (isConfirmSelection(frame)) return "confirm_selection"
    if (isMarkedActionPage(frame)) return "marked_action"
    if (isStory(frame)) return "story"
    if (isRepeatResult(frame)) return "repeat_result"
    if (isFailResult(frame)) return "fail_result"
    if (isDungeon(frame)) return "dungeon"
    return "unknown"
}

/**
 * 综合缩略图初判和原图精判，避免 unknown 分支继续上传整帧。
 * @param {Mat} frame
 */
function analyzeState(frame) {
    const thumb = buildThumbnail(frame)
    const quickState = checkStateQuick(thumb)
    const exactState = checkStateExact(frame)
    const state = exactState === "unknown" ? quickState : exactState
    return { state, quickState, exactState, thumb }
}

/**
 * 输出关键取点，便于结合 cap.js 调坐标。
 * @param {Mat} frame
 */
function inspectPoints(frame) {
    const points = [
        ["menu_title_gold", 65, 118],
        ["menu_confirm_highlight", 871, 677],
        ["menu_logo_red", 51, 28],
        ["menu_title", 71, 171],
        ["menu_button_ring", 1123, 688],
        ["story_space_left", 1099, 720],
        ["story_space_right", 1239, 719],
        ["story_arrow", 920, 555],
        ["hud_hp", 46, 742],
        ["hud_skill_e", 1167, 712],
        ["hud_skill_q", 1209, 735],
    ]
    const lines = points.map(([name, x, y]) => {
        const rgb = frame.get_rgb(x, y)
        const hex = rgb === undefined ? "undefined" : `0x${rgb.toString(16).padStart(6, "0")}`
        return `${name}: (${x},${y}) ${hex}`
    })
    setStatus("inspect", lines.join("\n"))
    console.log(lines.join(" | "))
}

/**
 * 输出轻量调试状态。
 * 调试阶段只保留文字状态，避免继续往 status 面板写图片。
 * @param {Mat} frame
 * @param {string} state
 * @param {string} action
 */
function renderDebug(frame, state, action, quickState = state) {
    if (!config.debugStatus) return
    const samplePoints = [
        ["p1", 65, 118],
        ["p2", 871, 677],
        ["p3", 51, 28],
        ["p4", 920, 555],
        ["p5", 46, 742],
    ]
    const samples = samplePoints
        .map(([name, x, y]) => {
            const rgb = frame.get_rgb(x, y)
            const hex = rgb === undefined ? "undefined" : `0x${rgb.toString(16).padStart(6, "0")}`
            return `${name}:${hex}`
        })
        .join(" | ")
    setStatus("state", state)
    setStatus("action", action)
    setStatus("debug", `${state}\nquick:${quickState}\n${action}\n${samples}`)
}

/**
 * 将调试图片写入文件，避免继续把图片塞进 status 面板。
 * @param {string} name
 * @param {Mat} image
 */
function writeDebugImage(name, image) {
    const path = `${config.debugImageDir}/${name}.png`
    imwrite(path, image)
    return path
}

/**
 * 输出低成本 unknown 诊断。
 * 只保留缩略图和小 ROI，避免每轮上传整张 1600x900 原图。
 * @param {Mat} frame
 * @param {Mat} thumb
 * @param {string} action
 * @param {string} quickState
 */
function renderUnknownDiagnostics(frame, thumb, action, quickState) {
    if (!config.debugStatus) return
    unknownTick += 1
    setStatus("unknown_meta", `tick=${unknownTick}\nquick=${quickState}\naction=${action}`)
    if (unknownTick % config.unknownFullEvery === 0) {
        const fullPath = writeDebugImage("saiqi_quli_unknown_full", frame)
        setStatus("unknown_full", `${fullPath}\ntick=${unknownTick}\nquick=${quickState}`)
    }
    if (unknownTick % config.unknownThumbEvery !== 0) return
    const thumbPath = writeDebugImage("saiqi_quli_unknown_thumb", thumb)
    const centerPath = writeDebugImage("saiqi_quli_unknown_center_roi", frame.roi(620, 240, 360, 220))
    const bottomPath = writeDebugImage("saiqi_quli_unknown_bottom_roi", frame.roi(780, 640, 520, 180))
    setStatus("unknown_thumb", `${thumbPath}\ntick=${unknownTick}\nquick=${quickState}`)
    setStatus("unknown_center_roi", `${centerPath}\ntick=${unknownTick}`)
    setStatus("unknown_bottom_roi", `${bottomPath}\ntick=${unknownTick}`)
}

/**
 * 点击夜航手册里的确认选择。
 */
async function clickConfirm() {
    mc(hwnd, config.confirmX, config.confirmY)
    await sleep(900)
    let frame = captureWindowWGC(hwnd)
    if (!isNightManual(frame)) return

    setStatus("night_manual_retry", "primary_confirm_still_visible")
    mc(hwnd, config.startX, config.startY)
    await sleep(900)
    frame = captureWindowWGC(hwnd)
    if (!isNightManual(frame)) return

    setStatus("night_manual_retry", "start_button_still_visible")
    mc(hwnd, config.centerConfirmX, config.centerConfirmY)
    await sleep(900)
}

/**
 * 点击弹窗右下角“开始挑战”。
 */
async function startBattle() {
    setStatus("confirm_click_plan", `(${config.startBattleX},${config.startBattleY})`)
    setStatus("confirm_click_step", `1/1 (${config.startBattleX},${config.startBattleY})`)
    mc(hwnd, config.startBattleX, config.startBattleY)
    await sleep(700)

    let frame = captureWindowWGC(hwnd)
    let { state, quickState, thumb } = analyzeState(frame)
    setStatus("confirm_click_probe", `${quickState} -> ${state}`)
    if (state !== "confirm_selection" && state !== "unknown") {
        setStatus("confirm_click_result", "dismissed_after_1")
        await sleep(1200)
        return
    }

    if (state === "unknown") {
        const firstProbePath = writeDebugImage("saiqi_quli_confirm_transition_thumb", thumb)
        setStatus("confirm_transition_thumb", `${firstProbePath}\nafter_exact_point_first_probe`)
        await sleep(500)
        frame = captureWindowWGC(hwnd)
        ;({ state, quickState, thumb } = analyzeState(frame))
        setStatus("confirm_click_probe", `unknown_retry ${quickState} -> ${state}`)
        if (state === "unknown") {
            const retryProbePath = writeDebugImage("saiqi_quli_confirm_transition_retry_thumb", thumb)
            setStatus("confirm_transition_retry_thumb", `${retryProbePath}\nafter_exact_point_retry_probe`)
        }
        if (state !== "confirm_selection" && state !== "unknown") {
            setStatus("confirm_click_result", "dismissed_after_1")
            await sleep(1200)
            return
        }
    }

    setStatus("confirm_click_result", "still_visible_after_exact_point_retry_same_spot")
    setStatus("confirm_click_step", `retry (${config.startBattleX},${config.startBattleY})`)
    mc(hwnd, config.startBattleX, config.startBattleY)
    await sleep(1200)
}

/**
 * 点击人工标注得到的当前按钮。
 */
async function clickMarkedAction() {
    setStatus("marked_action_click", `(${config.markedActionX},${config.markedActionY})`)
    mc(hwnd, config.markedActionX, config.markedActionY)
    await sleep(900)
}

/**
 * 开始挑战弹窗改为用户协助点击。
 * 脚本只负责识别并提示，避免继续在错误点位上反复误触。
 */
async function waitForUserStartBattle() {
    setStatus("confirm_assist", "检测到开始挑战弹窗，请手动点击“开始挑战”按钮")
    setStatus("confirm_click_plan", "user_assisted")
    setStatus("confirm_click_step", "waiting_user_click")
    setStatus("confirm_click_probe", "pending_user_action")
    setStatus("confirm_click_result", "manual_click_required")
    await sleep(1000)
}

/**
 * 推进剧情页。
 */
async function continueStory() {
    await kb(hwnd, "space", 40)
    await sleep(config.storyDelayMs)
}

/**
 * 副本内执行最小动作。
 * 先尝试交互，再向前走一步，适合当前“篝火在正前方”的实战状态。
 */
async function actInDungeon() {
    await kb(hwnd, "f", 33)
    await sleep(config.interactDelayMs)
    await kb(hwnd, "w", config.walkMs)
    await sleep(200)
}

/**
 * 结算失败页先尝试空格继续。
 */
async function continueFailResult() {
    await kb(hwnd, "space", 40)
    await sleep(800)
}

/**
 * 委托完成页使用热键再次进行，直接回到下一轮。
 */
async function repeatDungeon() {
    await kb(hwnd, "r", 40)
    await sleep(1000)
}

/**
 * 单轮识别并执行一个动作。
 */
async function tick() {
    const frame = captureWindowWGC(hwnd)
    if (config.inspectMode) {
        inspectPoints(frame)
        return
    }
    const { state, quickState, thumb } = analyzeState(frame)
    let action = "noop"
    switch (state) {
        case "night_manual":
            action = "click_confirm"
            renderDebug(frame, state, action, quickState)
            console.log(`[saiqi_quli] ${state} -> ${action}`)
            await clickConfirm()
            return
        case "confirm_selection":
            action = config.userAssistStartBattle ? "wait_user_start_battle" : "click_start_battle"
            renderDebug(frame, state, action, quickState)
            console.log(`[saiqi_quli] ${state} -> ${action}`)
            if (config.userAssistStartBattle) {
                await waitForUserStartBattle()
            } else {
                await startBattle()
            }
            return
        case "marked_action":
            action = "click_marked_action"
            renderDebug(frame, state, action, quickState)
            console.log(`[saiqi_quli] ${state} -> ${action}`)
            await clickMarkedAction()
            return
        case "story":
            action = "press_space"
            renderDebug(frame, state, action, quickState)
            console.log(`[saiqi_quli] ${state} -> ${action}`)
            await continueStory()
            return
        case "fail_result":
            action = "continue_fail"
            renderDebug(frame, state, action, quickState)
            console.log(`[saiqi_quli] ${state} -> ${action}`)
            await continueFailResult()
            return
        case "repeat_result":
            action = "press_r_repeat"
            renderDebug(frame, state, action, quickState)
            console.log(`[saiqi_quli] ${state} -> ${action}`)
            await repeatDungeon()
            return
        case "dungeon":
            action = "press_f_then_walk"
            renderDebug(frame, state, action, quickState)
            console.log(`[saiqi_quli] ${state} -> ${action}`)
            await actInDungeon()
            return
        default:
            action = "unknown_wait"
            renderDebug(frame, state, action, quickState)
            renderUnknownDiagnostics(frame, thumb, action, quickState)
            console.log(`[saiqi_quli] ${state} -> ${action}`)
            await sleep(config.unknownSleepMs)
    }
}

/**
 * 主循环。
 */
async function main() {
    if (config.singleStep) {
        await tick()
        return
    }
    while (true) {
        await tick()
        await sleep(config.loopSleepMs)
    }
}

main()
