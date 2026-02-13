// const hwnd = getWindowByProcessName("EM-Win64-Shipping.exe");
// if (!hwnd) {
//   console.log("未找到窗口");
//   throw new Error("未找到窗口");
// }
// checkSize(hwnd);

const tpls = {
  skill: imread("imgs/skill.png"),
};

/**
 * 检查技能状态
 * @param {Mat} img 窗口截图
 */
function checkSkill(img) {
  const skill_orb = [
    cc(img, 1437, 810, 0xececed, 10),
    cc(img, 1433, 811, 0xececed, 10),
    cc(img, 1439, 819, 0xececed, 10),
    cc(img, 1439, 819, 0xececed, 10),
    cc(img, 1445, 816, 0xececed, 10),
  ]
    .map((v) => (v ? "1" : "0"))
    .join("");

  //   console.log(skill_orb);
  switch (skill_orb) {
    case "01111":
      return 3;
    case "10110":
      return 0;
    case "00001":
      return 1;
  }

  return -1;
}

/**
 * 找门
 * @param {Mat} img 窗口截图
 */
function findDoor(img) {
  // x: 290~1188
  // y: 168~616
  // 滤色 : #EB3A43 #FFD772 #868DFF
}

async function main() {
  let i = 1;
  const test = [213, 221, 230];
  // while (true) {
  //   const img = captureWindow(hwnd);
  //   imwrite(img, `imgs/cap${i}.png`);
  //   console.log(`imgs/cap${i}.png`);
  //   await sleep(1000);
  //   i++;
  // }
  while (true) {
    // const img = captureWindow(hwnd);
    const file = `imgs/cap${i++}.png`;
    const img = imread(file);
    const skill = checkSkill(img);
    console.log(file, skill);
    await sleep(1000);
  }
  for (let im of test) {
    const img = imread(`imgs/cap${im}.png`);
    const skill = checkSkill(img);
    console.log(skill);
  }
}
main();
