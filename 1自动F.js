// ==UserScript==
// @id -
// @name 1自动F
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/08/26 03:25
// ==/UserScript==


import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("Yuanshen.exe"),{resize:false})
async function main() {
    const h = getForegroundWindow()
    await sleep(200)
    while (true) {
        await c.play("f L")
        await sleep(20)
    }
}
main()
