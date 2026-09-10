export type AutoFitPlanStep = {
  id: string
  title: string
  instruction: string
}

const STEP_LIBRARY: Omit<AutoFitPlanStep, 'id'>[] = [
  {
    title: '尺寸与总体比例',
    instruction: '优先识别打印尺寸与整体高宽比，建立准确的最大直径、杯口直径和总体外轮廓；忽略液体、贴纸、文字、阴影与透视畸变。',
  },
  {
    title: '杯口与上半部',
    instruction: '只重点对照杯口、口沿、上半部锥度、肩部起点和肩部曲率，修正这些区域，同时尽量保持上一轮确认的总高与最大直径。',
  },
  {
    title: '腰部与杯底',
    instruction: '只重点对照杯身腰线、下半部收放、底部直径、底部圆角和落地轮廓，修正这些区域，并保持已确认的杯口结构。',
  },
  {
    title: '整体对照验收',
    instruction: '逐段对照所有参考图验收整个剪影，找出剩余最大的轮廓偏差并做小幅最终修正；不要把模型重新变成通用圆柱。',
  },
  {
    title: '曲率连续性',
    instruction: '检查从杯口到杯底的曲率连续性和控制点密度，消除不属于实物的折线、鼓包与突变，同时保留真实的造型转折。',
  },
  {
    title: '壁厚与内部结构',
    instruction: '重点复核杯口内径、平均壁厚、底厚和内外轮廓关系；仅根据可见证据修正，不要凭空增加厚重结构。',
  },
  {
    title: '尺寸一致性复核',
    instruction: '复核所有图片中的尺寸标注和视角证据，修正尺寸比例冲突；真实标定值必须保持不变。',
  },
  {
    title: '最终剪影审计',
    instruction: '进行最后一次严格剪影审计，只修正仍明显偏离参考图的局部，避免无证据的大幅改动，并输出最终差异摘要。',
  },
]

export function clampAutoFitRounds(value: number) {
  return Math.min(8, Math.max(1, Math.round(Number.isFinite(value) ? value : 4)))
}

export function buildAutoFitPlan(rounds: number): AutoFitPlanStep[] {
  return STEP_LIBRARY.slice(0, clampAutoFitRounds(rounds)).map((step, index) => ({ ...step, id: `auto-fit-${index + 1}` }))
}
