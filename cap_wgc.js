// ==UserScript==
// @id -
// @name cap_wgc
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/2/15
// ==/UserScript==

async function main() {
    const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
    if (!hwnd) {
        console.log("未找到窗口")
        //   throw new Error("未找到窗口");
    }
    setForegroundWindow(hwnd)
    await sleep(100)
    while (hwnd === getForegroundWindow()) {
        const frame = captureWindowWGC(hwnd)

        // const roi = await selectroi("img", frame)
        // if (!roi) {
        //     console.log("未选择ROI")
        //     return
        // }
        // console.log(roi)
        // const [x, y, w, h] = roi
        // const roiMat = frame.roi(x, y, w, h)
        const roiMat = frame.roi(30, 35, 178, 178)
        // const roiMat = imread("roi.png")
        // await imshow("img", roiMat)
        const rotation = predictRotation(roiMat)
        imwrite("roi.png", roiMat)
        console.log(rotation)
        await sleep(500)
    }
}

main()
