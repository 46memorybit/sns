// ------------------------------
// 設定（デフォルトのボタン。URLパラメータで上書き可能）
// ------------------------------
const DEFAULT_BUTTONS = [
  { title: 'X',       url: 'https://x.com/home' },
  { title: 'YouTube', url: 'https://www.youtube.com/' },
  { title: 'Instagram', url: 'https://www.instagram.com/' }
];

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
    // フォールバック：一時テキストエリア
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

  // 最低限のバリデーション
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
    a.target = '_blank'; // PWAでも外部ブラウザで開きやすい
    // スクエア感確保（最低高さはCSSで指定済み）
    links.appendChild(a);
  });
};

// ------------------------------
// メイン
// ------------------------------
(async function main(){
  const memo = $('#memo');
  const copyBtn = $('#copyBtn');
  const clearBtn = $('#clearBtn');

  // 1) 初期読み込み（IndexedDB から）
  const saved = await db.get('noteText');
  if (typeof saved === 'string') {
    memo.value = saved;
  } else {
    // URLの text= で初期値
    const fromURL = getInitialTextFromURL();
    if (fromURL) {
      memo.value = fromURL;
      await db.set('noteText', fromURL);
    }
  }

  // 2) 自動保存（入力のたびに）
  let t;
  memo.addEventListener('input', () => {
    clearTimeout(t);
    const v = memo.value;
    // 軽いデバウンス
    t = setTimeout(() => db.set('noteText', v), 200);
  });

  // 3) コピー
  copyBtn.addEventListener('click', () => copyText(memo.value));

  // 4) 消去
  clearBtn.addEventListener('click', async () => {
    memo.value = '';
    await db.set('noteText', '');
    toast('消去しました');
  });

  // 5) リンクボタン
  const urlButtons = parseUrlButtons();
  const buttons = urlButtons.length ? urlButtons : DEFAULT_BUTTONS;
  renderButtons(buttons);
})();
