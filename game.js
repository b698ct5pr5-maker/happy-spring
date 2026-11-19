/* ===== 春满里趣味游戏 · 游戏逻辑 ===== */
(function () {
  const CATS = {
    mingtang:  { name: '明棠', files: [1,2,3,4,5,6].map(i => `images/mingtang_${i}.jpg`) },
    zhoujinye: { name: '周尽野', files: [1,2,3,4,5,6].map(i => `images/zhoujinye_${i}.jpg`) },
    couple:    { name: '双人拼图', files: [1,2,3,4,5,6].map(i => `images/couple_${i}.jpg`) },
    family:    { name: '其他拼图', files: [1,2,3,4,5,6].map(i => `images/family_${i}.jpg`) },
  };

  // 缓存每张图片的真实宽高比，供拼图画板按比例显示（不裁切、不拉伸）
  const ratioCache = {};
  function imageRatio(src, cb) {
    if (ratioCache[src]) return cb(ratioCache[src]);
    const im = new Image();
    im.onload = () => { ratioCache[src] = im.naturalWidth / im.naturalHeight; cb(ratioCache[src]); };
    im.onerror = () => cb(1);
    im.src = src;
  }

  const state = {
    cat: 'mingtang',   // 当前栏目
    selected: {},      // cat -> index
    diff: 3,           // 3/4/5
    tiles: [],         // 每个格子的正确索引 -> 当前排列
    picked: null,      // 当前选中的格子位置
    moves: 0,
    solved: false,
  };

  const $ = id => document.getElementById(id);

  function show(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $(id).classList.add('active');
    window.scrollTo(0, 0);
  }

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
  }

  /* ---------- 首页 ---------- */
  function initHome() {
    document.querySelectorAll('.cat-card').forEach(card => {
      card.addEventListener('click', () => {
        state.cat = card.dataset.cat;
        if (state.selected[state.cat] == null) state.selected[state.cat] = 0;
        document.querySelectorAll('.cat-card').forEach(c => c.classList.toggle('selected', c === card));
        openSelect();
      });
    });
    $('startBtn').addEventListener('click', openSelect);
  }

  /* ---------- 素材选择页 ---------- */
  function openSelect() {
    show('selectView');
    $('selectTitle').textContent = CATS[state.cat].name;
    // 标签
    const tabs = $('catTabs');
    tabs.innerHTML = '';
    Object.keys(CATS).forEach(key => {
      const b = document.createElement('button');
      b.textContent = CATS[key].name;
      b.className = key === state.cat ? 'active' : '';
      b.onclick = () => {
        state.cat = key;
        if (state.selected[key] == null) state.selected[key] = 0;
        openSelect();
      };
      tabs.appendChild(b);
    });
    // 网格
    const grid = $('selectGrid');
    grid.innerHTML = '';
    const files = CATS[state.cat].files;
    if (state.selected[state.cat] == null) state.selected[state.cat] = 0;
    files.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'sel-item' + (state.selected[state.cat] === i ? ' selected' : '');
      item.innerHTML = `<img src="${f}" alt="图${i+1}"><div class="check">${state.selected[state.cat] === i ? '✓' : ''}</div><div class="idx">图 ${i+1}</div>`;
      item.onclick = () => {
        state.selected[state.cat] = i;
        openSelect();
      };
      grid.appendChild(item);
    });
  }

  /* ---------- 游戏页 ---------- */
  function currentImage() {
    return CATS[state.cat].files[state.selected[state.cat] || 0];
  }

  function openGame() {
    show('gameView');
    $('previewImg').src = currentImage();
    newGame();
  }

  function newGame() {
    state.moves = 0;
    state.picked = null;
    state.solved = false;
    $('moveCount').textContent = '0';
    $('winOverlay').classList.remove('show');
    $('board').classList.remove('show-num');
    // 画板按当前照片的真实宽高比显示，保证整张照片完整、不拉伸、不裁切
    imageRatio(currentImage(), r => { $('board').style.aspectRatio = r; });
    buildBoard();
  }

  function buildBoard() {
    const board = $('board');
    const n = state.diff;
    const total = n * n;
    board.style.gridTemplateColumns = `repeat(${n},1fr)`;
    board.innerHTML = '';

    // 正确顺序 [0..total-1]，然后彻底打乱
    state.tiles = Array.from({length: total}, (_, i) => i);
    shuffleArray(state.tiles);
    // 极小概率刚好还原，强制再打乱一次
    if (state.tiles.every((v, i) => v === i)) shuffleArray(state.tiles);

    const img = currentImage();
    state.tiles.forEach((correctIdx, pos) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.pos = pos;
      const row = Math.floor(correctIdx / n);
      const col = correctIdx % n;
      const size = 100 / n;
      // 用 background-position 显示图片对应切片
      tile.style.backgroundImage = `url(${img})`;
      tile.style.backgroundSize = `${n * 100}% ${n * 100}%`;
      tile.style.backgroundPosition = `${(col / (n - 1)) * 100}% ${(row / (n - 1)) * 100}%`;
      tile.innerHTML = `<span class="num">${correctIdx + 1}</span>`;
      tile.addEventListener('click', () => onTileClick(pos));
      board.appendChild(tile);
    });
  }

  function shuffleArray(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  function onTileClick(pos) {
    if (state.solved) return;
    if (state.picked === null) {
      state.picked = pos;
      renderPicked();
      return;
    }
    if (state.picked === pos) {
      state.picked = null;
      renderPicked();
      return;
    }
    // 交换两块
    [state.tiles[state.picked], state.tiles[pos]] = [state.tiles[pos], state.tiles[state.picked]];
    state.moves++;
    $('moveCount').textContent = state.moves;
    state.picked = null;
    renderBoard();
    checkWin();
  }

  function renderPicked() {
    document.querySelectorAll('.tile').forEach((t, pos) => {
      t.classList.toggle('picked', pos === state.picked);
    });
  }

  function renderBoard() {
    const n = state.diff;
    document.querySelectorAll('.tile').forEach((tile, pos) => {
      const correctIdx = state.tiles[pos];
      const row = Math.floor(correctIdx / n);
      const col = correctIdx % n;
      tile.style.backgroundPosition = `${(col / (n - 1)) * 100}% ${(row / (n - 1)) * 100}%`;
      tile.querySelector('.num').textContent = correctIdx + 1;
      tile.classList.toggle('correct', correctIdx === pos);
      tile.classList.remove('picked');
    });
  }

  function checkWin() {
    if (state.tiles.every((v, i) => v === i)) {
      state.solved = true;
      document.querySelectorAll('.tile').forEach(t => t.classList.add('correct'));
      $('winMsg').textContent = `用了 ${state.moves} 步完成 · 太厉害啦！`;
      setTimeout(() => $('winOverlay').classList.add('show'), 420);
    }
  }

  /* ---------- 事件绑定 ---------- */
  function initEvents() {
    // 返回按钮
    document.querySelectorAll('[data-back]').forEach(b => {
      b.onclick = () => show(b.dataset.back);
    });
    // 难度
    $('diffTabs').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      state.diff = +b.dataset.diff;
      document.querySelectorAll('#diffTabs button').forEach(x => x.classList.toggle('active', x === b));
      newGame();
      toast(`已切换到 ${state.diff}×${state.diff}`);
    });
    // 选择页 -> 游戏
    $('toPuzzleBtn').onclick = openGame;
    // 打乱
    $('shuffleBtn').onclick = () => {
      shuffleArray(state.tiles);
      state.picked = null;
      state.moves = 0;
      $('moveCount').textContent = '0';
      state.solved = false;
      $('winOverlay').classList.remove('show');
      renderBoard();
      toast('已重新打乱');
    };
    // 看原图（按住显示编号提示）
    const hintBtn = $('hintBtn');
    const showNum = on => $('board').classList.toggle('show-num', on);
    hintBtn.addEventListener('mousedown', () => showNum(true));
    hintBtn.addEventListener('mouseup', () => showNum(false));
    hintBtn.addEventListener('mouseleave', () => showNum(false));
    hintBtn.addEventListener('touchstart', e => { e.preventDefault(); showNum(true); }, {passive:false});
    hintBtn.addEventListener('touchend', e => { e.preventDefault(); showNum(false); }, {passive:false});
    hintBtn.addEventListener('click', () => {
      // 点击也短暂显示
      showNum(true);
      setTimeout(() => showNum(false), 900);
    });
    // 重置
    $('resetBtn').onclick = () => { newGame(); toast('已重置'); };
    // 完成弹窗
    $('replayBtn').onclick = () => { newGame(); };
    $('nextPuzzleBtn').onclick = () => {
      const files = CATS[state.cat].files;
      state.selected[state.cat] = ((state.selected[state.cat] || 0) + 1) % files.length;
      $('previewImg').src = currentImage();
      newGame();
    };
  }

  /* ---------- 启动 ---------- */
  initHome();
  initEvents();
})();
