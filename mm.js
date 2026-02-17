const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd) {
    console.log("未找到窗口")
    // throw new Error("未找到窗口");
}
checkSize(hwnd)
setForegroundWindow(hwnd)
async function getR() {
    const frame = captureWindowWGC(hwnd)
    const roiMat = frame.roi(21, 33, 186, 186)
    const rotation = predictRotation(roiMat)
    return rotation
}

async function main() {
    await sleep(100)
    // const i = 0
    // mt()
    // await sleep(500)
    // const init = await getR()
    // while (hwnd === getForegroundWindow()) {
    //     // mm(1, 0)
    //     // i++
    //     // if ((await getR()) === init) {
    //     //     console.log(i)
    //     //     console.log("旋转完成")
    //     // }
    //     // await sleep(5)
    //     mm((2057 * 90) / 360, 0)
    //     await sleep(500)
    // }
    const r0 = await getR()
    mm(100, 0)
    const r1 = await getR()
    console.log(r0, r1)
}
main()
