// ==UserScript==
// @id -
// @name cc
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/2/17
// ==/UserScript==

/** @param {number} v */
function rgbStr(v) {
    return `0x${v.toString(16).padStart(6, "0")}`
}

/**
 * 检查状态
 * @param {Mat} frame 窗口截图
 */
function checkState(frame) {
    // #8FD19E
    if ((cc(frame, 1557, 32, 0xffffff, 10) && !cc(frame, 1560, 36, 0xffffff, 10)) || cc(frame, 126, 859, 0x8fd19e, 10)) {
        // #FFFFC5
        if (frame.find_color(44, 270, 4, 0xffffc5, 10, "ttb")) {
            if (cc(frame, 86, 249, 0xffffff, 10) || cc(frame, 47, 327, 0xffffff, 10)) {
                return "door" // 继续探索
            } else {
                if (cc(frame, 531, 59, 0x000000, 10) && cc(frame, 1080, 60, 0x000000, 10)) {
                    return "boss" // BOSS
                }
                if (cc(frame, 767, 819, 0x000000, 10) && cc(frame, 800, 745, 0x000000, 10)) {
                    return "dead" // 死了
                }
                return "event" // 奇遇
            }
        }
        // #eb3a43
        if (cc(frame, 42, 277, 0xeb3a43, 10)) {
            if (cc(frame, 93, 310, 0xffffff, 10)) {
                return "battle" // 战斗
            }
            return "event" // 战斗
        }
        return "normal"
    }
    // #FFFEBC
    if (cc(frame, 26, 26, 0xfffebc, 10) && cc(frame, 1408, 875, 0x000000, 10)) {
        return "esc" // 退出
    }
    // #dddfe0
    if (cc(frame, 800, 860, 0xdddfe0, 10)) {
        return "buff" // 弹窗
    }
    // #ffffff
    if (cc(frame, 800, 224, 0xffffff, 10) && cc(frame, 781, 234, 0x000000, 10)) {
        return "buff" // 弹窗
    }

    if (cc(frame, 1263, 45, 0xffffff, 10)) {
        return "shop" // 商店
    }
    // #8FD19E
    if (cc(frame, 640, 850, 0x8fd19e, 10)) {
        return "paotai" // 炮台
    }
    // #FBFBFB
    if (cc(frame, 1116, 817, 0xfbfbfb, 10)) {
        return "esc" // 退出
    }
    // #870200
    if (cc(frame, 56, 17, 0x870200, 10) && cc(frame, 1395, 874, 0x000000, 10)) {
        return "esc" // 退出
    }
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
    function getState(points) {
        switch (points) {
            case "01110000010":
            case "11110000010":
            case "11111000010":
            case "10101000110":
            case "11101000110":
                return "zuoguai"
            case "00000111001":
                return "paotai_reset" // 炮台背面
            case "00010111011":
            case "00010111111":
                return "paotai" // 炮台正面
            case "00000000011":
                return "bossfang"
            default:
                return "unknown"
        }
    }
    const state = getState(points)
    // setStatus("map", `${state}: ${points}`)
    console.log(`${state}: ${points}`)
    return state
}
const tests = [
    // door
    // 93, 91,
    // // buff
    // 118, 75, 173,
    // // shop
    // 101, 103,
    // // unknown
    // 105, 106,
    // // end
    // 430,
    // // esc
    // 434, 436,
    // // event-door
    // 446, 329,
    // // prebattle
    // 242,
    // // preboss
    // 332,
    // // boss
    // 335,
    // // battle
    // 259, 447,
    // // dead
    // 448,
    // esc
    // 437, 449,
    // map test
    // 110,
    450, 451, 452, 455, 332,
    //
    456, 457, 139, 458, 459, 460,
]

async function main() {
    for (const test of tests) {
        const cap = imread(`imgs/cap${test}.png`)
        console.log(test, checkState(cap), checkMap(cap))
    }
    // for (let i = 144; i < 400; i++) {
    //     const cap = imread(`imgs/cap${i}.png`)
    //     console.log(i, checkState(cap), checkMap(cap))
    //     await sleep(1000)
    // }
}

main()
