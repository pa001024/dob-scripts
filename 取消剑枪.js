// ==UserScript==
// @id -
// @name 取消剑枪
// @description 双枪取消枪宏
// @author pa
// @version 1.0.0
// @category 宏
// @date 2026/03/02 00:26
// ==/UserScript==

// 热键: XButton1
// 生效条件: ahk_exe EM-Win64-Shipping.exe
// 按住循环: ✅

import { Cap } from "cap"
// import { findYellow } from "./findyp.js"

const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

async function main(){
    await c.play("+0(ML0.2 #0.1 R0.2 #0.1)")
    // await c.play("L(1522,127)")
}
main()