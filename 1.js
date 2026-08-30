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
const c = new Cap(getWindowByProcessName("Yuanshen.exe"), { resize: false, yOffset: 0 })

// setInterval(v=>{
//     c.kb("i")
// }, 30e3)
async function main() {
    while (1) {
        await c.play("+1(e L0.1 #0.5)")
        // mc(0, 972, 686 + 50)
        // await sleep(100)
        // mc(0, 991, 1006 + 50)
        // await sleep(500)
    }
}

main()
