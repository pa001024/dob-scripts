// ==UserScript==
// @id JYVs5DxWME
// @name zhiliu_mijin
// @description 止流迷津 1.5
// @author pa
// @version 1.2.9
// @category 其他
// @date 2026/11/05 10:14
// ==/UserScript==

// 说明: 键位和视角设置全默认(!!!!) 视距1.3
// 止流带专武赘生雷月卡/球球蜂 不推荐带防御魔灵 打慢了缺蓝直接寄 潜质攻击威力昂扬老道
// 难度根据情况选 6命选270/300 2命选240

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
    ftime: readConfig("帧间隔", "取帧间隔(毫秒)", "number", 100),
    frameless: readConfig("无边框", "无边框窗口", "boolean", false),
    debug: readConfig("debug", "-", "boolean", false),
    single: readConfig("single", "单帧识别", "boolean", false),
    aimLog: readConfig("瞄准日志", "aim阶段每tick打一行log(排查摇头)", "boolean", false),
    aimShot: readConfig("瞄准截图", "aim时定时imwrite帧到imgs/aim_xxxx.png", "boolean", false),
    aimShotGap: readConfig("截图间隔", "aim截图间隔tick数(100ms/tick)", "number", 10),
    battleTime: readConfig("战斗超时", "超时暂离(秒)", "number", 120) * 1e3,
    /** @type {ROI} */ minimapLoc: [30, 35, 180, 180],
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 560],
    // 视角光心（寻路几何基准）：out/距离/角度全部相对它计算。
    // 扩大 mainLoc 扫描范围时保持不动，否则已标定的 out 阈值全部失效。
    /** @type {[number, number]} */ viewCenter: [800, 426],
}
const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
const yof = config.frameless ? 0 : 30
checkSize(hwnd, 1600, 900 + yof)

function cap13() {
    return config.frameless ? captureWindowWGC(hwnd) : captureWindowWGC(hwnd, 0, 30, 1600, 900)
}
/** @param {number} x @param {number} y */
function rmc(x, y) {
    return moveC(hwnd, x, y + yof)
}

let frame = cap13()
let autoAimX = false
let autoAimY = false
/** fastMove/远距离跳跃飞行中为 true，此时禁止小地图转身与 X 轴 aim，避免飞到一半转回来 */
let isFlying = false
const autoAimoffsetY = -150
let findFn = findDoor
/** @typedef {NonNullable<ReturnType<typeof findDoor>>} DoorInfo */
/** @type {DoorInfo[]} */
const doorTripleBuffer = []
let bufferedFindFn = findFn
// aim观测：tick序号 + 截图计数（只记录不干预，排查摇头用）
let aimTick = 0
let aimShotN = 0
const AIM_SHOT_MAX = 120

/**
 * 门识别三重缓冲 + 跟踪平滑（治摇头，实测 log 驱动）：
 * 1. 颜色按族一致（大红/小红同属红）：徽记中心单像素分类闪烁不再导致输出丢失 + spin 交替。
 * 2. out 迟滞（Schmitt：>1.0 进入，<0.9 解除，灰带沿用上一帧）：同一门在边界两侧
 *    （如 normR 0.99/0.93）不再让 yaw 计算在直接 atan/atan2 两律间横跳（-154° vs -22°）。
 * 3. 位置迟滞：同族候选跳变时，若旧目标仍在当前帧候选中且不比新目标差，保持旧目标
 *    （多门/噪点轮流被选中）；旧目标消失则立即切换，不跟转身/走过打架。
 * 4. 短暂丢失惯性：连续丢失≤2帧沿用旧目标（技能光遮挡一闪），之后才真正放手。
 * @param {DoorInfo | undefined} rawDoor 当前帧选择结果
 * @param {{center: [number, number], color: string, door: DoorInfo}[]} [candidates] 当前帧全部候选
 * @returns {DoorInfo | undefined}
 */
const TRACK_R = 120 // 锚点有效半径（像素）：旧目标在此范围内都算“还在”
const HYST_BAND = 50 // 切换迟滞带（像素）：新目标必须比旧目标靠近中心这么多才切换
const COAST_N = 2 // 丢失惯性帧数
const OUT_ON_R = 1.0 // out 进入阈值（原始 0.95 在边界抖，见 log #43/#44）
const OUT_OFF_R = 0.9 // out 解除阈值
/** @type {{center: [number, number], fam: string, door: DoorInfo} | null} */
let trackAnchor = null
let trackCoast = 0
let lastDoorOut = false
function resetDoorTrack() {
    doorTripleBuffer.length = 0
    trackAnchor = null
    trackCoast = 0
    lastDoorOut = false
}
/** @param {[number, number]} a @param {[number, number]} b */
function xyDist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1])
}
function getBufferedDoor(rawDoor, candidates = []) {
    if (!rawDoor) {
        if (trackAnchor && trackCoast < COAST_N) {
            trackCoast++
            if (config.aimLog) console.log(`[aim #${aimTick} coast] 丢失${trackCoast}帧，沿用 ${trackAnchor.fam}(${~~trackAnchor.center[0]},${~~trackAnchor.center[1]})`)
            return trackAnchor.door
        }
        return
    }
    trackCoast = 0

    doorTripleBuffer.push(rawDoor)
    if (doorTripleBuffer.length > 3) doorTripleBuffer.shift()
    if (doorTripleBuffer.length < 3) {
        lastDoorOut = !!rawDoor.out
        trackAnchor = { center: rawDoor.match.center, fam: colorFamily(rawDoor.match.color), door: rawDoor }
        return rawDoor
    }

    const f0 = colorFamily(doorTripleBuffer[0].match.color)
    const f1 = colorFamily(doorTripleBuffer[1].match.color)
    const f2 = colorFamily(doorTripleBuffer[2].match.color)
    // 颜色切换时乐观跟随最新帧：一次闪烁只偏一 tick，不再换来连续 spin turn(1)
    const out = f0 === f1 && f1 === f2 ? doorTripleBuffer[2] : rawDoor
    // out 迟滞平滑（直接改本次输出对象；findColors 给的是原始判定）
    const rawOut = !!out.out
    const smoothed = out.normR > OUT_ON_R ? true : out.normR < OUT_OFF_R ? false : lastDoorOut
    out.out = smoothed
    lastDoorOut = smoothed
    if (config.aimLog && smoothed !== rawOut) console.log(`[aim #${aimTick} out-hyst] normR=${out.normR.toFixed(2)} raw=${rawOut} -> ${smoothed}`)
    // 位置迟滞
    const of = colorFamily(out.match.color)
    if (trackAnchor && trackAnchor.fam === of) {
        if (xyDist(out.match.center, trackAnchor.center) > TRACK_R) {
            const c = config.viewCenter
            const still = (candidates || []).find(k => colorFamily(k.color) === trackAnchor.fam && xyDist(k.center, trackAnchor.center) < TRACK_R)
            if (still && xyDist(trackAnchor.center, c) < xyDist(out.match.center, c) + HYST_BAND) {
                if (config.aimLog)
                    console.log(`[aim #${aimTick} hold] 跳变(${~~trackAnchor.center[0]},${~~trackAnchor.center[1]})->(${~~out.match.center[0]},${~~out.match.center[1]})，旧目标仍在，保持`)
                return still.door
            }
        }
    }
    trackAnchor = { center: out.match.center, fam: of, door: out }
    return out
}
const gameState = {
    dx: 0,
    dy: 0,
    distance: 0,
    angle: 0,
    mp: 0,
    /** @type {ReturnType<typeof checkState>} */ state: "unknown",
}
function checkStop() {
    return hwnd === getForegroundWindow()
}

/**
 * 检查技能状态
 * @param {Mat} img 窗口截图
 */
function checkSkill(img) {
    const skill_orb = [
        cc(img, 1437, 810, 0xececed, 10),
        cc(img, 1433, 811, 0xececed, 10),
        cc(img, 1439, 819, 0xececed, 10),
        cc(img, 1439, 819, 0xececed, 10),
        cc(img, 1445, 816, 0xececed, 10),
    ]
        .map(v => (v ? "1" : "0"))
        .join("")

    // console.log(skill_orb)
    switch (skill_orb) {
        case "10110": // 无符
            return 0
        case "00110": // BUFF
            return 1
        case "01111": // 龙
            return 2
        case "00001": // 剑
            return 3
    }

    return -1
}

/**
 * 找颜色
 * @param {Mat} img 窗口截图
 * @param {number[]} colors 颜色数组
 * @param {string[]} names 颜色名称数组
 */
function findColors(img, colors, names, threshold = 10, mode = "single") {
    // x: 290~1310 y: 169~729（底部放到 729：门徽记常贴底边，514 会把 cap7/cap36 类徽记截断）
    const xOffset = config.mainLoc[0]
    const yOffset = config.mainLoc[1]
    const roi = img.roi(...config.mainLoc)
    const filtered = colorFilter(roi, colors, threshold)
    const closed = morphologyEx(filtered, "close", 4)
    const contours = findContours(closed, 0).filter(c => {
        // 贴边轮廓可能是被取景框截断的真门徽记（如 cap7 底部红色徽记只剩 11x6，面积 21），面积不可靠；
        // 贴边用宽松下限 15，内部保持 100 以滤除火把/技能光斑等小噪声（如 cap35 剑光 area=97）。
        const truncated =
            c.bbox[0] <= 2 ||
            c.bbox[1] <= 2 ||
            c.bbox[0] + c.bbox[2] >= roi.cols() - 2 ||
            c.bbox[1] + c.bbox[3] >= roi.rows() - 2
        return (
            c.area >= (truncated ? 15 : 100) &&
            c.area < 420 &&
            c.bbox[2] < 28 &&
            c.bbox[3] < 28 &&
            (mode !== "multi" || Math.abs(c.bbox[2] - c.bbox[3]) < 2)
        )
    })
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
    // 寻路几何基准使用视角光心（config.viewCenter），不随 mainLoc 扩大而漂移
    const windowCenter = [config.viewCenter[0], config.viewCenter[1]]
    const distOf = v => Math.hypot(v.center[0] - windowCenter[0], dyCorrected(v.center[1] - windowCenter[1]))
    // 全部候选先算成完整 DoorInfo（供迟滞层在候选之间做“保持/切换”决策时有新鲜量可用）
    const toInfo = match => {
        const dx = match.center[0] - windowCenter[0]
        const dy = match.center[1] - windowCenter[1]
        const dyi = dyCorrected(dy) // 椭圆转圆形（上下半屏不对称，见 dyCorrected 校准注释）
        const deg = Math.atan2(dy, dx) * (180 / Math.PI)
        const distance = Math.hypot(dx, dyi)
        const normR = distance / OUT_NORM_BASE // 阈值保持 0.95 不动（0.95*442=420，与老 distance>420 等价）
        const onEdge =
            match.bbox[0] <= xOffset + 4 ||
            match.bbox[1] <= yOffset + 4 ||
            match.bbox[0] + match.bbox[2] >= xOffset + config.mainLoc[2] - 4 ||
            match.bbox[1] + match.bbox[3] >= yOffset + config.mainLoc[3] - 4
        return {
            match,
            center: match.center,
            dx,
            dy,
            angle: degTo360(deg + 90),
            distance,
            // 门投影贴到取景框边或越出取景框 -> 视为超出屏幕，需要小地图+转身引导
            // 注：这是原始判定；getBufferedDoor 内另做 out 迟滞平滑后再使用
            out: normR > 0.95 || onEdge,
            normR,
            onEdge,
        }
    }
    const infos = matches.map(toInfo)
    // 按门顺序优先级选门；同色多个时取离中心最近的（确定性，避免轮廓顺序抽奖）
    let picked = undefined
    for (const color of config.门顺序) {
        const cands = infos.filter(v => color === v.match.color)
        if (cands.length > 0) {
            picked = cands.map(v => ({ v, d: distOf(v) })).sort((a, b) => a.d - b.d)[0].v
            break
        }
    }
    if (!picked && infos.length > 0) {
        // 兜底：取景框里明明有门，但颜色都不在门顺序里时（如 cap1 休整场景只有小红徽记，
        // 而门顺序未勾选小红），退化为选择距离取景框中心最近的一个，而不能返回空。
        // 否则主视角有门却判定无门，原地 turn(1) 打转，表现为“找不到门”。
        picked = infos.map(v => ({ v, d: distOf(v) })).sort((a, b) => a.d - b.d)[0].v
    }
    if (picked) {
        const match = picked.match
        if (config.debug)
            setStatus(
                "door",
                matches.map(v => v.door),
                `${matches
                    .map(v => v.color)
                    .sort()
                    .join(" ")} -> ${match.color}${config.门顺序.includes(match.color) ? "" : " (兜底)"}`
            )
        picked.candidates = infos.map(v => ({ center: v.match.center, color: v.match.color, door: v }))
        return picked
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
/**
 * 找黄点
 * @param {Mat} img 窗口截图
 */
function findYellow(img) {
    // 滤色 : #FFD984 #C28334 #F0E084
    return findColors(img, [0xffd984, 0xc28334, 0xf0e084], ["黄", "黄", "黄"], 20, "multi")
}

/** @param {number} deg */
function degTo360(deg) {
    return (deg + 360) % 360
}

/**
 * 角度差归一化到 [-180, 180]
 * JS 的 % 对负数会保留符号，直接 ((a-b+180)%360)-180 在差值为负时会得到 -180~-360 的错误结果
 * @param {number} from 当前朝向
 * @param {number} to 目标朝向
 */
function angleDelta(from, to) {
    return (((from - to + 540) % 360 + 360) % 360) - 180
}

/** 小地图转身的距离门禁：非常近的不作为转身依据，防止误判 */
const MINIMAP_TURN_MIN_DIST = 15

/** out 归一化基数：0.95*442=420，与老 distance>420 等价，阈值本身不动 */
const OUT_NORM_BASE = 442
/** 椭圆矫正分母（上下半屏共用） */
const ELLIPSE_DEN = 239
/** 上半屏椭圆矫正分子（保持原值） */
const ELLIPSE_TOP_NUM = 496
/**
 * 下半屏椭圆矫正分子（对照 imgs/cap*.png 校准，阈值保持 0.95 不动）。
 * 下边缘目标纵向压缩更严重：cap18 大红 dx=-120 dy=212，用原 496 算 distance=456
 * （normR=1.03）看似刚过线，但 dy 稍小一点（如 dy=180 → 393）就会漏判；
 * 而中央底部目标 cap19 小红 dx=-184 dy=120（distance=309）必须保持非 out。
 * 取 570 使 cap18 → 520（out）、cap19 → 340（非 out），上下分开标定。
 * @param {number} dy 相对取景框中心的纵向偏移（>0 为下半屏）
 */
function dyCorrected(dy) {
    return dy >= 0 ? (dy * 570) / ELLIPSE_DEN : (dy * ELLIPSE_TOP_NUM) / ELLIPSE_DEN
}

/**
 * 主视角找不到门时，用左下角小地图上的门标记雷达强制转身寻门。
 * 门在身后时主视角完全看不到，只能靠这里转身（cap35/36/37）。
 * 若小地图同时有多个标记，优先与「优先级最高且最近3帧一致」的目标颜色一致的那个。
 * @param {Mat} img 窗口截图
 * @param {string} [preferColor] 期望匹配的颜色（如事件阶段期望 "黄"），省略则用雷达自身优先级
 * @returns {{turned: boolean, angle?: number, distance?: number}} 是否已旋转
 */
function aimAtMinimap(img, preferColor, minDist = MINIMAP_TURN_MIN_DIST) {
    if (isFlying) return { turned: false } // 飞行中禁止转身
    const mDoor = findDoorMinimap(img)
    if (!mDoor) return { turned: false }
    if (preferColor && colorFamily(mDoor.match.color) !== preferColor) {
        // 事件阶段期望黄点，但雷达只有红/蓝门标记 -> 不可用于黄点转身
        return { turned: false }
    }
    if (!(mDoor.distance > minDist)) {
        // 太近的小地图标记不可靠（常为自身箭头/噪声），按距离门禁过滤
        return { turned: false }
    }
    const roiMat = img.roi(30, 35, 180, 180)
    let rotation = mDoor.angle
    try {
        rotation = predictRotation(roiMat)
    } catch (_e) {
        rotation = mDoor.angle
    }
    const delta = angleDelta(rotation, mDoor.angle)
    if (Math.abs(delta) > 30) {
        turn(-Math.sign(delta) * Math.max(Math.abs(delta), 1))
        setStatus("route", frame.roi(...mDoor.match.bbox), `转身寻门: ${mDoor.match.color} ${~~mDoor.angle}° delta=${~~delta}`)
        return { turned: true, angle: mDoor.angle, distance: mDoor.distance }
    }
    return { turned: false, angle: mDoor.angle, distance: mDoor.distance }
}

/** 颜色分类 @param {string} c */
function colorFamily(c) {
    return c === "大红" || c === "小红" ? "红" : c
}

/**
 * 小地图找门
 * @param {Mat} img 窗口截图
 */
function findDoorMinimap(img) {
    // x: 290~1312 y: 168~681
    const xOffset = config.minimapLoc[0]
    const yOffset = config.minimapLoc[1]
    const roi = img.roi(...config.minimapLoc)
    // 滤色 : #EB3A43 #FFD772 #797FE6
    const colors = [0xeb3a43, 0xffd772, 0x797fe6]
    const filtered = colorFilterHSL(roi, colors, 60)
    const closed = morphologyEx(filtered, "close", 3)
    // imshow("filtered", closed)
    const contours = findContours(closed, 50)
    /** @type {{center: [number, number], bbox: [number, number, number, number], color: string}[]} */
    const matches = []
    for (const c of contours) {
        if (c.area > 400) continue
        const door = roi.roi(...c.bbox)
        const match = colorKeyMatch(door, colors, 20, 50)
        if (match !== -1) {
            matches.push({
                center: [c.center[0] + xOffset, c.center[1] + yOffset],
                bbox: [c.bbox[0] + xOffset, c.bbox[1] + yOffset, c.bbox[2], c.bbox[3]],
                color: ["红", "黄", "蓝"][match],
            })
        }
    }
    for (const color of config.门顺序) {
        const match = matches.find(v => color.endsWith(v.color))
        if (match) {
            const minimapCenter = [xOffset + config.minimapLoc[2] / 2, yOffset + config.minimapLoc[3] / 2]
            const dpix = Math.sqrt((match.center[0] - minimapCenter[0]) ** 2 + (match.center[1] - minimapCenter[1]) ** 2)
            const deg = Math.atan2(match.center[1] - minimapCenter[1], match.center[0] - minimapCenter[0]) * (180 / Math.PI)
            return {
                match,
                angle: degTo360(deg + 90),
                distance: (dpix * 31) / 51 - 1,
            }
        }
    }
}
let currentSkill = checkSkill(frame)
/**
 * 准备下一次技能
 * @param {'q'|'q1'|'q2'|'Q2'|'q3'|'z'} skill 技能编号
 */
async function prepareSkill(skill) {
    currentSkill = checkSkill(frame)
    /** @param {"long" | "short"} type 长E或短E */
    async function useSkillEAndCheck(type) {
        await kb(hwnd, "e", type === "long" ? 800 : 10)
        await sleep(type === "long" ? 800 : 300)
        // 更新画面
        currentSkill = checkSkill(frame)
    }
    const timer = new Timer()
    const timeout = 5e3
    function checkTimeout() {
        return timer.elapsed() < timeout && gameState.state !== "finish"
    }
    switch (skill) {
        case "q1":
            while (currentSkill !== 1 && checkTimeout()) await useSkillEAndCheck("long")
            break
        case "q2":
        case "Q2":
            if (currentSkill === 0) {
                await useSkillEAndCheck("long")
                await useSkillEAndCheck("short")
            }
            while (currentSkill !== 2 && checkTimeout()) {
                if (currentSkill !== 2 && currentSkill !== 3) await useSkillEAndCheck("short")
                if (currentSkill !== 2) await useSkillEAndCheck("long")
            }
            break
        case "q3":
            while (currentSkill !== 3 && checkTimeout()) await useSkillEAndCheck("short")
            break
    }
}
/**
 * 使用技能
 * @param {'q'|'q1'|'q2'|'Q2'|'q3'|'z'} skill 技能编号
 */
async function useSkill(skill) {
    await prepareSkill(skill)
    /**
     * 通过轮询 mp 是否下降判断 Q 是否成功释放，失败则重按 Q。
     * @param {number} pressMs 按键时长
     * @param {number} timeoutMs 总超时时间
     */
    async function pressQUntilMpReduced(pressMs = 10, timeoutMs = 2e3) {
        const timer = new Timer()
        while (checkStop() && timer.elapsed() < timeoutMs && (gameState.state.includes("battle") || gameState.state === "unknown")) {
            const before = gameState.mp
            await kb(hwnd, "q", pressMs)
            const pollTimer = new Timer()
            while (checkStop() && pollTimer.elapsed() < 350 && (gameState.state.includes("battle") || gameState.state === "unknown")) {
                if (gameState.mp < before) {
                    return true
                }
                await sleep(20)
            }
            await sleep(60)
        }
        return false
    }
    switch (skill) {
        case "q":
            return await pressQUntilMpReduced(10, 1800)
        case "z":
            await kb(hwnd, "z", 10)
            return true
        case "q1":
            if (currentSkill === 1) {
                const ok = await pressQUntilMpReduced(10, 2e3)
                if (ok) {
                    await sleep(1000)
                }
                return ok
            }
            break
        case "q2":
            if (currentSkill === 2) {
                const ok = await pressQUntilMpReduced(10, 2500)
                if (ok) {
                    await sleep(3300)
                }
                return ok
            }
            break
        case "Q2":
            if (currentSkill === 2) {
                const ok = await pressQUntilMpReduced(500, 3e3)
                if (ok) {
                    await sleep(3300)
                }
                return ok
            }
            break
        case "q3":
            if (currentSkill === 3) {
                const ok = await pressQUntilMpReduced(10, 2e3)
                if (ok) {
                    await sleep(1600)
                }
                return ok
            }
            break
    }
    return false
}
async function doge(boss = false) {
    // 原地二段跳
    if (boss) kd(hwnd, "w")
    await kb(hwnd, "space", 100)
    await sleep(500)
    await kb(hwnd, "space", 100)
    await sleep(500)
    if (boss) ku(hwnd, "w")
}

/** 检查状态 @param {Mat} frame */
function checkState(frame) {
    if (cc(frame, 49, 278, 0xffffaf, 33) || cc(frame, 49, 278, 0xd6eeb8, 33)) {
        if (cc(frame, 527, 64, 0x000000, 10)) {
            if (cc(frame, 541, 61, 0xff3e3e, 10)) {
                return "battle_boss"
            } else {
                return "battle_boss_inv"
            }
        } else {
            if (cc(frame, 45, 251, 0xffffff, 10)) {
                return "event"
            } else {
                return "door"
            }
        }
    } else {
        if (cc(frame, 44, 273, 0xff5058, 33) || cc(frame, 45, 274, 0xff4d55, 33) || cc(frame, 49, 278, 0xd56874, 33)) {
            if (cc(frame, 87, 310, 0xfcfcfc, 10)) {
                return "battle"
            } else {
                return "event"
            }
        } else {
            if (cc(frame, 1115, 375, 0xcd9999, 10)) {
                return "esc_menu"
            } else {
                if (cc(frame, 23, 25, 0xfff2ad, 10)) {
                    if (cc(frame, 1326, 28, 0xffffff, 10)) {
                        return "buy"
                    } else {
                        if (cc(frame, 1407, 874, 0x000000, 10)) {
                            return "esc"
                        } else {
                            return "enter"
                        }
                    }
                } else {
                    if (cc(frame, 688, 474, 0x000000, 10)) {
                        if (!cc(frame, 1537, 871, 0x000000, 10)) {
                            return "buff"
                        }
                    } else {
                        if (cc(frame, 640, 850, 0x8fd19e, 10)) {
                            return "esc"
                        } else {
                            if (cc(frame, 1241, 43, 0x090a17, 10)) {
                                if (cc(frame, 1230, 45, 0xffffff, 10)) {
                                    return "shop"
                                }
                            } else {
                                if (cc(frame, 1115, 818, 0xfafafa, 10)) {
                                    return "esc"
                                } else {
                                    if (cc(frame, 743, 94, 0xf2e69d, 20)) {
                                        return "finish"
                                    } else {
                                        if (cc(frame, 798, 749, 0x000000, 10)) {
                                            return "buff"
                                        } else {
                                            if (cc(frame, 1366, 356, 0xffffd6, 10)) {
                                                return "buff"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if (cc(frame, 47, 39, 0xffffff, 10) && cc(frame, 48, 209, 0xfefefe, 10)) {
        return "home"
    }
    if (cc(frame, 1183, 362, 0xdaa199, 10)) return "dialog"
    if (matchHammingHash(perceptualHash(frame.roi(718, 72, 38, 37)), ["778eb05ec974b600"], 10) >= 0) return "finish"
    return "unknown"
}

/** 检查地图 @param {Mat} frame */
function checkMap(frame) {
    const points = [
        cc(frame, 75, 104, 0x0a0b0a, 10),
        cc(frame, 101, 110, 0x0a0b0a, 10),
        cc(frame, 125, 137, 0x0a0b0a, 10),
        cc(frame, 125, 163, 0x0a0b0a, 10),
        cc(frame, 137, 116, 0x0a0b0a, 10),
        cc(frame, 74, 146, 0x0a0b0a, 10),
        cc(frame, 95, 137, 0x0a0b0a, 10),
        cc(frame, 162, 141, 0x0a0b0a, 10),
        cc(frame, 143, 130, 0x0a0b0a, 10),
        cc(frame, 57, 156, 0x0a0b0a, 10),
        cc(frame, 94, 183, 0x0a0b0a, 10),
    ]
        .map(v => (v ? "1" : "0"))
        .join("")
    /** @param {string} points  */
    function getMap(points) {
        switch (points) {
            case "00101000010":
            case "00101110010":
            case "00001110010":
                return "dash"
            case "01110000010":
            case "11111000010":
            case "10101000110":
            case "11101000110":
            case "11101000000":
            case "11100000110":
            case "11111000000":
            case "11111000011":
                return "zuoguai"
            case "00000111001":
                return "paotai_reset" // 炮台背面
            case "00010111011":
            case "00010111111":
                return "paotai" // 炮台正面
            case "00000000011":
                return "bossfang"
            default:
                if (points.startsWith("1111000")) return "zuoguai"
                return "unknown"
        }
    }
    const state = getMap(points)
    setStatus("map", `${state}: ${points}`)
    // console.log(`${state}: ${points}`)
    return state
}
/**
 * 转视角
 * @param {number} angle 角度
 */
function turn(angle) {
    mm((2057 * angle) / 360, 0)
}

/**
 * 鼠标中键复位视角。
 * 落地后若残留俯仰偏移，可能导致「非正下方的门」被误判为 out，进而反复转向。
 * 在每次落地后调用一次，把摄像机角度复位到水平，避免无限转圈。
 */
function resetView() {
    mc(hwnd, "middle")
}

/**
 * 转视角到绝对角度
 * @param {number} angle 角度
 * @param {Mat} [frame] 窗口截图
 */
async function turnAbs(angle, frame) {
    if (!frame) frame = cap13()
    const roiMat = frame.roi(30, 35, 180, 180)
    const rotation = predictRotation(roiMat)
    const delta = angleDelta(rotation, angle)
    if (rotation === angle) return
    turn(-Math.sign(delta) * Math.max(Math.abs(delta), 1))
}

/**
 * 快速移动
 * @param {number} [angle] 角度
 * @param {number} [distance] 距离
 */
async function fastMove(angle, distance) {
    setStatus("fn", "fastMove")
    if (angle !== undefined) await turnAbs(angle)
    if (distance === undefined || distance > 15) {
        isFlying = true
        await rollAbs(-50)
        await sleep(33)
        await kb(hwnd, "4", 33)
        await sleep(500)
        await kb(hwnd, "space")
        await sleep(300)
        mt(hwnd)
        mc(hwnd) // 下落攻击
        resetView() // 落地复位视角，避免残留俯仰导致 out 误判
        isFlying = false
    } else {
        kd(hwnd, "w")
        await sleep(33)
        if (distance > 4) await kb(hwnd, "shift")
        await sleep(500 + distance * 300)
        ku(hwnd, "w")
    }
}

/**
 * 转视角到绝对俯仰角
 * @param {number} angle 角度
 */
async function rollAbs(angle) {
    for (let i = 0; i < 12; i++) {
        mm(0, 100) // 视角重置
        await sleep(5)
    }
    await sleep(50)
    const deg = (-700 * (-angle + 90)) / 90
    for (let i = 0; i < 10; i++) {
        mm(0, ~~(deg / 10)) // 视角重置
        await sleep(5)
    }
}

const autoAimCalib = {
    hFovDeg: 90,
    xMm: 100,
    yMm: 100,
    xDeltaPx: Math.abs(-218 - 14.5),
    yDeltaPx: Math.abs(-143.7 - 42),
}

const autoAimModel = (() => {
    const w = config.mainLoc[2]
    const h = config.mainLoc[3]
    const hFovRad = (autoAimCalib.hFovDeg * Math.PI) / 180
    const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) * (h / w))
    const fx = w / 2 / Math.tan(hFovRad / 2)
    const fy = h / 2 / Math.tan(vFovRad / 2)
    const xDegByCalib = (Math.atan(autoAimCalib.xDeltaPx / fx) * 180) / Math.PI
    const yDegByCalib = (Math.atan(autoAimCalib.yDeltaPx / fy) * 180) / Math.PI
    return {
        fx,
        fy,
        mmPerDegX: autoAimCalib.xMm / xDegByCalib,
        mmPerDegY: autoAimCalib.yMm / yDegByCalib,
    }
})()

/** @param {number} v @param {number} min @param {number} max */
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v))
}
// 跟踪阻尼：实测跟踪指令长期顶在 ±320 钳制位（饱和抡镜 → 画面涂抹 → 检测乱跳 → 更猛地抡，正反馈）。
// 增益 0.6：即使标定偏热 40%（hFov 不准等）仍然无超调，只慢 2~3 tick 收敛；
// 钳制 120（≈25°/tick）：跟踪足够快；真·掉头（mini-turn/turnAbs）走各自通道不受影响。
const AIM_GAIN = 0.6
const AIM_MAX = 120

/**
 * 屏幕投影偏移 -> 摄像机角度 -> mm参数
 * @param {number} dx
 * @param {number} dy
 * @param {{out?: boolean, rawDy?: number}} [opts]
 */
function projectOffsetToMm(dx, dy, opts = {}) {
    let yawDeg = (Math.atan(dx / autoAimModel.fx) * 180) / Math.PI
    const pitchDeg = (Math.atan(dy / autoAimModel.fy) * 180) / Math.PI
    if (opts.out && opts.rawDy) {
        // 边缘点会被压在椭圆上，使用 dx + 椭圆修正后的 dy 计算平面方向角（与 out 共用 dyCorrected）。
        const rawDy = Number.isFinite(opts.rawDy) ? opts.rawDy : dy
        const dyi = dyCorrected(rawDy)
        yawDeg = (Math.atan2(dx, -dyi) * 180) / Math.PI
    }
    return {
        yawDeg,
        pitchDeg,
        mmx: Math.round(yawDeg * autoAimModel.mmPerDegX),
        mmy: Math.round(pitchDeg * autoAimModel.mmPerDegY),
    }
}

let isPaopai = false
let resetFlag = false
let resetOnce = false
/**
 * 自动寻路
 */
async function moveLoop(type = "door") {
    setStatus("fn", "moveLoop")
    async function checkFinish(t = 0) {
        if (gameState.state.includes("battle")) {
            setStatus("err")
            resetFlag = autoAimX = resetOnce = false
            return true
        }
        if (t ? await waitF(t) : checkF()) {
            setStatus("err")
            resetFlag = resetOnce = autoAimX = false
            await kb(hwnd, "f", 33)
            await sleep(1000)
            return true
        }
        return false
    }
    if (isPaopai) {
        kd(hwnd, "d")
        await sleep(200)
        await kb(hwnd, "space")
        await sleep(400)
        await kb(hwnd, "space")
        await sleep(600)
        ku(hwnd, "d")
        if (checkF()) {
            await kb(hwnd, "f")
        } else {
            await resetLoop()
            await sleep(1000)
        }
        isPaopai = false
        return
    }
    let map = checkMap(frame)
    for (let i = 0; i < 10; i++) {
        mt(hwnd)
        await sleep(500)
        // 多等待几帧 等地图稳定
        const newmap = checkMap(frame)
        if (newmap === map) break
        map = newmap
    }
    if (map === "maybe") {
        await resetLoop()
        await sleep(1000)
        map = checkMap(frame)
    }
    switch (map) {
        case "dash":
            kd(hwnd, "w")
            await sleep(50)
            await kb(hwnd, "shift")
            await sleep(600)
            ku(hwnd, "w")
            mc(hwnd)
            await sleep(1000)
            break
        case "zuoguai":
            await fastMove()
            await sleep(700)
            kd(hwnd, "w")
            await sleep(200)
            kb(hwnd, "shift", 33)
            await sleep(300)
            ku(hwnd, "w")
            turn(-90)
            await fastMove()
            await sleep(500)
            break
        case "paotai_reset":
            if (!cc(frame, 219, 321, 0xffffb4, 10) && resetFlag) {
                kd(hwnd, "d")
                kb(hwnd, "w", 700)
                await sleep(800)
                ku(hwnd, "d")
                isPaopai = true
                resetFlag = false
            }
            break
        case "paotai":
            if (!cc(frame, 219, 321, 0xffffb4, 10)) {
                kd(hwnd, "s")
                await kb(hwnd, "a", 300)
                ku(hwnd, "s")
                await kb(hwnd, "a", 800)
                if (await checkFinish()) {
                    setStatus("err")
                    return
                }
                await kb(hwnd, "w", 700)
                isPaopai = true
                if (await checkFinish()) {
                    setStatus("err")
                }
                await kb(hwnd, "space")
                await sleep(200)
                await kb(hwnd, "space")
                await sleep(200)
                await kb(hwnd, "d", 700)
                return
            }
            break
        case "bossfang":
            turn(-12)
            await fastMove()
            await sleep(700)
            turn(-8)
            await fastMove()
            await sleep(700)
            break
    }
    const totalTimeout = new Timer()
    let state = gameState.state
    let lastd = 0
    // 起飞去抖：OCR 偶发误读（如贴脸时读出 79/191 米）不能直接起飞，否则一头飞过近在咫尺的门；
    // 远判定必须连续两次 loop 都成立才飞（真远门不受影响，误读只会出现一瞬间）。
    let farSeen = 0
    const notMoved = new Timer()
    const shiftcd = new Timer()
    while (checkStop() && (state === "event" || state === "door")) {
        state = gameState.state
        setStatus("state", state)
        if (state !== type || (await checkFinish())) {
            ku(hwnd, "w")
            setStatus("err")
            return
        }
        autoAimX = true
        await sleep(100)
        // 远距离移动（去抖：连续两次判定为远才起飞，第一次先走过去等确认）
        const wantFly = gameState.distance > 20 || (gameState.distance > 10 && gameState.dy < -30) || gameState.dy < -220
        if (wantFly) farSeen++
        else farSeen = 0
        if (wantFly && farSeen >= 2) {
            autoAimX = false
            isFlying = true // 起飞：ftimer 内的小地图转身/X aim 全部暂停，落地再恢复
            const yew = gameState.distance > 29 ? -45 : gameState.distance > 20 ? -25 : -12
            // if (config.debug) console.log(`远距离移动: d=${gameState.distance} yew=${yew}`)
            await rollAbs(yew)
            await kb(hwnd, "4")
            await sleep(500)
            await rollAbs(0)
            autoAimY = true
            await waitF(300)
            autoAimY = false
            mt(hwnd)
            if (await checkFinish()) {
                isFlying = false
                return
            }
            await sleep(33)
            mc(hwnd)
            await sleep(33)
            mc(hwnd)
            resetView() // 落地复位视角
            if (await checkFinish(500)) {
                isFlying = false
                return
            }
            isFlying = false
            autoAimX = true
            farSeen = 1 // 飞完保持“已见远一次”，真远门下一次判定直接续飞，不用重新走一轮
            notMoved.reset()
        } else {
            resetView() // 正常走路时回正一次，保持视野水平，防止抬头残留导致 out 误判原地转圈
            kd(hwnd, "w")
            await waitF(200)
            if (gameState.distance >= 7 && shiftcd.elapsed() > 2e3) {
                await kb(hwnd, "shift")
                shiftcd.reset()
            }
            if (Math.abs(lastd - gameState.distance) < 1.5) {
                if (notMoved.elapsed() > 2500) {
                    await kb(hwnd, "space")
                    await sleep(300)
                    await kb(hwnd, "space")
                    notMoved.reset()
                }
            } else if (gameState.distance > 0) {
                notMoved.reset()
            }
            await waitF(500)
            ku(hwnd, "w")
            lastd = gameState.distance
        }
        if (totalTimeout.elapsed() > config.moveTimeout * 1e3) {
            autoAimX = false
            if (resetOnce) {
                await exitAction()
                resetOnce = false
                return
            }
            console.log("移动超时")
            await resetLoop()
            resetFlag = true
            resetOnce = true
            return
        }
        await sleep(10)
    }
}

/**
 * 自动战斗
 * @param {ReturnType<typeof checkState>} state 战斗状态
 */
async function battleLoop(state) {
    setStatus("fn", "battleLoop")
    ku(hwnd, "w")
    const timer = new Timer()
    const timer2 = new Timer()
    mt(hwnd) // 锁定BOSS
    await sleep(300)
    await kb(hwnd, "w", 30)
    await useSkill("q2")
    await useSkill("z")
    if (state.includes("boss") && config.useQ1) {
        await useSkill("q1")
    }
    while (checkStop()) {
        if (config.battleTime < timer2.elapsed()) {
            await exitAction(2)
            return
        }
        const state = gameState.state
        setStatus("state", state)
        const isBoss = state.includes("boss")
        const isInv = state.includes("inv")
        if (state === "buff") {
            kb(hwnd, "esc")
            rmc(1456, 808)
            await sleep(300)
            continue
        }
        if (!isBoss) {
            await prepareSkill("q2")
        }
        if (!state.includes("battle") && state !== "unknown") {
            setStatus("fn")
            mt(hwnd)
            return
        } else if (state === "unknown") {
            rmc(1456, 808)
            rmc(999, 506)
        }
        if (isBoss) {
            mt(hwnd) // 锁定BOSS
            await sleep(300)
            await kb(hwnd, "w", 30)
        }
        if (!isBoss || isInv) {
            await doge(isBoss)
            await sleep(100)
        }
        if ((frame.get_hsl(782, 822)[2] < 0.7 && timer.elapsed() > 8e3) || timer.elapsed() > 35e3) {
            await useSkill("q2")
            await useSkill("z")
            if (isBoss && config.useQ1) {
                await useSkill("q1")
            }
            timer.reset()
        } else if (gameState.mp > 20 && isBoss) {
            mt(hwnd) // 锁定BOSS
            await sleep(300)
            if (isInv) {
                kd(hwnd, "a")
                await kb(hwnd, "w", 300)
                await kb(hwnd, "shift", 50)
                await kb(hwnd, "space", 50)
                await sleep(300)
                ku(hwnd, "a")
            } else {
                await kb(hwnd, "w", 30)
                await useSkill("q3") // 有蓝放q3
            }
        }
    }
}

async function exitAction(type = 1) {
    kb(hwnd, "esc", 33)
    await sleep(800)
    if (type === 2)
        rmc(1358, 826) // 暂离
    else rmc(1498, 816) // 退出
    await sleep(500)
    rmc(982, 501)
    await sleep(500)
}
/** 重置 */
async function resetLoop(skip = false) {
    setStatus("fn", "resetLoop")
    await kb(hwnd, "esc", 33)
    await sleep(800)
    if (!skip) {
        await moveC(hwnd, 1115, 820 + yof, 300) // 设置
        await sleep(500)
        await moveC(hwnd, 563, 28 + yof, 500) // 其他
        await moveC(hwnd, 1356, 632 + yof, 500) // 重置
        await sleep(200)
        mc(hwnd, 1010, 379)
    }
    await moveC(hwnd, 999, 506 + yof, 100) // 确定
    await sleep(500)
    mt()
    await sleep(500)
}

const rewardTpl = getTemplateB64(
    "iVBORw0KGgoAAAANSUhEUgAAABYAAAAYCAIAAABx3JocAAABX0lEQVQ4EdVSMaqDQBRcQ9BlW1P8zQWCHkCwtZAsiBZBco29SDohl8gFUn9IZy4QLSzS2IgQLGzeJ/qzoq7E3+VPs8PMvNnHsgh9KFzXXa1W0uUcx1mv11KrE6MoggabzaZTG3Y8HlvrTcvtdmtzj8dD13XREoZhqwOAbdtCl5DtdiuiSZKIhBDzPMcYC32ScM7jOK6qKggC3/ev12tRFOfzmTGmKMrkGCEEN9A0TVXVNpdlGQDs93uEECFksVgsl8s2RgjpdZmmKVadT0zT7FoMw5BOlmXJGKvrWuoahvGmIsuyNoExrqpq3NKroJTe+7hcLpqmiUt0XU/TtB+5U0pF4ElUVaWUfr0w/qAv53lSSsWTdy2MscGqvu8L+3A4DFzGmHB/ied5gxAA7HY7RVFOp9PY8jxvVgUAlGU5ngeAP1RI5z+5wrKsqZ2lumVZw+dECHHOv+eBcy6Z/+fSDw4xX94zihE4AAAAAElFTkSuQmCC"
)
/**
 * 选择商店选项
 */
async function selectShopOption() {
    setStatus("fn", "selectShopOption")
    const offsetX = 930
    const offsetY = 430
    const roi = frame.roi(offsetX, offsetY, 43, 268)
    const match = await matchTemplate(roi, rewardTpl, 0.8)
    if (match) {
        rmc(offsetX + match[0] + 10, offsetY + match[1] + 10)
    } else {
        rmc(1022, 696)
    }
    await sleep(100)
}

/** @param {Mat} roi  */
function numocr(roi) {
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

/** @param {Mat} frame  */
function getMP(frame) {
    const roi = frame.roi(1303, 859, 243, 4)
    const p = roi.find_bright(243, 2, 243, 180, 0, ">", "rtl")
    const p2 = roi.find_bright(0, 2, 243, 180, 0, "<", "ltr")
    const mp = p ? Math.round(p[0] / 2.42) : 0
    const mp2 = p2 ? Math.round(p2[0] / 2.42) : 100
    const mpf = mp2 >= mp && mp2 - mp <= 2 ? mp2 : 0
    // if (mpf) setStatus("mp", roi, mpf)
    return mpf
}

async function waitF(timeout = 5e3) {
    const timer = new Timer()
    while (timer.elapsed() < timeout) {
        await sleep(50)
        const matched = checkF()
        if (matched) {
            return true
        }
    }
    return false
}

function checkF() {
    if (gameState.distance > 5) return false
    const phash = perceptualHash(frame.roi(955, 442, 14, 16))
    const matched = matchHammingHash(phash, ["a6a69e19631c69e2"], 10) >= 0
    return matched
}

/** @param {*} door */
function ocrDistance(door, md = 0) {
    // 徽记贴近屏幕边缘时，下方数字区域可能越界：直接 roi 会抛异常并杀死整 tick 的瞄准，
    // 门明明在视野内却永远不转向（表现为“找不到门”），先钳制到画面内，失败则用 md 兜底。
    const x = Math.max(0, door.match.bbox[0] - 4)
    const y = Math.max(0, door.match.bbox[1] + door.match.bbox[3] + 5)
    const w = Math.min(32, frame.cols() - x)
    const h = Math.min(15, frame.rows() - y)
    let d = NaN
    if (w > 0 && h > 0) {
        try {
            const raw = numocr(frame.roi(x, y, w, h))
            // 四位数以上不可能是门距（如误读 "1912"），按识别失败处理走 md 兜底
            d = raw.length > 3 ? NaN : +raw
            if (d >= 100) d = ~~(d / 10)
        } catch (_e) {
            d = NaN
        }
    }
    gameState.distance = Number.isFinite(d) ? d : md
    setStatus("route", `寻路${autoAimX ? "X" : ""}${autoAimY ? "Y" : ""}: ${~~door.dx}, ${~~door.dy}, ${gameState.distance}m`)
}

async function main() {
    if (config.single) {
        console.log("single")
        gameState.state = checkState(frame)
        if (gameState.state === "door") {
            const door = findDoor(frame)
            if (door) ocrDistance(door)
        }
        if (gameState.state === "event") {
            const door = findYellow(frame)
            if (door) ocrDistance(door)
        }
        return
    }

    const xtimer = setInterval(async () => {
        kb(hwnd, "x")
    }, 2e3)

    const ftimer = setInterval(() => {
        frame = cap13()
        gameState.mp = getMP(frame)
        gameState.state = checkState(frame)
        if (gameState.state === "buff") {
            rmc(1456, 808)
        }
        if (autoAimX || autoAimY) {
            if (bufferedFindFn !== findFn) {
                bufferedFindFn = findFn
                resetDoorTrack()
            }
            const rawDoor = findFn(frame)
            const door = config.useTripleDoorBuffer ? getBufferedDoor(rawDoor, rawDoor ? rawDoor.candidates : undefined) : rawDoor
            let md = 0
            // ---- aim观测（只记录不干预） ----
            aimTick++
            const aimInfo = {
                fn: findFn === findYellow ? "yellow" : "door",
                raw: rawDoor || null,
                door: door || null,
                yaw: null,
                pitch: null,
                rawMm: null,
                fastX: null,
                fastY: null,
                mini: "none",
            }
            const aimSnap = tag => {
                if (config.aimLog) {
                    const r = aimInfo.raw,
                        d = aimInfo.door
                    console.log(
                        `[aim #${aimTick} ${tag}] state=${gameState.state} fn=${aimInfo.fn} fly=${isFlying} ax=${autoAimX} ay=${autoAimY} ` +
                            `raw=${r ? `${r.match.color}(${~~r.dx},${~~r.dy})` : "none"} buf=${d ? `${d.match.color}(${~~d.dx},${~~d.dy})out=${d.out}normR=${d.normR.toFixed(2)}` : "none"} ` +
                            `dist=${gameState.distance} yaw=${aimInfo.yaw ?? "-"} pitch=${aimInfo.pitch ?? "-"} fast=(${aimInfo.fastX ?? "-"},${aimInfo.fastY ?? "-"}) rawmm=(${aimInfo.rawMm ?? "-"}) mini=${aimInfo.mini}`
                    )
                }
                if (config.aimShot && config.aimShotGap > 0 && aimTick % config.aimShotGap === 0 && aimShotN < AIM_SHOT_MAX) {
                    aimShotN++
                    try {
                        imwrite(`imgs/aim_${("0000" + aimShotN).slice(-4)}.png`, frame)
                    } catch (_e) {
                        // 截图失败不影响tick
                    }
                    if (aimShotN >= AIM_SHOT_MAX && config.aimLog) console.log(`[aim] 截图已达上限${AIM_SHOT_MAX}张，停止截图`)
                }
            }
            if (door) {
                if (config.debug) drawBorder(hwnd, ...door.match.bbox)
                if (door.out) {
                    const mDoor = findDoorMinimap(frame)
                    if (mDoor && colorFamily(mDoor.match.color) === colorFamily(door.match.color) && mDoor.distance > MINIMAP_TURN_MIN_DIST) {
                        setStatus(
                            "route",
                            frame.roi(...mDoor.match.bbox),
                            `小地图寻路${autoAimX ? "X" : ""}${autoAimY ? "Y" : ""}: ${~~mDoor.angle}°, ${~~mDoor.distance}m`
                        )
                        const roiMat = frame.roi(30, 35, 180, 180)
                        const rotation = predictRotation(roiMat)
                        const delta = angleDelta(rotation, mDoor.angle)
                        if (!isFlying && Math.abs(delta) > 30) {
                            turn(-Math.sign(delta) * Math.max(Math.abs(delta), 1))
                            aimInfo.mini = `rot=${~~rotation} delta=${~~delta} TURN`
                            aimSnap("mini-turn")
                            // console.log("mm旋转", delta)
                            return
                        }
                        gameState.angle = mDoor.angle
                        md = gameState.distance = mDoor.distance
                        aimInfo.mini = `rot=${~~rotation} delta=${~~delta} md=${~~md}`
                    }
                }
                ocrDistance(door, md)
                const first = projectOffsetToMm(door.dx, door.dy + autoAimoffsetY, { out: door.out, rawDy: door.dy })
                let fastX = clamp(Math.round(first.mmx * AIM_GAIN), -AIM_MAX, AIM_MAX)
                let fastY = clamp(Math.round(first.mmy * AIM_GAIN), -AIM_MAX, AIM_MAX)
                if (Math.abs(fastX) < 5) fastX = 0
                if (Math.abs(fastY) < 5) fastY = 0
                gameState.dx = first.mmx
                gameState.dy = first.mmy
                mm(autoAimX && !isFlying ? fastX : 0, autoAimY || door.out ? fastY : 0)
                aimInfo.yaw = +first.yawDeg.toFixed(1)
                aimInfo.pitch = +first.pitchDeg.toFixed(1)
                aimInfo.rawMm = `${first.mmx},${first.mmy}`
                aimInfo.fastX = autoAimX && !isFlying ? fastX : 0
                aimInfo.fastY = autoAimY || door.out ? fastY : 0
                aimSnap("aim")
            } else {
                if (autoAimX && !isFlying) {
                    const aim = aimAtMinimap(frame, bufferedFindFn === findYellow ? "黄" : undefined)
                    if (aim.turned) {
                        aimInfo.mini = "search-TURN"
                        aimSnap("mini-search-turn")
                        return
                    }
                    if (aim.angle !== undefined) {
                        gameState.angle = aim.angle
                        gameState.distance = aim.distance ?? 0
                    } else {
                        gameState.distance = 0
                        turn(1)
                    }
                    aimInfo.mini = aim.angle !== undefined ? `angle=${~~aim.angle} dist=${~~(aim.distance ?? 0)}` : "spin turn(1)"
                    aimSnap("search")
                } else {
                    gameState.distance = 0
                    aimInfo.mini = "fly-blind"
                    aimSnap("fly-blind")
                }
            }
        } else {
            resetDoorTrack()
            setStatus("route")
        }
    }, config.ftime)
    setForegroundWindow(hwnd)
    await sleep(100)
    await moveTo(hwnd, 200, 1 + yof, 100)
    mt()
    await sleep(100)

    let i = 0
    let finished = 0
    const timer = new Timer()
    while (checkStop()) {
        const state = gameState.state
        setStatus("state", state)
        setStatus("fn", "main")
        autoAimX = false
        if (state !== "unknown") i = 0
        switch (state) {
            case "home":
                await kb(hwnd, "esc")
                await sleep(1e3)
                rmc(153, 454)
                await sleep(1e3)
                rmc(893, 28)
                await sleep(1e3)
                rmc(889, 595)
                await sleep(1200)
                break
            case "door":
            case "event":
                findFn = state === "door" ? findDoor : findYellow
                await moveLoop(state)
                break
            case "shop":
                await selectShopOption()
                await kb(hwnd, "space", 1000)
                break
            case "esc_menu":
                rmc(999, 506)
                break
            case "esc":
            case "buy":
                kb(hwnd, "esc")
                await sleep(1000)
                break
            case "buff":
                rmc(1456, 808)
                await sleep(300)
                break
            case "finish": {
                const secs = timer.elapsed() / 1e3
                if (secs > 5) {
                    timer.reset()
                    console.info(`完成 ${++finished}次 用时 ${~~(secs / 60)}分${~~(secs % 60)}秒`)
                }
                await moveTo(hwnd, 200, 1 + yof, 100)
                rmc(1456, 808)
                await sleep(500)
                rmc(1456, 808)
                await sleep(1500)
                break
            }
            case "dialog":
                rmc(974, 529)
                break
            case "enter":
                rmc(1456, 808)
                break
            case "unknown":
                if (i++ > 5) {
                    rmc(1456, 808)
                    rmc(999, 506)
                    i = 0
                }
                await sleep(300)
                break
            default:
                if (state.includes("battle")) await battleLoop(state)
                break
        }
        // 超时
        if (timer.elapsed() > 10 * 60e3) {
            await moveTo(0, 0)
            console.error("循环超时")
            await exitAction()
            timer.reset()
        }
        await sleep(100)
    }
    clearInterval(ftimer)
    clearInterval(xtimer)
    console.log("切换窗口 自动退出")
}
main()
