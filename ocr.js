// ==UserScript==
// @id -
// @name ocr
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/2/18 16:13:33
// ==/UserScript==

async function main() {
    initOcr() // 初始化ocr模块
    const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
    const img = captureWindow(hwnd)
    console.time("ocr")
    const text = await ocrText(img)
    console.timeEnd("ocr")
    console.log(text)
}
main()
