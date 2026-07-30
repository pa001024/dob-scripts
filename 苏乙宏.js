// ==UserScript==
// @id HsQ8pekG7R
// @name 苏乙宏
// @description -
// @author pa
// @version 1.0.0
// @category 宏
// @date 2026/04/07 23:54
// ==/UserScript==

// 热键: XButton1
// 生效条件: ahk_exe EM-Win64-Shipping.exe
// 按住循环: ✅

const f = () => {
    mm(300, 0)
}
async function main() {
    const t = setInterval(f, 5)
    mc("right")
    await sleep(200)
    mc()
    await sleep(300)
    clearInterval(t)
}
main()
