const img = imread("test.png")
const t = img.get_rgb(11, 9)?.toString(16).padStart(6, "0")
console.log(t, img.cols(), img.rows())
