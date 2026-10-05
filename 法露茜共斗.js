// ==UserScript==
// @id ceVS8EbEGi
// @name 法露茜共斗
// @description 没细调 but it works
// @author pa
// @version 1.0.0
// @category 活动
// @date 2026/10/05 06:14
// ==/UserScript==

import { Cap } from "cap"

const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))

// initOcr()

const g = {
    /** @type ReturnType<checkState> */
    state: "unknown",
    ehp: 0,
    php: 0,
    stage: 0,
    debug: false,
}

/** @param {Mat} frame  */
function checkState(frame) {
    if (cc(frame, 46, 26, 0xffffff, 30)) {
        return "battle"
    } else {
        if (c.croi(c.frame.roi(649, 552, 14, 16), "625e93e4ec0b5354", 10)) {
            return "finish"
        } else {
            if (cc(frame, 1537, 880, 0x000000, 10)) {
                if (cc(frame, 1180, 769, 0xcbd3eb, 10)) {
                    return "enter"
                }
                if (cc(frame, 121, 509, 0xffde9e, 10)) {
                    return "room"
                }
                if (cc(frame, 114, 509, 0x717684, 10)) {
                    return "room_esc"
                }
            } else {
                if (cc(frame, 536, 63, 0xff3e3e, 10)) {
                    if (cc(frame, 522, 60, 0x000000, 10)) {
                        return "battle_lowhp"
                    }
                } else {
                    if (cc(frame, 1350, 206, 0xc79b99, 10)) {
                        return "x"
                    }
                }
            }
        }
    }
    return "unknown"
}

/** @param {Mat} roi  */
function numocr(roi) {
    const ct = [
        { k: "0", v: "4bd04b530f5b170e" },
        { k: "1", v: "3c38b0b0b3b3936c" },
        { k: "2", v: "f0a0a2b9b2a78dca" },
        { k: "3", v: "e5d0abb265c329c8" },
        { k: "4", v: "e56c336ccd989a48" },
        { k: "5", v: "04f02bf9b4531f0e" },
        { k: "6", v: "667cc55b3d985282" },
        { k: "6", v: "7516cdc99dd83222" },
        { k: "7", v: "330b6b4b1b370d68" },
        { k: "8", v: "0df6e1638dd02b0e" },
        { k: "9", v: "63cc9363c9720f2a" },
        { k: "", v: "52c956bbc336f00c" },
    ]
    const chasharr = ct.map(v => v.v)
    const filterd = colorFilter(roi, [0xfbfbbb], 100)
    const bboxs = segmentChars(filterd, 1, 2)
    const chars = bboxs.map(v => filterd.roi(...v))
    const hashs = chars.map(v => perceptualHash(v))

    if (g.debug) setStatus("roi", filterd)
    if (g.debug) setStatus("chars", chars, chars.map(v => perceptualHash(v)).join("\n"))
    const ret = hashs
        .map(v => {
            const r = matchHammingHash(v, chasharr, 30)
            return r >= 0 && ct[r].k !== "米" ? ct[r].k : ""
        })
        .join("")
    return ret
}

async function main() {
    let pe = false
    let count = 0
    const qcd = new Timer()
    const ecd = new Timer()
    setInterval(async () => {
        g.state = checkState(c.cap())
        setStatus("state", g.state)
        /**  @param {Mat} f @param {number} x @param {number} y @param {number} w @param {number} cc */
        const fp = (f, x, y, w, cc) => {
            const p = f.find_color(x, y, w, cc, 20, "ltr")
            if (!p) return 0
            return ((p[0] - x) * 100) / w
        }
        if (g.state.startsWith("battle")) {
            g.ehp = fp(c.frame, 536, 63, 537, 0x2d2d2d)
            g.php = fp(c.frame, 125, 863, 175, 0x394047)
        }
    }, 100)
    const timer = new Timer()
    while (true) {
        switch (g.state) {
            case "battle":
            case "battle_lowhp":
                const roi = c.frame.roi(60, 72, 24, 24)
                const s = +numocr(roi)
                if (s && s <= 10) {
                    if (s > g.stage && timer.elapsed() > 2e3) {
                        qcd.reset()
                        timer.reset()
                        await c.play("q#1.6 M w0>0.1w^ #0.3") // 追BOSS
                    }
                    g.stage = s
                    setStatus("stage", s)
                }
                if (g.php < 0.4) {
                    if (pe && qcd.elapsed() > 3e3) {
                        ecd.reset()
                        qcd.reset()
                        await c.play("M#0.1 _#0.3_#0.3 q#1.6 L #0.3e") // 小巧思 跳起来Q 然后砸地
                        pe = false
                    }
                    if (ecd.elapsed() > 1200) {
                        await c.play("Me0.05#0.05")
                        pe = true
                    }
                }
                await c.play("z+4(ML0.1#0.15) MR0.2")
                break
            case "room":
                // 剩余进度检测
                if (cc(c.frame, 121, 509, 0xffde9e, 10)) {
                    await c.play("L(940,742) #2")
                } else await c.play("{esc}")
                break
            case "room_esc":
                await c.play("{esc} #1 L(1190,775) #1")
                break
            case "enter":
                // 筛选并进房
                await c.play(
                    "L(839, 742) L(137,779)#0.4 L(644,671)#0.1 L(281, 377)#0.1 L(377, 381)#0.1 L(474, 376)#0.1 L(969,673)#0.4 L(1416,227)#0.1 L(1190,775)#0.5"
                ) // 铜币 红豆 JJB
                break
            case "finish":
                console.log(`Excellent! finished ${++count} times`)
                c.mc(839, 742)
                await sleep(2e3)
                break
            default:
            case "unknown":
                await sleep(1000)
                if (g.state === "unknown") c.mc(839, 742)
                break
        }
        await sleep(100)
    }
}
main()
