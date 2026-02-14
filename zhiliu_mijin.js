const config = {
    门顺序: ["黄", "蓝", "红"],
}

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd) {
    console.log("未找到窗口")
    //   throw new Error("未找到窗口");
}
checkSize(hwnd)

const tpls = {
    // skill: imread("imgs/skill.png"),
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
        case "01111": // 龙
            return 2
        case "00110": // BUFF
            return 1
        case "00001": // 剑
            return 3
    }

    return -1
}

/**
 * 找门
 * @param {Mat} img 窗口截图
 */
function findDoor(img) {
    // x: 290~1312 y: 168~681
    const xOffset = 290
    const yOffset = 168
    const roi = img.roi(xOffset, yOffset, 1312 - xOffset, 681 - yOffset)
    // 滤色 : #EB3A43 #FFD772 #868DFF
    const colors = [0xeb3a43, 0xffd772, 0x868dff]
    const filtered = colorFilter(roi, colors, 10)
    // const closed = morphologyEx(filtered, "close", 5)
    // const dilated = morphologyEx(closed, "open", 2)
    const contours = findContours(filtered, 100)
    // imwrite(filtered, "imgs/filtered.png")
    /** @type {{center: [number, number], bbox: [number, number, number, number], color: string}[]} */
    const matches = []
    for (const c of contours) {
        if (c.area > 400) continue
        const door = roi.roi(...c.bbox)
        const match = colorKeyMatch(door, colors, 50, 10)
        if (match !== -1) {
            matches.push({
                center: [c.center[0] + xOffset, c.center[1] + yOffset],
                bbox: [c.bbox[0] + xOffset, c.bbox[1] + yOffset, c.bbox[2], c.bbox[3]],
                color: ["红", "黄", "蓝"][match],
            })
        }
    }
    for (const color of config.门顺序) {
        const match = matches.find(v => v.color === color)
        if (match) {
            return match
        }
    }
}
/**
 * 使用技能
 * @param {Mat} frame 窗口截图
 * @param {'q'|'q1'|'q2'|'Q2'|'q3'|'z'} skill 技能编号
 */
async function useSkill(frame, skill) {
    let currentSkill = checkSkill(frame)
    /** @param {"long" | "short"} type 长E或短E */
    async function useSkillEAndCheck(type) {
        console.log(`useSkillEAndCheck(${type})`)
        await kb(hwnd, "e", type === "long" ? 800 : 10)
        await sleep(type === "long" ? 1500 : 400)
        // 更新画面
        frame = captureWindow(hwnd)
        currentSkill = checkSkill(frame)
    }
    while (checkStop()) {
        switch (skill) {
            case "q":
                await kb(hwnd, "q", 10)
                return true
            case "q1":
                if (currentSkill !== 1) await useSkillEAndCheck("long")
                if (currentSkill !== 1) await useSkillEAndCheck("long")
                if (currentSkill === 1) {
                    await kb(hwnd, "q", 10)
                    await sleep(2000)
                    return true
                }
                break
            case "q2":
                if (currentSkill !== 2 && currentSkill !== 3) await useSkillEAndCheck("short")
                if (currentSkill !== 2) await useSkillEAndCheck("long")
                if (currentSkill === 2) {
                    await kb(hwnd, "q", 10)
                    await sleep(3000)
                    return true
                }
                break
            case "Q2":
                if (currentSkill !== 2 && currentSkill !== 3) await useSkillEAndCheck("short")
                if (currentSkill !== 2) await useSkillEAndCheck("long")
                if (currentSkill === 2) {
                    await kb(hwnd, "q", 500)
                    await sleep(3000)
                    return true
                }
                break
            case "q3":
                if (currentSkill !== 3) await useSkillEAndCheck("short")
                if (currentSkill !== 3) await useSkillEAndCheck("short")
                if (currentSkill === 3) {
                    await kb(hwnd, "q", 10)
                    await sleep(2000)
                    return true
                }
                break
            case "z":
                await kb(hwnd, "z", 10)
                return true
        }
        await sleep(200)
        frame = captureWindow(hwnd)
        currentSkill = checkSkill(frame)
    }
}
async function doge() {
    // 原地二段跳
    await kb(hwnd, "space", 100)
    await sleep(500)
    await kb(hwnd, "space", 100)
    await sleep(500)
}

/**
 * 检查状态
 * @param {Mat} frame 窗口截图
 */
function checkState(frame) {
    if (cc(frame, 46, 276, 0xfffd98, 10)) {
        return "door"
    }
    return "battle"
}

async function battleLoop() {
    let state = "init"
    const i = 0
    while (checkStop()) {
        const frame = captureWindow(hwnd)
        state = checkState(frame)
        // console.log(`checkState: ${state} ${++i}`)
        switch (state) {
            case "door": {
                // console.time("findDoor")
                const door = findDoor(frame)
                // console.timeEnd("findDoor")
                if (door) {
                    console.log(`findDoor: ${i}`, door.center, door.bbox, door.color)
                    drawBorder(hwnd, ...door.bbox)
                } else {
                    console.log("未找到门")
                }
                break
            }
            case "battle":
                console.log("useSkill(q2)")
                await useSkill(frame, "q2")
                await doge()
                break
        }
        await sleep(5)
    }
}

async function main() {
    setForegroundWindow(hwnd)
    await sleep(100)
    await battleLoop()
    if ("1".includes("1")) return
    let i = 431
    const test = [135, 213, 221, 230]
    // while (true) {
    //   const img = captureWindow(hwnd);
    //   imwrite(img, `imgs/cap${i}.png`);
    //   console.log(`imgs/c
    //   i++;
    // }
    while (checkStop()) {
        // break
        // const img = captureWindow(hwnd);
        const file = `imgs/cap${i++}.png`
        const img = imread(file)
        const skill = checkSkill(img)
        console.log(file, skill)
        await sleep(1000)
    }
    console.time("findDoor")
    for (const im of test) {
        const img = imread(`imgs/cap${im}.png`)
        // const skill = checkSkill(img)
        // console.log(skill)
        const doors = findDoor(img)
        console.log(JSON.stringify(doors))
        break
    }
    console.timeEnd("findDoor")
}
main()
