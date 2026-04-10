// fatal runtime error: Rust cannot catch foreign exceptions, aborting
// error: process didn't exit successfully: `target\debug\dna-builder.exe` (exit code: 0xc0000409, STATUS_STACK_BUFFER_OVERRUN)

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe")
let roi = captureWindowWGC(hwnd, 0, 30, 1600, 900)
const color = "0xffffff"
roi = colorFilter(roi, [+color], 30)
