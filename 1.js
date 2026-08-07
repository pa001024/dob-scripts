// ==UserScript==
// @id -
// @name 1
// @description -
// @author anonymous
// @version 1.0.0
// @category 其他
// @date 2026/08/06 14:08
// ==/UserScript==
import { Cap } from "cap"
initOcr()
const c = new Cap(getWindowByProcessName("EM-Win64-Shipping.exe"))
const roi = c.frame.roi(1049, 160, 332, 499)
export default ocrText(roi)
