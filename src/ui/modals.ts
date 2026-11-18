import type { DialoguePage, QuizQuestion } from '../data/content';
import { OPENING_BLURB, OPENING_TASK, TITLE } from '../data/content';
import { escapeHtml, type HUD } from './hud';
import type { StageId } from '../stages/types';

export function showDialogue(hud: HUD, pages: DialoguePage[], onDone: () => void): void {
  let i = 0;
  const render = () => {
    const p = pages[i];
    const last = i >= pages.length - 1;
    hud.modalEl.classList.add('talk-frame', 'airy');
    hud.showModal(`
      <div class="sheet" id="dlg-sheet">
        <div class="speaker">${escapeHtml(p.speaker)}</div>
        <p class="line">${escapeHtml(p.text)}</p>
        <div class="actions">
          <button type="button" class="btn gold" id="dlg-next">${last ? '知道了' : '繼續'}</button>
        </div>
      </div>`);
    hud.modalEl.querySelector('#dlg-next')!.addEventListener('click', () => {
      if (last) {
        hud.hideModal();
        onDone();
      } else {
        i += 1;
        render();
      }
    });
  };
  render();
}

export function showQuiz(
  hud: HUD,
  questions: QuizQuestion[],
  onComplete: () => void
): void {
  let q = 0;
  const render = () => {
    const item = questions[q];
    const choices = item.choices
      .map(
        (c, idx) =>
          `<button type="button" class="choice" data-i="${idx}">${escapeHtml(c.text)}</button>`
      )
      .join('');
    hud.showModal(`
      <div class="sheet">
        <h2>問題 ${q + 1}／${questions.length}</h2>
        <p class="line">${escapeHtml(item.prompt)}</p>
        <div class="choices">${choices}</div>
        <div class="feedback" id="q-feed"></div>
      </div>`);
    const feed = hud.modalEl.querySelector('#q-feed') as HTMLElement;
    hud.modalEl.querySelectorAll<HTMLButtonElement>('.choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.i);
        const choice = item.choices[idx];
        if (choice.correct) {
          btn.classList.add('correct');
          feed.className = 'feedback ok';
          feed.textContent = '正確！';
          hud.modalEl.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => (b.disabled = true));
          setTimeout(() => {
            if (q + 1 >= questions.length) {
              hud.hideModal();
              onComplete();
            } else {
              q += 1;
              render();
            }
          }, 550);
        } else {
          btn.classList.add('wrong');
          feed.className = 'feedback bad';
          feed.textContent = '再試一次。';
          setTimeout(() => btn.classList.remove('wrong'), 600);
        }
      });
    });
  };
  render();
}

export function showPassword(
  hud: HUD,
  expected: string,
  title: string,
  hint: string,
  onOk: () => void
): void {
  let value = '';
  const render = () => {
    const display = value.length ? value : '— — —';
    hud.showModal(`
      <div class="sheet">
        <h2>${escapeHtml(title)}</h2>
        <p class="sub">${escapeHtml(hint)}</p>
        <div class="pw-row"><div id="pw-display">${escapeHtml(display)}</div></div>
        <div class="keypad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, '清除', 0, '確定']
            .map((k) => `<button type="button" data-k="${k}">${k}</button>`)
            .join('')}
        </div>
        <div class="pw-msg" id="pw-msg"></div>
      </div>`);
    const msg = hud.modalEl.querySelector('#pw-msg') as HTMLElement;
    const screen = hud.modalEl.querySelector('#pw-display') as HTMLElement;
    const redraw = () => {
      screen.textContent = value.length ? value : '— — —';
    };
    hud.modalEl.querySelectorAll<HTMLButtonElement>('.keypad button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.k ?? '';
        if (k === '清除') {
          value = '';
          msg.textContent = '';
          redraw();
          return;
        }
        if (k === '確定') {
          if (value === expected) {
            msg.textContent = '';
            hud.hideModal();
            onOk();
          } else {
            msg.textContent = '密碼不正確。請輸入正確的三位數。';
            value = '';
            redraw();
          }
          return;
        }
        if (value.length < 6) value += k;
        msg.textContent = '';
        redraw();
      });
    });
  };
  render();
}

export function showMessage(hud: HUD, title: string, body: string, button = '知道了', onOk?: () => void): void {
  hud.showModal(`
    <div class="sheet">
      <h2>${escapeHtml(title)}</h2>
      <p class="line">${escapeHtml(body)}</p>
      <div class="actions"><button type="button" class="btn gold" id="msg-ok">${escapeHtml(button)}</button></div>
    </div>`);
  hud.modalEl.querySelector('#msg-ok')!.addEventListener('click', () => {
    hud.hideModal();
    onOk?.();
  });
}

export type TitleStart =
  | { mode: 'sequential' }
  | { mode: 'class'; stage: StageId };

export function showTitle(
  hud: HUD,
  opts: {
    progress: number;
    status: string;
    ready: boolean;
    onStart: (start: TitleStart) => void;
  }
): void {
  const paintBoot = () => {
    hud.setTitleMode(true);
    hud.modalEl.classList.add('boot-title', 'airy');
    hud.showModal(`
    <div class="sheet" id="boot-panel">
      <h1>${escapeHtml(TITLE)}</h1>
      <p class="sub">課堂 3D 探索　·　紫禁城風格原創場景</p>
      <p class="line" style="text-align:center">${escapeHtml(OPENING_BLURB)}</p>
      <p class="line" style="text-align:center">${escapeHtml(OPENING_TASK)}</p>
      <div class="progress-track"><div class="progress-fill" id="boot-fill" style="width:${Math.round(opts.progress * 100)}%"></div></div>
      <div class="boot-status" id="boot-status">${escapeHtml(opts.status)}</div>
      <div class="actions stacked">
        <button type="button" class="btn gold" id="boot-seq" ${opts.ready ? '' : 'disabled'}>由康熙順序探索</button>
        <button type="button" class="btn" id="boot-class" ${opts.ready ? '' : 'disabled'}>課堂分關</button>
      </div>
      <p class="disclaimer">本遊戲是原創課堂作品，場景為紫禁城風格的想像宫廷，並非故宮官方產品，亦不是教科書頁面的複製。</p>
    </div>`);
    const seq = hud.modalEl.querySelector('#boot-seq') as HTMLButtonElement;
    const cls = hud.modalEl.querySelector('#boot-class') as HTMLButtonElement;
    seq.addEventListener('click', () => {
      if (seq.disabled) return;
      hud.hideModal();
      opts.onStart({ mode: 'sequential' });
    });
    cls.addEventListener('click', () => {
      if (cls.disabled) return;
      showClassSelect(hud, {
        onPick: (stage) => {
          hud.hideModal();
          opts.onStart({ mode: 'class', stage });
        },
        onBack: () => paintBoot()
      });
    });
  };
  paintBoot();
}

export function showClassSelect(
  hud: HUD,
  opts: { onPick: (id: StageId) => void; onBack?: () => void; title?: string; sub?: string }
): void {
  hud.setTitleMode(true);
  hud.modalEl.classList.add('boot-title', 'airy');
  hud.showModal(`
    <div class="sheet" id="boot-panel">
      <h2>${escapeHtml(opts.title ?? '課堂分關')}</h2>
      <p class="sub">${escapeHtml(opts.sub ?? '請選擇本節要專攻的關卡。通關後不會自動跳去下一朝，方便專家互教。')}</p>
      <div class="actions stacked">
        <button type="button" class="btn gold" data-stage="kangxi">康熙關卡</button>
        <button type="button" class="btn gold" data-stage="yongzheng">雍正關卡</button>
        <button type="button" class="btn gold" data-stage="qianlong">乾隆關卡</button>
        ${opts.onBack ? '<button type="button" class="btn" id="class-back">返回</button>' : ''}
      </div>
    </div>`);
  hud.modalEl.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((btn) => {
    btn.addEventListener('click', () => opts.onPick(btn.dataset.stage as StageId));
  });
  hud.modalEl.querySelector('#class-back')?.addEventListener('click', () => opts.onBack?.());
}

export function updateTitleProgress(hud: HUD, progress: number, status: string, ready: boolean): void {
  if (!hud.modalEl.querySelector('#boot-panel')) return;
  const fill = hud.modalEl.querySelector('#boot-fill') as HTMLElement | null;
  const st = hud.modalEl.querySelector('#boot-status') as HTMLElement | null;
  if (fill) fill.style.width = `${Math.round(progress * 100)}%`;
  if (st) st.textContent = status;
  hud.modalEl.querySelectorAll<HTMLButtonElement>('#boot-seq, #boot-class').forEach((btn) => {
    btn.disabled = !ready;
  });
}

export function showStageComplete(hud: HUD, stageLabel: string, onBack: () => void): void {
  hud.showModal(`
    <div class="sheet">
      <h2>本關完成</h2>
      <p class="line">${escapeHtml(stageLabel)}的證據與題目已完成。請返回課堂分關，準備用證據教組員。</p>
      <div class="actions">
        <button type="button" class="btn gold" id="stage-back">返回課堂分關</button>
      </div>
    </div>`);
  hud.modalEl.querySelector('#stage-back')!.addEventListener('click', () => {
    hud.hideModal();
    onBack();
  });
}

export function showAskQianlong(
  hud: HUD,
  opts: {
    prompt: string;
    answer: (question: string) => { text: string; steered: boolean; refused: boolean };
    onFinished: () => void;
  }
): void {
  let answeredOnTopic = false;
  const renderAsk = (notice?: string) => {
    hud.showModal(`
      <div class="sheet">
        <div class="speaker">乾隆皇帝</div>
        <p class="line">${escapeHtml(opts.prompt)}</p>
        ${notice ? `<p class="sub" id="ask-notice">${escapeHtml(notice)}</p>` : ''}
        <label class="ask-label" for="ask-input">你的問題</label>
        <textarea id="ask-input" class="ask-input" rows="3" maxlength="120" placeholder="例如：為甚麼十次派兵會令國力虛耗？"></textarea>
        <div class="actions">
          <button type="button" class="btn gold" id="ask-send">請教皇上</button>
        </div>
      </div>`);
    const input = hud.modalEl.querySelector('#ask-input') as HTMLTextAreaElement;
    hud.modalEl.querySelector('#ask-send')!.addEventListener('click', () => {
      const q = input.value.trim();
      const res = opts.answer(q);
      if (res.steered || res.refused) {
        renderAsk(res.text);
        return;
      }
      answeredOnTopic = true;
      hud.showModal(`
        <div class="sheet">
          <div class="speaker">乾隆皇帝</div>
          <p class="line">${escapeHtml(res.text)}</p>
          <div class="actions">
            <button type="button" class="btn gold" id="ask-done">返回現代</button>
          </div>
        </div>`);
      hud.modalEl.querySelector('#ask-done')!.addEventListener('click', () => {
        hud.hideModal();
        opts.onFinished();
      });
    });
  };
  void answeredOnTopic;
  renderAsk();
}

export function showSummary(hud: HUD, text: string, onDone: () => void, opts?: { title?: string; button?: string; reflect?: string }): void {
  const reflect = opts?.reflect
    ? `<p class="sub" style="margin-top:10px">${escapeHtml(opts.reflect)}</p>`
    : '';
  hud.showModal(`
    <div class="sheet">
      <h2>${escapeHtml(opts?.title ?? '開船　·　本課小結')}</h2>
      <p class="line">${escapeHtml(text)}</p>
      ${reflect}
      <div class="actions"><button type="button" class="btn gold" id="sum-ok">${escapeHtml(opts?.button ?? '完成探索')}</button></div>
    </div>`);
  hud.modalEl.classList.add('airy');
  hud.modalEl.querySelector('#sum-ok')!.addEventListener('click', () => {
    hud.modalEl.classList.remove('airy');
    hud.hideModal();
    onDone();
  });
}
