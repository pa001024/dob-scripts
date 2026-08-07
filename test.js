// ==UserScript==
// @id -
// @name test
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/08/01 16:45
// ==/UserScript==

import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))
async function main() {
    while (true) {
        c.cap()
          console.error(`${new Date().toTimeString()} 超时`)
        await sleep(100)
    }
}
main()
