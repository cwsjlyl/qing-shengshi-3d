import type { DialoguePage, QuizQuestion } from '../data/content';
import { escapeHtml, type HUD } from './hud';

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

export function showTitle(
  hud: HUD,
  opts: { progress: number; status: string; ready: boolean; onStart: () => void }
): void {
  hud.setTitleMode(true);
  hud.modalEl.classList.add('boot-title', 'airy');
  hud.showModal(`
    <div class="sheet" id="boot-panel">
      <h1>最後的皇朝：康雍乾盛世</h1>
      <p class="sub">課堂 3D 探索　·　紫禁城風格原創場景</p>
      <p class="line" style="text-align:center">${escapeHtml('清朝早期為甚麼會出現盛世？後來有甚麼轉變？')}</p>
      <div class="progress-track"><div class="progress-fill" id="boot-fill" style="width:${Math.round(opts.progress * 100)}%"></div></div>
      <div class="boot-status" id="boot-status">${escapeHtml(opts.status)}</div>
      <div class="actions">
        <button type="button" class="btn gold" id="boot-start" ${opts.ready ? '' : 'disabled'}>開始探索</button>
      </div>
      <p class="disclaimer">本遊戲是原創課堂作品，場景為紫禁城風格的想像宫廷，並非故宮官方產品，亦不是教科書頁面的複製。</p>
    </div>`);
  const start = hud.modalEl.querySelector('#boot-start') as HTMLButtonElement;
  start.addEventListener('click', () => {
    if (start.disabled) return;
    hud.hideModal();
    opts.onStart();
  });
}

export function updateTitleProgress(hud: HUD, progress: number, status: string, ready: boolean): void {
  if (!hud.modalEl.querySelector('#boot-panel')) return;
  const fill = hud.modalEl.querySelector('#boot-fill') as HTMLElement | null;
  const st = hud.modalEl.querySelector('#boot-status') as HTMLElement | null;
  const btn = hud.modalEl.querySelector('#boot-start') as HTMLButtonElement | null;
  if (fill) fill.style.width = `${Math.round(progress * 100)}%`;
  if (st) st.textContent = status;
  if (btn) btn.disabled = !ready;
}

export function showSummary(hud: HUD, text: string, onDone: () => void): void {
  hud.showModal(`
    <div class="sheet">
      <h2>開船　·　本課小結</h2>
      <p class="line">${escapeHtml(text)}</p>
      <div class="actions"><button type="button" class="btn gold" id="sum-ok">完成探索</button></div>
    </div>`);
  hud.modalEl.classList.add('airy');
  hud.modalEl.querySelector('#sum-ok')!.addEventListener('click', () => {
    hud.modalEl.classList.remove('airy');
    hud.hideModal();
    onDone();
  });
}
