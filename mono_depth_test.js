// ==UserScript==
// @id -
// @name mono_depth_test
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/3/11 04:12:13
// ==/UserScript==

const inputPath = "imgs/cap31.png"
const outputPath = "imgs/cap31_mono_depth.png"

const image = imread(inputPath)
console.time("1")
const depth = monoDepth(image)
console.timeEnd("1")
imshow(outputPath, depth)
console.log(outputPath)
