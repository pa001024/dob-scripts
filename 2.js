// ==UserScript==
// @id -
// @name 2
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/3/13 18:20:31
// ==/UserScript==

const hwnd = getCGWindow()
console.log(hwnd)
async function main() {
    // cgClick(803, 788)
    // cgMove(200, 0)
    cgKey("space", 500)
    const frame = captureWindowWGC(hwnd)
    imshow("img", frame)
}

main()
