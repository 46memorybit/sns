// ------------------------------
// デフォルトボタン（URLパラメータで上書き可）
// ------------------------------
const DEFAULT_BUTTONS = [
  { title: 'X',          url: 'https://x.com/home' },
  { title: 'YouTube',    url: 'https://www.youtube.com/' },
  { title: 'Instagram',  url: 'https://www.instagram.com/' }
];

// ベースURL（ユーザー指定）
const BASE_URL = 'https://46memorybit.github.io/sns/index.html';

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
  if (!text) { toast('コピーする内容がありません'); return; }
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
// URL パラメータ解析
// ?text=...（初期文）
// ?btn=タイトル|URL（複数可）
// 互換：?buttons=タイトル|URL;タイトル|URL;...
// ------------------------------
const parseUrlButtons = () => {
  const params = new URLSearchParams(location.search);
  const list = [];

  // btn=title|url を複数
  for (const v of params.getAll('btn')) {
    const s = v.split('|');
    if (s.length >= 2) list.push({ title: decodeURIComponent(s[0]), url: s.slice(1).join('|') });
  }

  // buttons=title|url;title|url 形式もサポート
  const bulk = params.get('buttons');
  if (bulk) {
    bulk.split(';').forEach(item => {
      const s = item.trim().split('|');
      if (s.length >= 2) list.push({ title: decodeURIComponent(s[0]), url: s.slice(1).join('|') });
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
    a.target = '_blank'; // PWAでも外部ブラウザへ
    links.appendChild(a);
  });
};

// ------------------------------
// URLビルダー（最下部セクション）
// ------------------------------
const builderState = {
  pairs: [] // {title, url}[]
};

const safeTitle = (t) => (t ?? '').trim();
const safeUrl = (u) => (u ?? '').trim();

const addPair = (title, url) => {
  title = safeTitle(title);
  url   = safeUrl(url);
  if (!title) { toast('タイトルを入力してください'); return; }
  if (!/^https?:\/\//i.test(url)) { toast('URLは https:// から始めてください'); return; }
  builderState.pairs.push({ title, url });
  renderPairList();
};

const removePair = (idx) => {
  builderState.pairs.splice(idx, 1);
  renderPairList();
};

const resetPairs = () => {
  builderState.pairs = [];
  renderPairList();
  $('#genUrl').textContent = '';
};

const renderPairList = () => {
  const list = $('#pairList');
  list.innerHTML = '';
  builderState.pairs.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'pairitem';
    const title = document.createElement('div');
    title.innerHTML = `<b>${escapeHtml(p.title)}</b>`;
    const link = document.createElement('div');
    link.textContent = p.url;
    const del = document.createElement('button');
    del.className = 'btn del';
    del.textContent = '削除';
    del.addEventListener('click', () => removePair(i));
    row.appendChild(title);
    row.appendChild(link);
    row.appendChild(del);
    list.appendChild(row);
  });
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (m) =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])
);

const buildUrl = () => {
  const base = BASE_URL;
  if (builderState.pairs.length === 0) {
    toast('ペアがありません（まず追加してください）');
    return '';
  }
  const params = builderState.pairs.map(p =>
    // タイトルはエンコード、区切りの | はそのまま、URLはそのまま（既にエンコードされていてもOK）
    `btn=${encodeURIComponent(p.title)}|${p.url}`
  ).join('&');
  const out = `${base}?${params}`;
  $('#genUrl').textContent = out;
  return out;
};

// ------------------------------
// メイン
// ------------------------------
(async function main(){
  const memo = $('#memo');
  const copyBtn = $('#copyBtn');
  const clearBtn = $('#clearBtn');

  // 1) メモ初期化
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

  // 自動保存（デバウンス）
  let t;
  memo.addEventListener('input', () => {
    clearTimeout(t);
    const v = memo.value;
    t = setTimeout(() => db.set('noteText', v), 200);
  });

  // コピー＆消去
  copyBtn.addEventListener('click', () => copyText(memo.value));
  clearBtn.addEventListener('click', async () => {
    memo.value = '';
    await db.set('noteText', '');
    toast('消去しました');
  });

  // 2) パラメータのボタン描画
  const urlButtons = parseUrlButtons();
  const buttons = urlButtons.length ? urlButtons : DEFAULT_BUTTONS;
  renderButtons(buttons);

  // 3) URLビルダー動作
  $('#addPair').addEventListener('click', () => {
    addPair($('#bTitle').value, $('#bUrl').value);
    // 入力欄は続けて追加しやすいようにタイトルのみクリア
    $('#bTitle').value = '';
    $('#bTitle').focus();
  });

  $('#resetPairs').addEventListener('click', resetPairs);

  $('#genBtn').addEventListener('click', () => {
    const url = buildUrl();
    if (url) toast('生成しました');
  });

  $('#copyGen').addEventListener('click', () => {
    const text = $('#genUrl').textContent.trim();
    if (!text) {
      const url = buildUrl();
      if (!url) return;
      copyText(url);
    } else {
      copyText(text);
    }
  });
})();
