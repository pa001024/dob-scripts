const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
if (!hwnd || !isElevated()) {
    throw new Error("未找到窗口或非管理员权限")
}
checkSize(hwnd)

async function sroi() {
    const frame = captureWindowWGC(hwnd)
    const result = await selectroi("roi", frame)
    if (!result) return
    // copyText(`frame.roi(${result.join(", ")})`)
    console.log(result)
    const phash = perceptualHash(frame.roi(...result))
    console.log(phash)
    const text = `matchHammingHash(perceptualHash(frame.roi(${result.join(", ")})), ["${phash}"], 10) >= 0`
    console.log(text)
    copyText(text)
}

async function main() {
    await sroi()
}

main()
