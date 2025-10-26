// ------------------------------
// 定数
// ------------------------------
const BASE_URL = 'https://46memorybit.github.io/sns/index.html';

// （初期表示：URLパラメータが無いときはリンク起動を出さない）
const DEFAULT_BUTTONS = []; // 使わないが互換のため残置

// ------------------------------
// ユーティリティ
// ------------------------------
const $ = (sel) => document.querySelector(sel);

const toast = (msg, ms = 1400) => {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('コピーしました');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    toast(ok ? 'コピーしました' : 'コピーに失敗しました');
  }
};

// ------------------------------
// URL パラメータ処理
// ?text=...（初期文）
// ?btn=タイトル|URL を複数回
// 互換：?buttons=タイトル|URL;タイトル|URL;...
// ------------------------------
const parseUrlButtons = () => {
  const params = new URLSearchParams(location.search);
  const list = [];

  // btn=title|url を複数
  for (const v of params.getAll('btn')) {
    const s = v.split('|');
    if (s.length >= 2) {
      const title = decodeURIComponent(s[0]);
      // URL側には '|' を含む可能性があるため残りを結合してから decode
      const urlRaw = s.slice(1).join('|');
      list.push({ title, url: decodeURIComponent(urlRaw) });
    }
  }

  // buttons=title|url;title|url 形式もサポート
  const bulk = params.get('buttons');
  if (bulk) {
    bulk.split(';').forEach(item => {
      const s = item.trim().split('|');
      if (s.length >= 2) {
        const title = decodeURIComponent(s[0]);
        const urlRaw = s.slice(1).join('|');
        list.push({ title, url: decodeURIComponent(urlRaw) });
      }
    });
  }

  return list
    .map(b => ({ title: (b.title || '').trim(), url: (b.url || '').trim() }))
    .filter(b => b.title && /^https?:\/\//i.test(b.url));
};

const getInitialTextFromURL = () => {
  const p = new URLSearchParams(location.search);
  const t = p.get('text');
  return t ? decodeURIComponent(t) : null;
};

// ------------------------------
// リンクボタン描画
// ------------------------------
const renderButtons = (buttons) => {
  const links = $('#links');
  links.innerHTML = '';
  buttons.forEach(({ title, url }) => {
    const a = document.createElement('a');
    a.className = 'linkbtn';
    a.textContent = title;
    a.href = url;
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    links.appendChild(a);
  });
};

// ------------------------------
// Builder（カスタムURL作成）
// ------------------------------
let builderItems = []; // {title, url}[]

const builderStateLoad = async () => {
  const saved = await db.get('builderItems');
  builderItems = Array.isArray(saved) ? saved : [];
};

const builderStateSave = async () => {
  await db.set('builderItems', builderItems);
};

const buildCustomURL = () => {
  if (!builderItems.length) return BASE_URL;
  const qs = builderItems
    .map(({ title, url }) => `btn=${encodeURIComponent(title)}|${encodeURIComponent(url)}`)
    .join('&');
  return `${BASE_URL}?${qs}`;
};

const renderBuilder = () => {
  const listEl = $('#builderList');
  const emptyEl = $('#builderEmpty');
  const countEl = $('#builderCount');

  listEl.innerHTML = '';
  if (builderItems.length === 0) {
    emptyEl.style.display = '';
    countEl.textContent = '0件';
    return;
  }
  emptyEl.style.display = 'none';

  builderItems.forEach((it, idx) => {
    const row = document.createElement('div');
    row.className = 'item';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const ttl = document.createElement('div');
    ttl.className = 'ttl';
    ttl.textContent = it.title;
    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = it.url;
    meta.appendChild(ttl);
    meta.appendChild(url);

    const del = document.createElement('button');
    del.className = 'btn danger';
    del.textContent = '削除';
    del.addEventListener('click', async () => {
      builderItems.splice(idx, 1);
      await builderStateSave();
      renderBuilder();
      toast('削除しました');
    });

    row.appendChild(meta);
    row.appendChild(del);
    listEl.appendChild(row);
  });

  countEl.textContent = `${builderItems.length}件`;
};

// ------------------------------
// メイン
// ------------------------------
(async function main(){
  // ベースURL表示
  $('#baseUrl').textContent = BASE_URL;

  // メモ：IndexedDB から読込
  const memo = $('#memo');
  const copyBtn = $('#copyBtn');
  const clearBtn = $('#clearBtn');

  const saved = await db.get('noteText');
  if (typeof saved === 'string') {
    memo.value = saved;
  } else {
    const fromURL = getInitialTextFromURL();
    if (fromURL) {
      memo.value = fromURL;
      await db.set('noteText', fromURL);
    }
  }

  let t;
  memo.addEventListener('input', () => {
    clearTimeout(t);
    const v = memo.value;
    t = setTimeout(() => db.set('noteText', v), 200);
  });

  copyBtn.addEventListener('click', () => copyText(memo.value));
  clearBtn.addEventListener('click', async () => {
    memo.value = '';
    await db.set('noteText', '');
    toast('消去しました');
  });

  // リンク起動：URLパラメータがある時のみ表示
  const urlButtons = parseUrlButtons();
  if (urlButtons.length > 0) {
    $('#linkSection').style.display = '';
    renderButtons(urlButtons);
    $('#desc').style.display = 'none';
  } else {
    $('#linkSection').style.display = 'none';
    $('#desc').style.display = '';
  }

  // Builder 初期化
  await builderStateLoad();
  renderBuilder();

  // Builder 追加
  const iTitle = $('#builderTitle');
  const iUrl = $('#builderUrl');
  $('#builderAdd').addEventListener('click', async () => {
    const title = (iTitle.value || '').trim();
    const url = (iUrl.value || '').trim();

    if (!title) {
      toast('タイトルを入力してください'); iTitle.focus(); return;
    }
    if (!/^https?:\/\//i.test(url)) {
      toast('URLは https:// または http:// から入力してください'); iUrl.focus(); return;
    }

    builderItems.push({ title, url });
    await builderStateSave();
    renderBuilder();

    // クリア＆次の入力に備えてフォーカス
    iTitle.value = '';
    iUrl.value = '';
    iTitle.focus();
    toast('追加しました');
  });

  // Builder コピー
  $('#builderCopy').addEventListener('click', async () => {
    const full = buildCustomURL();
    await copyText(full);
  });
})();
