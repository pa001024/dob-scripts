// ==UserScript==
// @id -
// @name lr
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/2/18 23:10:45
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
checkSize(hwnd)
async function main() {
    // const left = captureWindowWGC(hwnd)
    // imwrite("left.png", left)
    // await kb(hwnd, "d", 100)
    // const right = captureWindowWGC(hwnd)
    // imwrite("right.png", right)

    const left = imread("left.png")
    const right = imread("right.png")
    console.time("time")
    const result = predictDepth(left, right, 160, 3, 800, 1)
    console.timeEnd("time")
    console.log(result.directions)
    imshow(
        "result",
        drawContours(
            result.depth,
            result.directions.map(v => [v[0] - 5, v[1] - 5, 10, 10])
        )
    )
}
main()
