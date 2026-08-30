import type en from './en';
import type { Translations } from './en';

/**
 * 简体中文. Mirrors the shape of en.ts exactly — a test enforces that.
 *
 * Note the deliberate convention (spec §7): tax terms of art keep their English name
 * with the Chinese gloss ALONGSIDE, never replacing it. The user has to match these
 * terms against IR461 and discuss them with an accountant, and a purely Chinese
 * rendering would leave them unable to do either.
 */
const zhHans: Translations<typeof en> = {
  app: {
    title: '新西兰 FIF 税务计算器',
    tagline:
      '上传您的券商交易记录，即可得到该新西兰税务年度合并后的境外投资基金（FIF）收入金额，同时按 FDR 与 Comparative Value 两种方法计算，并附完整的计算依据。',
    privacy:
      '您的交易数据不会离开浏览器。本应用为纯静态、纯客户端应用——没有后端，也没有数据库。',
    getStarted: '开始',
    back: '返回',
    language: '语言',
  },
  disclaimer: {
    text:
      '本工具仅提供估算，不构成税务建议。FIF 计算取决于您个人的具体情况与选择。请对照新西兰税务局指南 IR461 核对所有数字，并在报税前咨询特许会计师。作者不承担任何责任。',
    heading: '开始前请阅读',
    accept: '我已了解——这是估算，不是税务建议',
    notVerified:
      '本应用中的任何内容均未针对真实券商导出文件进行验证，也未经税务专业人士审阅。澳大利亚上市股票豁免清单为空，报税指引未经核实，且未内置任何新西兰税务局汇率。',
  },
  setup: {
    title: '设置',
    subtitle: '以下选择必须在您的整个投资组合中一致适用，并会出现在每一份导出文件中。',
    taxpayerName: '纳税人姓名（仅保存在您的浏览器中）',
    incomeYear: '税务年度（截至 3 月 31 日）',
    fxApproach: '外汇折算方法',
    costBasis: '部分卖出时的成本计算方法',
    continue: '继续上传',
  },
  results: {
    inFifHeading: '1. 您是否适用 FIF 规则？',
    comparisonHeading: '2. FDR 与 Comparative Value 对比',
    perHoldingHeading: '3. 各持仓明细',
    foreignTaxHeading: '4. 境外已缴税款抵免',
    // Terms of art keep the English name; the Chinese gloss sits alongside it.
    fdrLabel: 'Fair Dividend Rate (FDR) 公平股息率法',
    cvLabel: 'Comparative Value (CV) 比较价值法',
    recommended: '建议采用（两者中较低者）',
    excludedHeading: '未计入 FIF——可能适用其他税务规则',
    exportHeading: '导出',
    showWorking: '查看计算过程',
  },
};

export default zhHans;
