// ==UserScript==
// @id iavUWdeN9g
// @name 菲娜灾厄
// @description 流浪的蔷薇无限插地流
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/08/05 10:24
// ==/UserScript==

import { Cap } from "cap"
// import { findYellow } from "./findyp.js"

const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

const mode = readConfig("模式", "选择", { type: "select", options: ["登龙", "插地", "黎瑟", "芙罗拉"] }, "登龙")
/** @type Record<string,string> */
const t = {
    登龙: "+2(L0.1)L1.5",
    插地: "+3(L0.1)L0.4",
    黎瑟: "e0.2R0.1#1",
    芙罗拉: "e0.1#0.2L1",
}
const code = t[mode]

async function main() {
    const qtimer = new Timer()
    while (true) {
        if (cc(c.cap(), 47, 26, 0xffffff, 10)) {
            if (qtimer.elapsed() > 5e3) {
                await c.play(mode === "黎瑟" || mode === "芙罗拉" ? "z" : "qz")
                qtimer.reset()
            }
            await c.play(code)
        } else {
            c.mc(926,616)
        }
        await sleep(200)
    }
}
main()
