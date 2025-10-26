// ------------------------------
// デフォルトボタン（URLパラメータが無い場合に表示）
// ------------------------------
const DEFAULT_BUTTONS = [
  { title: 'X',         url: 'https://x.com/home' },
  { title: 'YouTube',   url: 'https://www.youtube.com/' },
  { title: 'Instagram', url: 'https://www.instagram.com/' }
];

// ------------------------------
// 便利関数
// ------------------------------
const $ = (sel) => document.querySelector(sel);

const toast = (msg, ms = 1400) => {
  const el = $('#toast');
  if (!el) return;
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
    // フォールバック
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
// URLパラメータ：text, btn
//  - ?text=初期テキスト
//  - ?btn=タイトル|URL を複数回（"|" は %7C として生成）
// 互換：?buttons=タイトル|URL;タイトル|URL;...
// ------------------------------
const getInitialTextFromURL = () => {
  const p = new URLSearchParams(location.search);
  const t = p.get('text');
  return t ? decodeURIComponent(t) : null;
};

const parseUrlButtons = () => {
  const params = new URLSearchParams(location.search);
  const list = [];

  // btn=title|url を複数回
  for (const v of params.getAll('btn')) {
    const s = v.split('|');
    if (s.length >= 2) list.push({ title: decodeURIComponent(s[0]), url: s.slice(1).join('|') });
  }

  // buttons=title|url;title|url 形式
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

// ------------------------------
// リンクボタン描画
// ------------------------------
const renderButtons = (buttons) => {
  const links = $('#links');
  if (!links) return;
  links.innerHTML = '';
  buttons.forEach(({ title, url }) => {
    const a = document.createElement('a');
    a.className = 'linkbtn';
    a.textContent = title;
    a.href = url;
    a.rel = 'noopener noreferrer';
    a.target = '_blank'; // 外部ブラウザで開きやすくする
    links.appendChild(a);
  });
};

// ------------------------------
// 共有用URL生成
// ------------------------------
const getButtonsFromDOM = () => {
  return [...document.querySelectorAll('#links a.linkbtn')].map(a => ({
    title: a.textContent.trim(),
    url: a.href
  }));
};

const buildShareUrl = ({ baseUrl, includeText, includeBtns }) => {
  try {
    const base = (baseUrl || '').trim();
    if (!base) return '';

    const params = new URLSearchParams();

    if (includeText) {
      const v = ($('#memo')?.value || '').trim();
      if (v) params.set('text', v);
    }

    const btnParams = [];
    if (includeBtns) {
      const btns = getButtonsFromDOM();
      btns.forEach(({ title, url }) => {
        if (!title || !/^https?:\/\//i.test(url)) return;
        // "タイトル|URL" の '|' は %7C 固定。要素は encodeURIComponent。
        const val = `${encodeURIComponent(title)}%7C${encodeURIComponent(url)}`;
        btnParams.push(`btn=${val}`);
      });
    }

    const qsMain = params.toString();   // text=...
    const qsBtns = btnParams.join('&'); // btn=...&btn=...
    const glue = (qsMain || qsBtns) ? '?' : '';
    const amp = (qsMain && qsBtns) ? '&' : '';

    return `${base}${glue}${qsMain}${amp}${qsBtns}`;
  } catch (e) {
    console.error(e);
    return '';
  }
};

const initShareForm = () => {
  const baseUrl = $('#baseUrl');
  const optText = $('#optText');
  const optBtns = $('#optBtns');
  const shareUrl = $('#shareUrl');
  const genBtn = $('#genBtn');
  const copyShareBtn = $('#copyShareBtn');
  if (!baseUrl || !optText || !optBtns || !shareUrl || !genBtn || !copyShareBtn) return;

  const regenerate = () => {
    const url = buildShareUrl({
      baseUrl: baseUrl.value,
      includeText: optText.checked,
      includeBtns: optBtns.checked
    });
    shareUrl.value = url;
  };

  // 初回生成
  regenerate();

  // 入力変化で自動再生成（軽デバウンス）
  let t;
  const auto = () => { clearTimeout(t); t = setTimeout(regenerate, 150); };
  ['input','change'].forEach(ev => {
    baseUrl.addEventListener(ev, auto);
    optText.addEventListener(ev, auto);
    optBtns.addEventListener(ev, auto);
  });

  // メモが変わったら再生成
  $('#memo')?.addEventListener('input', auto);

  genBtn.addEventListener('click', (e) => { e.preventDefault(); regenerate(); toast('URLを再生成しました'); });
  copyShareBtn.addEventListener('click', (e) => { e.preventDefault(); copyText(shareUrl.value); });
};

// ------------------------------
// メイン
// ------------------------------
(async function main(){
  const memo = $('#memo');
  const copyBtn = $('#copyBtn');
  const clearBtn = $('#clearBtn');

  // 1) IndexedDB から初期読み込み
  const saved = await db.get('noteText');
  if (typeof saved === 'string') {
    memo.value = saved;
  } else {
    // URL ?text= で初期値があれば採用
    const fromURL = getInitialTextFromURL();
    if (fromURL) {
      memo.value = fromURL;
      await db.set('noteText', fromURL);
    }
  }

  // 2) 自動保存（入力ごと。軽いデバウンス）
  let t;
  memo.addEventListener('input', () => {
    clearTimeout(t);
    const v = memo.value;
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

  // 5) リンクボタン描画
  const urlButtons = parseUrlButtons();
  const buttons = urlButtons.length ? urlButtons : DEFAULT_BUTTONS;
  renderButtons(buttons);

  // 6) 共有用URLフォーム初期化
  initShareForm();
})();
