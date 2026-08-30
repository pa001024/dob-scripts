// ==UserScript==
// @id CohVQ856GT
// @name 调停
// @description 苏乙自动调停
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/08/18 12:54
// ==/UserScript==

import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

/** @param {Mat} frame  */
function checkState(frame) {
    if (cc(frame, 45, 26, 0xffffff, 10)) {
        if (cc(frame, 44, 273, 0xffffc8, 10)) {
            return "move"
        } else if (cc(frame, 45, 274, 0xff4d55, 10)) {
            return "battle"
        }
    } else {
        if (cc(frame, 1051, 795, 0xe1b454, 10)) {
            return "r"
        } else {
            if (cc(frame, 692, 736, 0xcfa64f, 10)) {
                return "select"
            } else {
                if (cc(frame, 1262, 575, 0x000000, 10)) {
                    return "space"
                }
            }
        }
    }
    return "unknown"
}

async function exitAction() {
    await c.play("{esc}#0.5 L(1471,833) #0.5 L(951,515) #2")
}

async function main() {
    let count = 0
    let moved = false
    while (true) {
        const state = checkState(c.cap())
        setStatus("state", state)
        switch (state) {
            case "r":
                console.log(`完成 ${++count} 次`)
                await c.play("r#0.3{space}#0.3{space}#0.3")
                moved = false
                break
            case "move":
                if (moved) {
                    await exitAction()
                    break
                }
                await c.play("#1.5 +2(L0.3#0.3) #0.4 a0.4 #0.5 +2(f#0.5) #0.8 q2.2 L2 z #3")
                moved = true
                break
            case "battle":
                await exitAction()
                break
            case "space":
                await c.kb("space")
                await sleep(500)
                break
            case "select":
            default:
                c.mc(759, 746)
                await sleep(500)
                break
        }
        await sleep(100)
    }
}
main()
