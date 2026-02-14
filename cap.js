// ==UserScript==
// @id -
// @name cap
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/2/14
// ==/UserScript==

const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe");
if (!hwnd) {
  console.log("未找到窗口");
  throw new Error("未找到窗口");
}
checkSize(hwnd)

async function main() {
  let i = 432;
  while (true) {
    const img = captureWindow(hwnd);
    imwrite(img, `imgs/cap${i}.png`);
    console.log(`imgs/cap${i}.png`)
    await sleep(1000);
    i++;
  }
}
main();
