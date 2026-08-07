// ==UserScript==
// @id iavUWdeN9g
// @name 问号jjb
// @description 转圈丢e
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/07/30 20:23
// ==/UserScript==

import { Cap } from "cap"
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

const config = {
    /** @type {ROI} */ mainLoc: [290, 169, 1020, 514],
    debug: readConfig("debug", "", "boolean", false),
}
/** 找颜色 @param {Mat} img 窗口截图 */
function findYP(img, threshold = 20) {
    const xOffset = config.mainLoc[0]
    const yOffset = config.mainLoc[1]
    const roi = img.roi(...config.mainLoc)
    const filtered = colorFilter(roi, [0xffd984, 0xc28334, 0xf0e084], threshold)
    const closed = morphologyEx(filtered, "close", 4)
    const contours = findContours(closed, 100).filter(c => c.area < 420 && c.bbox[2] < 28 && c.bbox[3] < 28)
    for (const t of contours) {
        const door = roi.roi(...t.bbox)
        let match = -1
        const doorf = colorFilter(door, [0xffffc5], 20)
        const chars = segmentChars(doorf).map(v => doorf.roi(...v))
        if (chars.some(v => matchHammingHash(perceptualHash(v), ["4bccf9360638d998"]) >= 0)) {
            match = 0
        }
        if (match !== -1) {
            const m = {
                center: [t.center[0] + xOffset, t.center[1] + yOffset],
                bbox: [t.bbox[0] + xOffset, t.bbox[1] + yOffset, t.bbox[2], t.bbox[3]],
                door,
            }
            const windowCenter = [xOffset + config.mainLoc[2] / 2, yOffset + config.mainLoc[3] / 2]
            const dx = m.center[0] - windowCenter[0]
            const dy = m.center[1] - windowCenter[1]
            const dyi = (dy * 496) / 239 // 椭圆转圆形
            const deg = Math.atan2(dy, dx) * (180 / Math.PI)
            const distance = Math.hypot(dx, dyi)
            if (config.debug) drawBorder(c.hwnd, m.bbox[0], m.bbox[1] + 30, m.bbox[2], m.bbox[3])
            // console.log(`dx: ${dx.toFixed(2)}, dy: ${dy.toFixed(2)}, 角度: ${deg.toFixed(2)}, 距离: ${distance.toFixed(2)}m`)
            return {
                match: m,
                dx,
                dy,
                angle: (deg + 90 + 360) % 360,
                distance,
                out: distance > 420,
            }
        }
    }
}

async function main() {
    while (true) {
        if (cc(c.cap(), 47, 26, 0xffffff, 10)) {
            await c.play("d0.5eM")
        } else {
            c.mc(928, 630)
        }
        await sleep(100)
    }
}
main()
