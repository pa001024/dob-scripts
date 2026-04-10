// ==UserScript==
// @id 4PvTpU_n-H
// @name autoshengming
// @description 声名惠赠自动提交与刷新 1.3
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/2/23 16:01:47
// ==/UserScript==

// 说明: 进"惠赠"页面开启
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
        this.frame = this.frameless ? captureWindowWGC(this.hwnd) : captureWindowWGC(this.hwnd).roi(0, 30, 1600, 900)
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
}
const c = new Cap()
/** @typedef {[number, number]} Point */
/** @typedef {{name: string; hash: string}} ItemHash */
/** @typedef {{rois: Mat[]; hashes: string[]; slotPass: boolean[]; cardPass: boolean[]; colorGate: boolean[]; cardReady: boolean[]}} AnalyzeResult */

const SINGLE_CAPTURE_MODE = false
const X_START = 202
const X_OFFSET_CELL = 70
const ROI_Y = 596
const ROI_W = 50
const ROI_H = 32
const COL_COUNT = 4
const X_OFFSET_COL_FLOAT = 1036 / (COL_COUNT - 1)

/** @type {ROI[]} */
const MATERIAL_ROIS = Array.from({ length: COL_COUNT }, (_, col) => X_START + Math.round(col * X_OFFSET_COL_FLOAT)).flatMap(baseX => [
    [baseX, ROI_Y, ROI_W, ROI_H],
    [baseX + X_OFFSET_CELL, ROI_Y, ROI_W, ROI_H],
])

/** @type {Point[]} */
const SUBMIT_POINTS = Array.from({ length: COL_COUNT }, (_, col) => [342 + Math.round(col * X_OFFSET_COL_FLOAT), 691])

/** @type {ItemHash[]} */
const ITEM_HASHES = [
    { hash: "9f6783e4f11c0e82", name: "秽兽甲壳" },
    { hash: "b8a712b64a35e89c", name: "锁链" },
    { hash: "b8a752364c33cc9c", name: "锁链" },
    { hash: "7603f66b9cdc6202", name: "军团铭牌" },
    { hash: "6731e60b9cfc0632", name: "军团铭牌" },
    { hash: "78e36c837836629c", name: "秽兽凝脂" },
    { hash: "868c6c792634daf8", name: "朱红泪滴" },
    { hash: "d23c63780674dab8", name: "朱红泪滴" },
    { hash: "2cb6e313d86616d8", name: "待雪鸟尾羽" },
    { hash: "69d66c92489ce2e6", name: "载具装甲" },
    { hash: "c6633c4c83bcd8a6", name: "流体合金" },
    { hash: "96669bd966966098", name: "隔热涂层" },
    { hash: "39e6260ee856aab4", name: "净化的水" },
    { hash: "19ec7127c49c6e32", name: "通讯手册" },
    { hash: "f32cc35c25d22cd2", name: "石料粉末" },
    { hash: "72f1b47c9c23069c", name: "破损的嗅盐" },
    { hash: "639c363c98274e9c", name: "破损的嗅盐" },
    { hash: "9bb873e70c1cd224", name: "燃料试剂" },
    { hash: "ec0eb01b78fc86c2", name: "祝文卷轴" },
    { hash: "dc338e1ee31c609c", name: "信号线缆" },
    { hash: "3f9c1c8caacc6632", name: "圣像石骸" },
    { hash: "23a6c8f9721ccaa6", name: "金属护甲" },
    { hash: "98b8ccdcfcfc0282", name: "赐福饰物" },
]

const itemOptions = Array.from(new Set(ITEM_HASHES.map(v => v.name)))
let selectedItems = readConfig("物品", "允许提交的物品", { type: "multi-select", options: itemOptions }, itemOptions)
if (selectedItems.length === 0) {
    selectedItems = itemOptions
    setConfig("物品", selectedItems)
}
const selectedSet = new Set(selectedItems)
const allowHashes = ITEM_HASHES.filter(v => selectedSet.has(v.name)).map(v => v.hash)

const hashDistance = 12
const colorHash = false
const offsetX = 0
const offsetY = 0
const submitDelayMs = readConfig("提交等待ms", "点击提交后的等待时长", "number", 600)
const refreshDelayMs = readConfig("刷新等待ms", "点击刷新后的等待时长", "number", 1000)
const refreshMaxTimes = readConfig("最大刷新次数", "-1 表示不限", "number", -1)
const timeoutSec = readConfig("超时秒", "<=0 表示不限", "number", 300)
const checkReputationCap = readConfig("检测声名上限", "numocr 检测 x/y 是否满", "boolean", true)
const debugStatus = readConfig("调试状态", "显示 ROI 与哈希调试信息", "boolean", true)

/** @param {ROI} roi @returns {ROI} */
function withOffsetRoi(roi) {
    return [roi[0] + offsetX, roi[1] + offsetY, roi[2], roi[3]]
}

/** @param {Point} point @returns {Point} */
function withOffsetPoint(point) {
    return [point[0] + offsetX, point[1] + offsetY]
}

/**
 * 轻量数字识别：白色滤色 + segmentChars + pHash
 * @param {Mat} roi
 */
function numocr(roi) {
    const NUM_HASHES = [
        "6b906b42e54ac53e", // 0
        "839393939393936c", // 1
        "1ab1e0693ae73ce0", // 2
        "b6183c69b64bc3c4", // 3
        "306cdbcccf399222", // 4
        "c6c14fc1c43a4f1e", // 5
        "c63ee7493f1838c0", // 6
        "e16dc13dc16c6968", // 7
        "b73ce1493e48e1c4", // 8
        "383a1ae168bac76c", // 9
    ]
    const filtered = colorFilter(roi, [0xcccccc], 30)
    const bboxs = segmentChars(filtered)
    const chars = bboxs.map(v => filtered.roi(...v))
    const hashes = chars.map(v => perceptualHash(v))
    const tokens = hashes.map(v => {
        const idx = matchHammingHash(v, NUM_HASHES, 20)
        return idx >= 0 ? String(idx) : "?"
    })
    if (debugStatus) {
        const detail = hashes.map((v, i) => `${i + 1}: ${tokens[i]} ${v}`).join("\n")
        setStatus("numocr", chars, detail || "未分割到字符")
    }
    return tokens.join("")
}

/** @param {string} hash @returns {boolean} */
function hashMatched(hash) {
    if (allowHashes.length === 0) return false
    return matchHammingHash(hash, allowHashes, hashDistance) >= 0
}

/** @param {number} cardIdx @returns {number} */
function cardOffsetX(cardIdx) {
    return Math.round(cardIdx * X_OFFSET_COL_FLOAT)
}

/** @param {Mat} frame @param {number} cardIdx @returns {boolean} */
function canSubmitByColor(frame, cardIdx) {
    const x = 257 + cardOffsetX(cardIdx) + offsetX
    const y = 253 + offsetY
    return cc(frame, x, y, 0x373633, 10)
}

/** @param {Mat} frame @returns {AnalyzeResult} */
function analyzeMaterials(frame) {
    const rois = MATERIAL_ROIS.map(roi => frame.roi(...withOffsetRoi(roi)))
    const hashes = rois.map(roi => perceptualHash(roi, colorHash))
    const slotPass = hashes.map(hashMatched)
    const cardPass = [0, 1, 2, 3].map(i => slotPass[i * 2] && slotPass[i * 2 + 1])
    const colorGate = [0, 1, 2, 3].map(i => canSubmitByColor(frame, i))
    const cardReady = [0, 1, 2, 3].map(i => cardPass[i] && colorGate[i])
    return { rois, hashes, slotPass, cardPass, colorGate, cardReady }
}

/** @param {AnalyzeResult} analysis @returns {void} */
function renderMaterialStatus(analysis) {
    if (!debugStatus) return
    const lines = []
    for (let i = 0; i < 8; i++) {
        lines.push(`槽${i + 1}: ${analysis.slotPass[i] ? "OK" : "NG"} ${analysis.hashes[i]}`)
    }
    for (let i = 0; i < 4; i++) {
        const status = analysis.cardReady[i] ? "可提交" : analysis.cardPass[i] ? "不可用" : "不可提交"
        lines.push(`卡${i + 1}: ${status}`)
    }
    setStatus(
        "声名材料",
        analysis.rois.map(v => v.clone()),
        lines.join("\n")
    )
}

/** @param {Mat} frame @returns {boolean} */
function isReputationCapped(frame) {
    if (!checkReputationCap) return false
    const roi = frame.roi(...withOffsetRoi([1283, 181, 85, 21]))
    const currentText = numocr(roi)
    return currentText === "15001500"
}

/** @param {number} idx @returns {Promise<void>} */
async function clickSubmit(idx) {
    const p = withOffsetPoint(SUBMIT_POINTS[idx])
    c.mc(p[0], p[1])
    await sleep(submitDelayMs)
}

async function clickRefresh() {
    const p = withOffsetPoint([1324, 770])
    c.mc(p[0], p[1])
    await sleep(refreshDelayMs)
}

async function main() {
    const timer = new Timer()
    let submitCount = 0
    let refreshCount = 0

    /** @param {string} reason */
    function printSummary(reason) {
        const elapsedMs = timer.elapsed()
        const elapsedSec = (elapsedMs / 1000).toFixed(1)
        console.log(`[autoshengming] ${reason} | 提交:${submitCount} 刷新:${refreshCount} 用时:${elapsedSec}s`)
    }

    if (allowHashes.length === 0) {
        setStatus("声名流程", "未选择物品，脚本停止")
        printSummary("未选择物品")
        return
    }

    if (SINGLE_CAPTURE_MODE) {
        const frame = c.cap()
        const analysis = analyzeMaterials(frame)
        renderMaterialStatus(analysis)
        isReputationCapped(frame)
        setStatus("声名流程", "单次抓取模式：已完成识别，不执行点击与循环")
        printSummary("单次抓取完成")
        return
    }

    let stopReason = "未知"

    while (true) {
        if (timeoutSec > 0 && timer.elapsed() >= timeoutSec * 1000) {
            setStatus("声名流程", `超时停止: ${timeoutSec}s，提交 ${submitCount}，刷新 ${refreshCount}`)
            stopReason = `超时(${timeoutSec}s)`
            break
        }

        const frame = c.cap()
        if (isReputationCapped(frame)) {
            setStatus("声名流程", `声名已达上限，提交 ${submitCount}，刷新 ${refreshCount}`)
            stopReason = "声名上限"
            break
        }

        const analysis = analyzeMaterials(frame)
        renderMaterialStatus(analysis)

        const submitIdx = analysis.cardReady.findIndex(Boolean)
        if (submitIdx >= 0) {
            setStatus("声名流程", `提交第 ${submitIdx + 1} 卡`)
            await clickSubmit(submitIdx)
            submitCount++
            continue
        }

        if (refreshMaxTimes >= 0 && refreshCount >= refreshMaxTimes) {
            setStatus("声名流程", `达到刷新上限(${refreshMaxTimes})，提交 ${submitCount}，刷新 ${refreshCount}`)
            stopReason = `刷新上限(${refreshMaxTimes})`
            break
        }

        setStatus("声名流程", `无可提交，执行刷新(${refreshCount + 1})`)
        await clickRefresh()
        refreshCount++
    }

    printSummary(stopReason)
}

main()
