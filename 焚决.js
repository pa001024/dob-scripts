// ==UserScript==
// @id pYoG8QfScV
// @name 焚决
// @description 风险自负
// @author pa
// @version 1.0.1
// @category 其他
// @date 2026/04/23 14:40
// ==/UserScript==

// 除等级上限和波次倒计时外需重启游戏
// 请自行承担风险
// 请自行承担风险
// 请自行承担风险
// 请自行承担风险
// 请自行承担风险
// 请自行承担风险
// 请自行承担风险

const cfg = {
    baseDir: readConfig("gameDir", "游戏目录", "string", ""),
}

const patches = [
    {
        id: "33204fe0e1b8ea3f9bd1e0da07d5892277b9da54",
        name: "等级上限和波次计时",
        enable: readConfig("等级上限和波次计时", "", "bool", false),
        files: ["Script/Datas/GlobalConstant.lua"],
    },
    {
        id: "9715312c6a2496889ccaecf3d6149294d4461601",
        name: "100m贪吃",
        enable: readConfig("100m贪吃", "拾取范围+100m", "bool", false),
        files: ["Script/BluePrints/Combat/Components/CharacterInitLogic.lua"],
    },
    {
        id: "e6fb41b1a3066622ec2ec233457a97b7768eceba",
        name: "巧手",
        enable: readConfig("巧手", "巧手始终生效", "bool", false),
        files: ["Script/BluePrints/Item/MiniGame/BP_MiniGame_C.lua"],
    },
    {
        id: "1e8dd06fa2135b2fbe3a596482cc2aae43af5cf6",
        name: "悠闲",
        enable: readConfig("悠闲", "悠闲始终生效", "bool", false),
        files: ["Script/BluePrints/UI/WBP/Angling/PC/WBP_Angling_Panel_P.lua"],
    },
    {
        id: "e8d16ce73b5a116be065c361ee5e1bd9eab919ed",
        name: "Q无特写",
        enable: readConfig("Q无特写", "大招无全屏动画", "bool", false),
        files: ["Script/BluePrints/Combat/BP_SkillFeatureLevelSequenceActorBase_C.lua"],
    },
    {
        id: "ee6d573346d9064316e63ad54d856d5589555ecf",
        name: "遁逃",
        enable: readConfig("遁逃", "遁逃始终生效", "bool", false),
        files: ["Script/BluePrints/GameMode/Components/DungeonDeliveryComponent.lua"],
    },
    {
        id: "b7cf4a58a0f20a687bbc65f5f1d8f747cb37f4df",
        name: "无cd",
        enable: readConfig("无CD", "魔灵技能无cd", "bool", false),
        files: ["Script/BluePrints/UI/UI_PC/Battle/WBP_Player_SkillPanel_PC_C.lua"],
    },
    {
        id: "c8be7319d40c351222a936d87a6500970e3a88e5",
        name: "训练假人",
        enable: readConfig("训练假人", "游击秽兽 替换为 目标假人-10e血量", "bool", false),
        files: ["Script/BluePrints/UI/UI_PC/Training/WBP_Battle_Training_Controller.lua"],
    },
    {
        id: "adda501e4b1d69f42b0612981ea97d0caa1383d5",
        name: "搜打撤秒鉴定",
        enable: readConfig("搜打撤秒鉴定", "所有物品瞬间鉴定", "bool", false),
        files: ["Script/Datas/ExtractionTreasureRarity.lua"],
    },
]

/** @param {typeof patches[number]} p  */
async function processPatch(p) {
    setStatus("state", `开始处理: ${p.name}`)
    for (const file of p.files) {
        const localPath = `${cfg.baseDir}/EM/Saved/PersistentDownloadDir/Content/${file}`
        if (p.enable) {
            await downloadFile(`https://gh.llkk.cc/https://github.com/pa001024/DuetNightAbyssData/raw/refs/heads/patch/${file}`, localPath)
        } else {
            deleteFile(localPath)
        }
    }
    setStatus("state")
    console.log(`${p.name}: ${p.enable ? "开启" : "禁用"}完成`)
}
async function main() {
    if (!cfg.baseDir) {
        console.error("请先输入游戏目录 如: E:/game/Duet Night Abyss/DNA Game")
        return
    }
    for (const p of patches) {
        await processPatch(p)
    }
    console.error("请自行承担风险")
}
main()
