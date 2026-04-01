// ==UserScript==
// @id -
// @name mono_depth_test
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/3/23 18:07:55
// ==/UserScript==

const hwnd = getCGWindow() || getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd) throw new Error("未找到窗口")
checkSize(hwnd)
initMonoDepth()
const inputPath = "imgs/cap845.png"
const outputPath = "imgs/mono_depth.png"

async function main(){
    // const image = imread(inputPath)
    const image = captureWindowWGC(hwnd)
    for (let i =0;i<0;i++) {
        console.time("1")
        const depth = await monoDepth(image)
        console.timeEnd("1")
    }
    const depth = await monoDepth(image)
    imshow(outputPath, depth)
    // console.log(outputPath)
}
main()