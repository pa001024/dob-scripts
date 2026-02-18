// ==UserScript==
// @id AtYSdwCjb4
// @name mute
// @description 静音进程
// @author pa
// @version 1.0.0
// @category 其他
// @date 2026/2/18 12:18:44
// ==/UserScript==

const enable = readConfig("静音", "静音进程 仅影响单个程序 不勾选取消静音", "boolean", true)
const mute = readConfig("进程名", "需要静音的进程", "string", "EM-Win64-Shipping.exe")

setProgramVolume(mute, enable ? 0 : 1)
