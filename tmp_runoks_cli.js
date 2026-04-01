async function main() {
    const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
    if (!hwnd || !isElevated()) throw new Error("未找到窗口或非管理员权限")
    checkSize(hwnd)
    await runoks(hwnd, "jjb")
}

main().catch(error => {
    console.error(error)
    throw error
})
