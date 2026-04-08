// ==UserScript==
// @id PIsZFusRM5
// @name autofishv2
// @description 自动钓鱼V2 自动转点 纯后台 1.3
// @author pa
// @version 2.1.3
// @category 其他
// @date 2026/4/7 15:23:07
// ==/UserScript==

// 说明: 慎开联机 可能会挡住F键
const config = {
    startPoint: readConfig("起点", "自动打开地图并传送到枯荣阁鱼点, 如果自己跑图就关闭", "boolean", true),
    pools: readConfig(
        "鱼池",
        "设置要钓的鱼池顺序 不选表示不钓",
        {
            type: "multi-select",
            options: [
                "枯荣阁", // 13430
                "百年春", // 12389
                "东郊野外", // 12389
                "微茫市", // 11606
                "冰湖", // 11080
                "城西区", // 10750
                "净界岛", // 10112
                "浮星埠", // 9959
                "潮声岩穴", // 8937
                "下水道", // 7584
                "由来巷", // 7234
            ],
        },
        ["枯荣阁", "百年春", "微茫市", "冰湖", "东郊野外"]
    ),
    鱼饵优先级: readConfig(
        "鱼饵优先级",
        "设置要用鱼饵的优先级 删掉表示不用 鱼饵不足时会按顺序自动切换",
        {
            type: "multi-select",
            options: ["好翅爱吃", "同类相吸", "蚓鱼上钩", "通用鱼饵"],
        },
        ["好翅爱吃", "同类相吸", "蚓鱼上钩", "通用鱼饵"]
    ),
    debug: false, // 不实际钓鱼
}
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

/** 识别当前时间种类 @param {Mat} frame */
function identifyTime(frame) {
    const tpls = ["2d0cd3d9e7343922", "d2d0bdf12c2cc332", "16cddc1613fc6462"]
    const names = ["上午", "下午", "夜晚"]
    const roi = frame.roi(1522, 112, 41, 42)
    const phash = perceptualHash(roi)
    const index = matchHammingHash(phash, tpls, 10)
    if (index >= 0) {
        setStatus("identifyTime", roi, `menu:${phash} ${names[index]}`)
        return {
            index,
            name: names[index],
            locate: "menu",
        }
    }
    const roi2 = frame.roi(111, 27, 41, 42)
    const phash2 = perceptualHash(roi2)
    const index2 = matchHammingHash(phash2, tpls, 10)
    if (index2 >= 0) {
        setStatus("identifyTime", roi2, `fishing:${phash2} ${names[index2]}`)
        return {
            index: index2,
            name: names[index2],
            locate: "fishing",
        }
    }
}

/** 换鱼池 @param {string} name  */
async function changePool(name) {
    /** @type {Record<string,[number,number]>} */
    const pools = {
        净界岛: [0, -1],
        冰湖: [1, 0],
        下水道: [1, 1],
        浮星埠: [2, 0],
        百年春: [2, 1],
        潮声岩穴: [2, 2],
        枯荣阁: [2, 3],
        微茫市: [2, 4],
        东郊野外: [3, 0],
        城西区: [3, 1],
        由来巷: [3, 2],
    }
    currentPool = name
    setStatus("state", `转点(${name})`)
    setStatus("substate", `开始选点`)
    const pool = pools[name]
    if (!pool) return false
    const [tab1, tab2] = pool
    c.mc(111, 791)
    await sleep(300)
    c.mc(338 + 199 * tab1, 24) // 点击主标签
    await sleep(300)
    if (tab2 >= 0) {
        c.mc(231 + 164 * tab2, 147) // 点击次标签
        await sleep(300)
    }
    c.mc(1358, 770) // 点击追踪
    await sleep(1000)
    c.mc(1311, 781) // 传送
    await sleep(3000)
    await waitTP(name)
}

/** 检查时间并切换 @param {string} name  */
async function checkPoolTime(name) {
    setStatus("fn", "checkPoolTime")
    /** @type {Record<string,number[]>} */
    const pools = {
        净界岛: [0, 1, 2],
        冰湖: [0, 1, 2],
        下水道: [0, 1, 2],
        浮星埠: [1],
        百年春: [2],
        潮声岩穴: [2],
        枯荣阁: [0],
        微茫市: [2],
        东郊野外: [0],
        城西区: [2],
        由来巷: [0, 1, 2],
    }
    currentAllowedTimes = pools[name]
    if (currentAllowedTimes.length === 3) return
    const timer = new Timer()
    let valid = false
    while (timer.elapsed() < 2e3) {
        await sleep(500)
        const frame = c.cap()
        const time = identifyTime(frame)
        if (time) {
            valid = pools[name].includes(time.index)
            break
        }
    }
    if (!valid) {
        console.log(`${name}时间不符合设定: ${pools[name]}`)
        c.kb("esc")
        await sleep(800)
        c.kb("esc")
        await sleep(800)
        c.mc(57, 417)
        await adjustTime(["600", "1200", "2000"][currentAllowedTimes[0]])
        setStatus("fn", "checkPoolTime:after")
        c.mc(1397, 789)
        await sleep(100)
        while (true) {
            const frame = c.cap()
            if (cc(frame, 954, 446, 0x000000, 5)) break
            c.mc(1529, 873)
            await sleep(500)
            c.kb("f")
        }
        c.kb("f")
        await sleep(1000)
    }
}

/** @param {Mat} roi  */
function timeocr(roi) {
    const chasharr = [
        "e310e3b2e7b30d0c", // 0
        "f0f06031b3b3b34c", // 1
        "58b1e2d992a7ad28", // 2
        "e550abba4583e92c", // 3
        "886ef74c4f98924a", // 4
        "4510efe165139f0e", // 5
        "67b64f490d787822", // 6
        "230bfb4b13a70d68", // 7
        "e71c83b20db2e32c", // 8
        "b09cdaa3d8f22d88", // 9
        "b1b03a3a3ab1bae0", // :
    ]
    const filterd = colorFilter(roi, [0xffffff], 30)

    // 分割图像
    const bboxs = segmentChars(filterd, 1, 2)
    const chars = bboxs.map(v => filterd.roi(...v))
    const hashs = chars.map(v => perceptualHash(v))
    // setStatus("chars", chars, hashs.join("|"))
    return hashs
        .map(v => matchHammingHash(v, chasharr, 20))
        .filter(v => v >= 0 && v < 10) // 过滤:
        .join("")
}
async function adjustTime(t = "600") {
    setStatus("fn", "adjustTime")
    const timer = new Timer()
    while (timer.elapsed() < 20e3) {
        const frame = c.cap()
        const roi = frame.roi(1451, 436, 72, 42)
        const timestr = timeocr(roi)
        setStatus("time", roi, timestr)
        if (timestr === t) {
            console.log("时间调整成功")
            return
        } else {
            wheel(c.hwnd, 1488, 454, -120)
            await sleep(500)
        }
    }
}

async function gotoStartPoint() {
    setStatus("state", `起点(枯荣阁)`)
    setStatus("fn", "gotoStartPoint")
    setStatus("substate", `传送休憩之所`)
    do {
        c.kb("m") // 打开地图
    } while (!(await c.waitColor(25, 23, 0xffffce, 30, 1000)))
    do {
        c.kb("h") // 休憩之所
    } while (!(await c.waitColor(531, 379, 0x000000, 10, 1000)))
    c.mc(953, 502) // 确定
    await sleep(1000)
    setStatus("substate", `等待传送休憩之所`)
    await c.waitColor(130, 860, 0x8fd19e, 10)
    setStatus("substate", `传送枯荣阁`)
    c.kb("m") // 打开地图
    await sleep(800)
    c.mc(1397, 791) // 切换区域
    await sleep(800)
    c.mc(1378, 588) // 烟津渡
    await sleep(800)
    c.mc(1333, 412) // 烟津渡子
    await sleep(800)
    c.mc(1065, 210) // 枯荣阁
    await sleep(400)
    setStatus("substate", `等待传送按钮`)
    await c.waitColor(1197, 780, 0xe1b454, 10)
    await sleep(100)
    c.mc(1266, 777) // 传送
    await sleep(1000)
    c.mc(1266, 777) // 传送
    await sleep(1000)
    await waitTP(`枯荣阁`)
}

/** @param {string} name  */
async function waitTP(name) {
    setStatus("state", `传送${name}`)
    setStatus("substate", `等待开始传送${name}`)
    await c.waitColor(100, 863, 0x000000, 10)
    setStatus("substate", `等待传送到达${name}`)
    const result = await c.waitColor(130, 860, 0x8fd19e, 10, 60e3) // #8fd19e
    console.log(`${name}传送${result ? "成功" : "失败"}`)
    if (!result) return false
    await sleep(1000)
    if (currentPool === "冰湖") await c.kb("a", 200)
    setStatus("substate", `往前走${name}`)
    kd(c.hwnd, "w")
    if (await waitF(5e3)) {
        setStatus("substate")
        console.log(`${name}转点成功`)
        ku(c.hwnd, "w")
        do {
            c.kb("f")
            await sleep(1000)
        } while (!(await c.waitColor(24, 22, 0xffffdc, 30))) // #ffffdc
        return true
    }
    console.log(`${name}转点失败`)
    return false
}

/** @param {Mat} roi  */
function numocr(roi) {
    const chasharr = [
        "4141415050505014", // 0
        "6c6c6c6c8393936c", // 1
        "c84be0c84b37b59c", // 2
        "4be0f0c2e05b5bb4", // 3
        "956cc3e03f19926a", // 4
        "0fe0e1e1e10f4b1e", // 5
        "276362c99dc9c836", // 6
        "634b27634b63a5e0", // 7
        "4a0fe0f1d80fd8b4", // 8
        "7352c863c878379c", // 9
    ]
    const filterd = colorFilter(roi, [0xffffff], 30)

    // 分割图像
    const bboxs = segmentChars(filterd, 1, 2)
    const chars = bboxs.map(v => filterd.roi(...v))
    const hashs = chars.map(v => perceptualHash(v))
    return hashs
        .map(v => matchHammingHash(v, chasharr, 20))
        .filter(v => v >= 0)
        .join("")
}

const lureTypes = [
    { name: "同类相吸", index: 0 },
    { name: "好翅爱吃", index: 1 },
    { name: "通用鱼饵", index: 2 },
    { name: "蚓鱼上钩", index: 3 },
]

{
    const validNames = new Set(lureTypes.map(v => v.name))
    const seen = new Set()
    if (!Array.isArray(config.鱼饵优先级)) {
        config.鱼饵优先级 = []
    } else {
        config.鱼饵优先级 = config.鱼饵优先级.filter(name => validNames.has(name) && !seen.has(name) && seen.add(name))
    }
}

/** 自动切鱼饵 */
async function checkLure() {
    const priority = config.鱼饵优先级
    if (!priority.length) return
    setStatus("fn", "checkLure")
    const frame = c.cap()
    const roi = frame.roi(1529, 718, 36, 16)
    const num = +numocr(roi)
    setStatus("lure", roi, num)
    if (num >= 100) return
    c.mc(1542, 710) // 切换鱼饵
    await sleep(500)
    const panelFrame = c.cap()

    const slots = lureTypes.map(slot => {
        const x = 652 + 94 * slot.index
        const y = 427
        const parsed = +numocr(panelFrame.roi(x, y, 36, 16))
        const stock = Number.isFinite(parsed) ? parsed : 0
        return { ...slot, x, y, stock }
    })

    const stockByName = Object.fromEntries(slots.map(v => [v.name, v.stock]))

    let selected = null
    for (const name of priority) {
        if ((stockByName[name] ?? 0) > 100) {
            selected = slots.find(v => v.name === name)
            break
        }
    }
    if (!selected) {
        selected = slots.filter(v => priority.includes(v.name)).reduce((best, cur) => (cur.stock > best.stock ? cur : best))
    }

    c.mc(selected.x, selected.y)
    await sleep(100)
    c.mc(1350, 676) // 点击装备
    c.kb("esc")
    await sleep(500)
    console.log(`鱼饵自动更换为 ${selected.name} (${selected.stock}个)`)
    await sleep(1000)
}

let currentAllowedTimes = [0, 1, 2]
let currentPool = "枯荣阁"
const fishTimeout = new Timer()
async function checkFinish() {
    const frame = c.cap()
    const roi = frame.roi(746, 286, 105, 18)
    const filterd = colorFilter(roi, [0xffffff], 10)
    const phash = perceptualHash(filterd)
    setStatus("finish", filterd, phash)
    const now = identifyTime(frame)
    if (now) {
        if (now.locate === "fishing" && fishTimeout.elapsed() > 10e3) {
            console.log(`咬钩超时`)
            c.kb("space") // 最后一条鱼超时
            await sleep(500)
        }
        if (!currentAllowedTimes.includes(now.index)) {
            return "changeTime"
        }
    } else {
        fishTimeout.reset()
    }
    if (!cc(frame, 51, 24, 0xffffff, 10)) {
        await c.kb("space")
    }
    const isNoLure = matchHammingHash(phash, ["a97a76369cc4e812"], 10) >= 0
    if (isNoLure) {
        console.log(`无鱼饵`)
        return "finish"
    }
    const bboxs = segmentChars(filterd)
    let found = false
    for (const v of bboxs) {
        const hash = perceptualHash(filterd.roi(...v))
        // 找鱼字
        if (matchHammingHash(hash, ["4ebde0f1a0d6c2a2"], 10) >= 0) {
            found = true
            break
        }
    }
    if (config.debug) return "finish"
    return found ? "finish" : ""
}

async function fishLoop() {
    setStatus("state", `${currentPool}钓鱼`)
    setStatus("fn", "fishLoop")
    let finished = false
    let changeTime = false
    fishTimeout.reset()
    const timer = setInterval(async () => {
        const reason = await checkFinish()
        if (reason === "finish") {
            finished = true
            clearInterval(timer)
        } else if (reason === "changeTime") {
            changeTime = true
        }
    }, 100)
    while (!finished) {
        if (changeTime) {
            console.log(`检测到时间变动 暂退切换时间`)
            c.kb("esc")
            await sleep(1000)
            await checkPoolTime(currentPool)
            changeTime = false
        }
        c.mc(1444, 779)
        c.mc(1504, 794)
        await sleep(1000)
    }
    setStatus("substate", "退出钓鱼")
    while (true) {
        await sleep(500)
        const frame = c.cap()
        if (cc(frame, 51, 27, 0xffffff, 10)) {
            c.kb("esc")
            await sleep(2000)
        } else {
            break
        }
    }
    await sleep(1000)
}

async function waitF(t = 15000) {
    const timer = new Timer()
    while (timer.elapsed() < t) {
        await sleep(50)
        const frame = c.cap()
        const phash = perceptualHash(frame.roi(955, 442, 14, 16))
        const matched = matchHammingHash(phash, ["a6a69e19631c69e2"], 10) >= 0
        if (matched) {
            return true
        }
    }
    return false
}

async function main() {
    // 检查是否已经在钓鱼界面
    const frame = c.cap()
    const time = identifyTime(frame)
    if (time || cc(frame, 51, 27, 0xffffff, 10)) {
        await fishLoop()
    } else {
        if (config.startPoint) {
            await gotoStartPoint()
            await checkPoolTime("枯荣阁")
            await checkLure()
            await fishLoop()
        }
    }
    const targets = config.startPoint ? config.pools.filter(v => v !== "枯荣阁") : config.pools
    for (const pool of targets) {
        await changePool(pool)
        await checkPoolTime(pool)
        await checkLure()
        await fishLoop()
    }
}

main()
