export type Choice = { text: string; correct: boolean };

export type QuizQuestion = {
  prompt: string;
  choices: Choice[];
};

export type DialoguePage = {
  speaker: string;
  text: string;
};

export const TITLE = '最後的皇朝：康雍乾盛世';
export const OPENING_TASK = '清朝早期為甚麼會出現盛世？後來有甚麼轉變？';

export const STAGE_NAMES = {
  kangxi: '康熙（宮殿庭院）',
  yongzheng: '雍正（大殿）',
  qianlong: '乾隆（戶外）'
} as const;

export const PASSWORDS = { kangxi: '123', yongzheng: '456', qianlong: '789' } as const;

export const DIALOGUE = {
  kangxi: [
    {
      speaker: '康熙皇帝',
      text: '無論是滿族人還是漢族人，只要是人才，朕一律任用。'
    }
  ] satisfies DialoguePage[],
  manchu: [
    {
      speaker: '滿族人',
      text: '皇上任用人才時，不分滿族還是漢族。只要是人才，都會得到任用。這樣能讓更多有才能的人為朝廷做事。'
    },
    {
      speaker: '滿族人',
      text: '這樣做也很重要：漢族讀書人看到自己同樣有機會出仕，反抗意識便漸漸消除了。'
    }
  ] satisfies DialoguePage[],
  han: [
    {
      speaker: '漢族人',
      text: '清朝由滿族建立。起初不少漢族士人並不願意效忠朝廷。'
    },
    {
      speaker: '漢族人',
      text: '皇上任用不分種族，漢族士人也有機會發揮才能，反抗意識便消除了，國家才能安定下來。'
    }
  ] satisfies DialoguePage[],
  yongzheng: [
    {
      speaker: '雍正皇帝',
      text: '朕要嚴懲貪官，掃除朝廷內的貪污風氣。'
    },
    {
      speaker: '雍正皇帝',
      text: '朕會嚴查虧空，把貪去的銀兩追回來，充實國庫，改善國家財政。'
    }
  ] satisfies DialoguePage[],
  officialA: [
    {
      speaker: '貪官',
      text: '皇上嚴懲貪官，又嚴查虧空……臣再也不敢貪污了。'
    }
  ] satisfies DialoguePage[],
  officialB: [
    {
      speaker: '貪官',
      text: '以前我虧空公款，現在被查得清清楚楚。朝廷的貪污風氣真的被掃除了。'
    }
  ] satisfies DialoguePage[],
  treasury: [
    {
      speaker: '調查線索',
      text: '整頓之後，國庫重新充實，吏治變得清明，國家財政也改善了。旁邊這個官員再也不敢抬頭了。'
    }
  ] satisfies DialoguePage[],
  qianlong: [
    {
      speaker: '乾隆皇帝',
      text: '朕派兵平定了準噶爾叛亂，奠定了清朝的版圖！'
    },
    {
      speaker: '乾隆皇帝',
      text: '前後一共十次派兵，打了二十六年，雖然奠定了版圖，但軍費巨大，虛耗了康熙和雍正積累的國力。'
    }
  ] satisfies DialoguePage[],
  soldier: [
    {
      speaker: '清兵',
      text: '我們奉皇上之命，平定準噶爾叛亂。這一仗過後，清朝的版圖更加穩固，可說是盛世的高峰。'
    }
  ] satisfies DialoguePage[],
  heshen: [
    {
      speaker: '和珅',
      text: '嘿嘿，這些禮物我都收下了。皇上晚年寵信我，誰敢追究我受賄？'
    },
    {
      speaker: '和珅',
      text: '國庫的銀兩？那些事情……你就不必多問了。'
    }
  ] satisfies DialoguePage[],
  farmer: [
    {
      speaker: '農夫',
      text: '人口越來越多，田地卻不足夠。你看這些田，泥土都裂開了，收成很少，生活很艱苦。'
    }
  ] satisfies DialoguePage[],
  ships: [
    {
      speaker: '南巡船隊',
      text: '皇上曾經六次遊江南。江南是長江三角洲一帶，包括江蘇、浙江，例如揚州、蘇州、杭州、南京等。'
    },
    {
      speaker: '南巡船隊',
      text: '南巡花費龐大，耗用人力物力；但同時也能瞭解江南民情、治理河道，為當地帶來安定。'
    }
  ] satisfies DialoguePage[]
};

export const QUIZZES: Record<'kangxi' | 'yongzheng' | 'qianlong', QuizQuestion[]> = {
  kangxi: [
    {
      prompt: '康熙任用人才的原則是甚麼？',
      choices: [
        { text: '只要是人才，不論滿族還是漢族都會任用', correct: true },
        { text: '只任用滿族人', correct: false },
        { text: '只任用漢族人', correct: false }
      ]
    },
    {
      prompt: '康熙這樣做，對當時有甚麼重要作用？',
      choices: [
        { text: '消除漢族士人的反抗意識', correct: true },
        { text: '開放五個通商口岸', correct: false },
        { text: '六次遊江南', correct: false }
      ]
    },
    {
      prompt: '清朝是由哪個民族建立的？',
      choices: [
        { text: '滿族', correct: true },
        { text: '漢族', correct: false },
        { text: '蒙古族', correct: false }
      ]
    }
  ],
  yongzheng: [
    {
      prompt: '雍正整頓吏治的主要做法是甚麼？',
      choices: [
        { text: '嚴懲貪官、嚴查虧空', correct: true },
        { text: '六次遊江南', correct: false },
        { text: '寵信和珅', correct: false }
      ]
    },
    {
      prompt: '雍正整頓貪污後，對國家有甚麼好處？',
      choices: [
        { text: '充實國庫、吏治清明、改善財政', correct: true },
        { text: '人口大幅增加', correct: false },
        { text: '把香港島割讓', correct: false }
      ]
    },
    {
      prompt: '經歷康熙、雍正兩代共約多少年的治理，國家繁榮起來？',
      choices: [
        { text: '七十多年', correct: true },
        { text: '十年', correct: false },
        { text: '三百年', correct: false }
      ]
    }
  ],
  qianlong: [
    {
      prompt: '乾隆派兵平定準噶爾叛亂，主要意義是甚麼？',
      choices: [
        { text: '奠定清朝的版圖', correct: true },
        { text: '開辦新學堂', correct: false },
        { text: '銷毀鴉片', correct: false }
      ]
    },
    {
      prompt: '乾隆皇帝曾經多少次遊江南？',
      choices: [
        { text: '六次', correct: true },
        { text: '十次', correct: false },
        { text: '一次', correct: false }
      ]
    },
    {
      prompt: '為甚麼十次派兵作戰後來也令國力虛耗？',
      choices: [
        { text: '軍費巨大，用盡康熙和雍正積累的國力', correct: true },
        { text: '士兵都改去江南遊玩', correct: false },
        { text: '因為簽訂了《南京條約》', correct: false }
      ]
    }
  ]
};

export const LOCKED_DOOR: Record<'kangxi' | 'yongzheng' | 'qianlong', string> = {
  kangxi: '大門仍然鎖上。請先與康熙皇帝、滿族人和漢族人傾談，收集證據。',
  yongzheng: '出口仍然鎖上。請先與雍正皇帝、貪官傾談，並調查國庫線索。',
  qianlong: '還不能登船。請先走訪準噶爾平亂、和珅、農田和南巡船隊，收集全部證據。'
};

export const LESSON_SUMMARY =
  '本課小結：早期康熙、雍正、乾隆治國有方，國勢強盛；乾隆晚年國勢轉弱。';

export const HINTS = {
  move: '用左下角搖桿或鍵盤 WASD 移動，拖曳畫面轉動視角。靠近人物後，按右下角「傾談／調查」。',
  quizReady: '證據已齊全。請走到出口，回答三條問題。',
  pwReady: '答對了！請在出口輸入密碼，繼續行程。',
  boardReady: '密碼正確。請走到大船邊，登上南巡御船。'
};
