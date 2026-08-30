// ==UserScript==
// @id -
// @name 1左键连点
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/08/17 19:17
// ==/UserScript==


import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("Yuanshen.exe"),{resize:false})


async function main() {
    await sleep(300)
    await c.play("+0(L #0.1)")
}

main()
