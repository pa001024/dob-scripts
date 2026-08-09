// ==UserScript==
// @id -
// @name 1
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/08/06 14:08
// ==/UserScript==
import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

async function main() {
    let a = c.play("+0(e0.2 R0.1 d0.5 M #1)")
    await sleep(5000)
    a.stop()
    console.log("wanle")
    await sleep(3000)
    console.log("end")
}

main()
