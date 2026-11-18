/** 離線乾隆答問：港式繁中、≤40 字、無 API。 */

const MAX = 40;

function clip(s: string): string {
  const chars = [...s];
  if (chars.length <= MAX) return s;
  return chars.slice(0, MAX).join('');
}

function norm(q: string): string {
  return q
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[？?！!。．，,、：:；;「」『』""'']/g, '');
}

const STEER = clip('且慢。請改問康熙、雍正、乾隆或清朝盛世與轉弱之事。');
const REFUSE = clip('此問不宜。請改問康熙、雍正、乾隆或清朝史事。');

const BAD =
  /(殺光|虐殺|肢解|強姦|性侵|性交|色情|裸|做愛|約炮|肏|嫖|賣淫|自慰|陰莖|陰道|乳房|色情片|av片|血腥屠殺)/;

const TOPIC =
  /(康熙|雍正|乾隆|清朝|滿族|漢族|盛世|轉弱|國力|國庫|貪官|虧空|吏治|準噶爾|版圖|南巡|江南|派兵|軍費|和珅|農|田|人才|反抗|財政|虛耗|遊江南|十次|六次|七十)/;

type Rule = { re: RegExp; ans: string };

const RULES: Rule[] = [
  { re: /康熙|滿漢|人才|任用/, ans: '朕祖康熙任用不分滿漢，士人得用，國乃安定。' },
  { re: /反抗|漢族士人/, ans: '漢族士人見有出仕之路，反抗意識便漸漸消除。' },
  { re: /滿族建立|誰建|哪個民族/, ans: '清朝由滿族建立；康熙善用各族人才，國基始固。' },
  { re: /雍正|貪官|虧空|吏治/, ans: '朕父雍正嚴懲貪官、嚴查虧空，吏治清明，國庫得充。' },
  { re: /國庫|財政/, ans: '整頓虧空後國庫充實，財政改善，此乃盛世之基。' },
  { re: /七十/, ans: '康雍約七十多年治理，國家日漸繁榮，乃盛世根基。' },
  { re: /準噶爾|版圖|平定/, ans: '朕平定準噶爾，奠定版圖；然征戰亦耗國力，不可不知。' },
  { re: /南巡|江南|六次/, ans: '朕六次遊江南，可知民情、治河道，惟花費亦甚大。' },
  { re: /十次|派兵|軍費|虛耗/, ans: '十次派兵軍費巨大，虛耗康雍積蓄，國力由是轉弱。' },
  { re: /和珅|貪污|受賄/, ans: '晚年朝中有人受賄壞吏治；盛世之下，隱憂已生。' },
  { re: /農|田|人口|收成/, ans: '人口日眾而田不足，民生艱苦，亦見盛世轉弱之兆。' },
  { re: /盛轉衰|轉弱|為甚麼弱|為何弱|衰落/, ans: '版圖雖定，惟南巡與連年用兵虛耗國力，遂由盛轉弱。' },
  { re: /盛世|為甚麼盛|為何盛|強盛/, ans: '康雍任賢懲貪，國庫充實；朕承其業，盛世一時達巔。' }
];

export function answerAsQianlong(raw: string): { text: string; steered: boolean; refused: boolean } {
  const q = (raw || '').trim();
  if (!q) return { text: STEER, steered: true, refused: false };
  const n = norm(q);
  if (BAD.test(n) || BAD.test(q)) return { text: REFUSE, steered: true, refused: true };
  if (!TOPIC.test(q) && !TOPIC.test(n)) return { text: STEER, steered: true, refused: false };
  for (const rule of RULES) {
    if (rule.re.test(q) || rule.re.test(n)) {
      return { text: clip(rule.ans), steered: false, refused: false };
    }
  }
  return { text: clip('清朝事繁。且問康熙用人、雍正吏治，或朕用兵與南巡之得失。'), steered: true, refused: false };
}

export function countChars(s: string): number {
  return [...s].length;
}
