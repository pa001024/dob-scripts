import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))
async function main() {
    c.kb("c")
    await sleep(890)
    c.mc(43, 257)
    await sleep(300)
    c.mc(1398, 767)
    await sleep(300)
    c.mc(51, 163)
    await sleep(300)
    c.mc(1398, 767)
    await sleep(300)
    c.kb("esc")
}
main()
