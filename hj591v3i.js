// ==UserScript==
// @id 0u3y7EUFHA
// @name hj591v3i
// @description -
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/3/30 23:47:31
// ==/UserScript==

// 止流(专武+攻击 狮鹫带极昼 1Q) 煜明(专武)扶疏(专武)
// 黎瑟(万古+攻击) 止流(专武)扶疏(专武)
// 煜明(专武+攻击) 止流(专武)扶疏(专武)
// 设置默认

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd)
initOcr()
let frame = captureWindowWGC(hwnd)
const config = {
    zhukong: readConfig("主控", "-", ["黎瑟", "止流", "煜明"], "止流"),
    zhiliu1: readConfig("Q次数2", "开始阶段放龙次数", "number", 0),
    zhiliu2: readConfig("Q延迟", "开始阶段放龙延迟", "number", 5000),
    zhiliu3: readConfig("E叠雷云", "开始前叠雷云", "boolean", false),
    skip: readConfig("跳过结算", "不记录分数", "boolean", false),
}

const gameState = {
    mp: 0,
    state: "unknown",
}

/** @param {Mat} frame */
function checkState(frame) {
    if (cc(frame, 46, 25, 0xffffff, 20)) {
        if (cc(frame, 44, 276, 0xeb3a43, 20)) {
            return "battle"
        } else {
            return "move"
        }
    } else {
        if (cc(frame, 576, 791, 0xe1b454, 20)) {
            return "finish"
        } else {
            if (cc(frame, 60, 704, 0x000000, 20)) {
                return "start"
            }
        }
    }
    return "unknown"
}

function checkStop() {
    return true
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
        await sleep(type === "long" ? 600 : 300)
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
                const ok = await pressQUntilMpReduced(10, 3e3)
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

/** @param {Mat} frame  */
function getMP(frame) {
    const roi = frame.roi(1303, 859, 243, 4)
    const p = roi.find_bright(243, 2, 243, 180, 0, ">", "rtl")
    const p2 = roi.find_bright(0, 2, 243, 180, 0, "<", "ltr")
    const mp = p ? Math.round(p[0] / 2.42) : 0
    const mp2 = p2 ? Math.round(p2[0] / 2.42) : 100
    const mpf = mp2 >= mp && mp2 - mp <= 2 ? mp2 : 0
    return mpf
}

async function battleLoop() {
    switch (config.zhukong) {
        case "煜明":
            for (let c = 0; c < 4; c++) {
                await useSkill("q")
                await sleep(200)
                await kb(hwnd, "e")
                await sleep(200)
                mc(hwnd)
                await sleep(500)
                await kb(hwnd, "shift", 100)
                await sleep(300)
                await kb(hwnd, "s", 100)
                mt(hwnd)
            }
            break
        case "止流":
            while (gameState.state === "battle") {
                mt(hwnd)
                if (frame.get_hsl(790, 822)[2] < 0.7) {
                    await useSkill("q2")
                    await sleep(200)
                } else {
                    await useSkill("q3")
                    await sleep(100)
                }
            }
            break
        case "黎瑟":
            for (let c = 0; c < 4; c++) {
                await kb(hwnd, "e")
                await sleep(200)
                mc(hwnd, "right")
                await sleep(400)
                await kb(hwnd, "d", 100)
                mt(hwnd)
                await sleep(400)
            }
            break
    }
}

async function move4() {
    await kb(hwnd, "4")
    await sleep(600)
    mc(hwnd)
    await sleep(400)
}
async function moveLoop() {
    await sleep(1000)
    mt(hwnd)
    await move4()
    await move4()
    await move4()
    switch (config.zhukong) {
        case "止流":
            // 叠雷云
            if (config.zhiliu3) {
                for (let i = 0; i < 6; i++) {
                    await kb(hwnd, "e", 100)
                    await sleep(400)
                }
                await prepareSkill("q2")
                await sleep(400)
            }
            await prepareSkill("q2")
            await sleep(300)
            await kb(hwnd, "space") // 蹦哒
            await sleep(300)
            await kb(hwnd, "space")
            await sleep(450)
            await kb(hwnd, "q") // 黑龙
            await sleep(5000)
            mt(hwnd)
            await sleep(200)
            mc(hwnd)
            await sleep(400)
            await move4()
            for (let i = 0; i < config.zhiliu1; i++) {
                await kb(hwnd, "q")
                await sleep(config.zhiliu2)
            }
            await kb(hwnd, "z", 100)
            break
        case "黎瑟":
        case "煜明":
            await move4()
            await kb(hwnd, "q")
            await sleep(1400)
            await move4()
            break
    }
}

let i = 0
let last = new Timer()
let max = 0
async function handleFinish(skip = false) {
    if (!skip) {
        let roi = frame.roi(724, 381, 147, 55)
        let text = +ocrText(roi)
        const timer = new Timer()
        while (isNaN(text) || !text) {
            await sleep(300)
            roi = frame.roi(724, 381, 147, 55)
            text = +ocrText(roi)
            if (timer.elapsed() > 3e3) break
        }
        if (text) {
            if (text > max) {
                console.log(`第${++i}次, 新纪录: ${text} 用时: ${Math.ceil(last.elapsed() / 1e3)}s`)
            } else {
                console.log(`第${++i}次, 分数: ${text} 最高: ${max} 用时: ${Math.ceil(last.elapsed() / 1e3)}s`)
            }
            max = Math.max(text, max)
            last.reset()
        }
        mc(hwnd, 674, 792)
        await sleep(2000)
    } else {
        console.log(`第${++i}次, 用时: ${Math.ceil(last.elapsed() / 1e3)}s`)
        last.reset()
    }
}
async function main() {
    setInterval(() => {
        frame = captureWindowWGC(hwnd)
        gameState.mp = getMP(frame)
        gameState.state = checkState(frame)
    }, 100)
    let moved = false
    while (true) {
        setStatus("state", gameState.state)
        switch (gameState.state) {
            case "unknown":
                if (config.skip) {
                    mc(hwnd, 674, 792)
                    moved = false
                }
                break
            case "finish":
                if (config.skip) {
                    mc(hwnd, 674, 792)
                } else {
                    await handleFinish()
                }
                moved = false
                break
            case "battle":
                await battleLoop()
                break
            case "move":
                if (moved) {
                    await battleLoop()
                } else {
                    await moveLoop()
                    if (config.skip) {
                        handleFinish(true)
                    }
                }
                moved = true
                break
            case "start":
                mc(hwnd, 1370, 812)
                await sleep(1000)
                break
        }
        await sleep(100)
    }
}
main()
