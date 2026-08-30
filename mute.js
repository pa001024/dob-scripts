// ==UserScript==
// @id HRo0FL46-S
// @name mute
// @description 静音进程
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/07/30 21:35
// ==/UserScript==

const enable = readConfig("静音", "静音进程 仅影响单个程序 不勾选取消静音", "boolean", true)
const mute = readConfig("进程名", "需要静音的进程", "string", "EM-Win64-Shipping.exe")

setProgramVolume(mute, enable ? 0 : 1)
setConfig("静音", !enable)
moveWindow(getWindowByProcessName("EM-Win64-Shipping.exe"), 0, 0)

