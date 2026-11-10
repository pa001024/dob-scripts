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
// const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

// setInterval(v=>{
//     c.kb("i")
// }, 30e3)
async function main() {
    let i = 1
    while(1) {
        console.log(i++)
        await sleep(1)
    }
}

main()
