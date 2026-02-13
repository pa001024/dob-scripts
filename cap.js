const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe");
if (!hwnd) {
  console.log("未找到窗口");
  throw new Error("未找到窗口");
}
checkSize(hwnd)

async function main() {
  let i = 430;
  while (true) {
    const img = captureWindow(hwnd);
    imwrite(img, `imgs/cap${i}.png`);
    console.log(`imgs/cap${i}.png`)
    await sleep(1000);
    i++;
  }
}
main();
