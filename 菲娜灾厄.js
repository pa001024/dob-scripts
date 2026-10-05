// ==UserScript==
// @id iavUWdeN9g
// @name 菲娜灾厄
// @description 流浪的蔷薇无限插地流
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/09/25 22:48
// ==/UserScript==

import { Cap } from "cap"
// import { findYellow } from "./findyp.js"

const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

const mode = readConfig("模式", "选择", { type: "select", options: ["登龙", "插地", "黎瑟", "伊薇", "芙罗拉", "芙罗拉扶疏", "芙罗拉对单", "利兹贝尔", "法露茜"] }, "登龙")
/** @type Record<string,string> */
const t = {
    登龙: "+2(L0.1)L1.5 z",
    插地: "+3(L0.1)L0.4 z",
    黎瑟: "e0.2R0.1#1",
    伊薇: "w0 e0.2 w^ #0.3 s0 e0.2 s^ M #0.5 R0.1 #0.5 z",
    芙罗拉: "M e0.1#0.2 M L1 M",
    芙罗拉对单: "M e0.1#0.2 +3(ML0.2) L1 +4(ML0.2) L1 M",
    芙罗拉扶疏: "e0.1L0.9",
    利兹贝尔: "M +10(M L0.3 #1.01) z",
    法露茜: "q1 M +4(L0.2R0.2#0.1) z e0.2"
}
const code = t[mode]

async function main() {
    const qtimer = new Timer()
    while (true) {
        if (cc(c.cap(), 47, 26, 0xffffff, 10)) {
            if (qtimer.elapsed() > 5e3) {
                await c.play(mode === "登龙" || mode.includes("插地") ? "qz" : "z")
                qtimer.reset()
            }
            await c.play(code)
        } else {
            c.mc(1071,557)
            await sleep(200)
        }
        await sleep(0)
    }
}
main()
