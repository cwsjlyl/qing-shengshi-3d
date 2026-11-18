import { Game, installQaHook } from './game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
const ui = document.getElementById('ui-root') as HTMLElement | null;
if (!canvas || !ui) {
  throw new Error('缺少遊戲畫布或介面容器');
}

canvas.tabIndex = 0;
const game = new Game(canvas, ui);
if (new URLSearchParams(location.search).has('qa')) {
  installQaHook(game);
}
void game.boot().catch((err) => {
  console.error(err);
  ui.innerHTML = `<div id="modal" class="show"><div class="sheet"><h2>無法啟動</h2><p class="line">${String(err)}</p></div></div>`;
});
