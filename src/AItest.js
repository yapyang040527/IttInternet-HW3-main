import { GoogleGenAI } from '@google/genai';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCatFact } from "./apis/api1.js";
import { getJoke } from "./apis/api2.js";
import { getAdvice } from "./apis/api3.js";

// ====================================================================
// Custom Hook: useHover
// ====================================================================
/**
 * 追蹤一個 DOM 元素是否被滑鼠懸停。
 */
function useHover() {
  const [value, setValue] = useState(false);
  const ref = useRef(null);

  const handleMouseEnter = () => setValue(true);
  const handleMouseLeave = () => setValue(false);

  useEffect(() => {
    const node = ref.current;
    if (node) {
      node.addEventListener('mouseenter', handleMouseEnter);
      node.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        node.removeEventListener('mouseenter', handleMouseEnter);
        node.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, [ref.current]);

  return [ref, value];
}

// ====================================================================
// AItest 組件
// ====================================================================

export default function AItest({
  defaultModel = 'gemini-2.5-flash',
  starter = '嗨寳子！幫我安排一下臺北旅遊的一日行程～',
}) {
  const [model, setModel] = useState(defaultModel);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isKeyVisible, setIsKeyVisible] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('theme_mode');
    return savedMode === 'dark';
  });

  const [catFact, setCatFact] = useState("");
  const [joke, setJoke] = useState("");
  const [advice, setAdvice] = useState("");

  const [clearBtnRef, isClearBtnHovered] = useHover();

  const listRef = useRef(null);

  // 載入 API Key
  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) setApiKey(saved);
  }, []);

  // 儲存 Dark Mode 狀態
  useEffect(() => {
    localStorage.setItem('theme_mode', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // 啟動時加入歡迎訊息
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{ role: 'model', parts: [{ text: '👋 這裡是 Gemini 小幫手，有什麼想聊的？' }] }]);
    }
    if (starter && input === '') setInput(starter);
  }, [starter, input]);

  // 自動捲到底
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [history, loading]);

  // 獲取 API 數據
  useEffect(() => {
    getCatFact()
      .then((d) => {
        setCatFact(d.fact);
      })
      .catch((err) => console.error("Cat Fact Error:", err));

    getJoke()
      .then((d) => {
        setJoke(`${d.setup} — ${d.punchline}`);
      })
      .catch((err) => console.error("Joke Error:", err));

    getAdvice()
      .then((d) => {
        setAdvice(d.slip.advice);
      })
      .catch((err) => console.error("Advice Error:", err));
  }, []);

  const ai = useMemo(() => {
    try {
      return apiKey ? new GoogleGenAI({ apiKey }) : null;
    } catch {
      return null;
    }
  }, [apiKey]);

  const clearHistory = () => {
    setHistory([{ role: 'model', parts: [{ text: '👋 這裡是 Gemini 小幫手，有什麼想聊的？' }] }]);
    setError('');
    setLoading(false);
  };

  // 串流請求
  const sendMessage = useCallback(
    async (message) => {
      const content = (message ?? input).trim();
      if (!content || loading) return;
      if (!ai) {
        setError('請先輸入有效的 Gemini API Key');
        return;
      }

      setError('');
      setLoading(true);

      const userMsg = { role: 'user', parts: [{ text: content }] };
      const modelMsg = { role: 'model', parts: [{ text: '' }] };

      setHistory((h) => [...h, userMsg, modelMsg]);
      setInput('');

      try {
        const stream = await ai.models.generateContentStream({
          model,
          contents: [...history, userMsg],
        });

        let fullResponse = '';
        for await (const chunk of stream) {
          const chunkText = chunk.text || '';
          fullResponse += chunkText;

          setHistory((h) => {
            const updated = [...h];
            const last = updated[updated.length - 1];
            if (last && last.role === 'model') {
              last.parts[0].text = fullResponse;
            }
            return updated;
          });
        }
      } catch (err) {
        setError(err?.message || String(err));
        setHistory((h) => h.slice(0, h.length - 2));
      } finally {
        setLoading(false);
      }
    },
    [input, loading, ai, model, history]
  );

  function renderMarkdownLike(text) {
    const lines = text.split(/\n/);
    return (
      <>
        {lines.map((ln, i) => (
          <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {ln}
          </div>
        ))}
      </>
    );
  }

  const styles = getDynamicStyles(isDarkMode, isClearBtnHovered);

  return (
    <div style={styles.wrap}>
      <div style={styles.mainContainer}>
        {/* 左側設定區 */}
        <div style={styles.controlsPanel}>
          <div style={styles.headerLeft}>設定與控制</div>

          {/* 主題切換 */}
          <div style={{ ...styles.themeToggleContainer, marginBottom: 15 }}>
            <span>{isDarkMode ? '🌙 黑暗模式' : '☀️ 明亮模式'}</span>
            <label style={styles.switch}>
              <input
                type="checkbox"
                checked={isDarkMode}
                onChange={() => setIsDarkMode((p) => !p)}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              />
              <span style={styles.slider}>
                <span style={styles.sliderCircle}></span>
              </span>
            </label>
          </div>
          <div style={styles.internalDivider} />

          {/* Model 輸入 */}
          <div style={{ marginBottom: 15 }}>
            <label style={styles.label}>
              <span>Model</span>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="例如 gemini-2.5-flash"
                style={styles.input}
              />
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4, color: styles.color }}>
                請輸入有效的模型 ID。
              </div>
            </label>
          </div>
          <div style={styles.internalDivider} />

          {/* API Key */}
          <div style={{ marginBottom: 15 }}>
            <label style={styles.label}>
              <span>Gemini API Key</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
                <input
                  type={isKeyVisible ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    const v = e.target.value;
                    setApiKey(v);
                    if (rememberKey) localStorage.setItem('gemini_api_key', v);
                  }}
                  placeholder="貼上你的 API Key"
                  style={{ ...styles.input, flexGrow: 1, paddingRight: '25px' }}
                />
                <button
                  type="button"
                  onClick={() => setIsKeyVisible(!isKeyVisible)}
                  style={{
                    ...styles.eyeBtn,
                    marginLeft: '-20px',
                    color: styles.color,
                  }}
                >
                  {isKeyVisible ? '🙈' : '👁️'}
                </button>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 4,
                  color: styles.color,
                  fontSize: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberKey}
                  onChange={(e) => {
                    setRememberKey(e.target.checked);
                    if (!e.target.checked) localStorage.removeItem('gemini_api_key');
                    else if (apiKey) localStorage.setItem('gemini_api_key', apiKey);
                  }}
                  style={{ margin: 0 }}
                />
                <span>記住在本機</span>
              </label>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2, color: styles.color }}>
                Key 只儲存在瀏覽器。
              </div>
            </label>
          </div>
          <div style={styles.internalDivider} />

          {/* 清除對話 */}
          <div style={{ padding: '0px 0px 5px 0px' }}>
            <button
              ref={clearBtnRef}
              type="button"
              onClick={clearHistory}
              disabled={loading || history.length <= 1}
              style={styles.clearBtn}
            >
              🗑️ 清除對話歷史
            </button>
          </div>
        </div>

        {/* 右側聊天區 */}
        <div style={styles.chatArea}>
          <div style={styles.headerRight}>Gemini Chat（直連 SDK，不經 proxy）</div>

          {error && <div style={styles.error}>⚠ {error}</div>}

          <div ref={listRef} style={styles.messages}>
            {history.map((m, idx) => (
              <div
                key={idx}
                style={{
                  ...styles.msg,
                  ...(m.role === 'user' ? styles.user : styles.assistant),
                }}
              >
                <div style={styles.msgRole}>{m.role === 'user' ? 'You' : 'Gemini'}</div>
                <div style={styles.msgBody}>
                  {renderMarkdownLike(m.parts.map((p) => p.text).join('\n'))}
                </div>
              </div>
            ))}
          </div>

          <div style={styles.inputSection}>
            <div style={styles.suggestionsContainer}>
              {['今天台北有什麼免費展覽？', '幫我翻譯這句：Hello from Taipei!', '寫一首關於捷運的短詩'].map((q) => (
                <button key={q} type="button" style={styles.suggestion} onClick={() => sendMessage(q)}>
                  {q}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              style={styles.composer}
            >
              <textarea
                placeholder="輸入訊息，按 Ctrl/Cmd + Enter 送出"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                style={styles.textAreaInput}
                rows={3}
              />
              <button type="submit" disabled={loading || !input.trim() || !apiKey} style={styles.sendBtn}>
                {loading ? '傳送中...' : '送出'}
              </button>
            </form>
          </div>
        </div>

        {/* API 數據展示區 */}
        <div style={{...styles.chatArea, marginTop: '20px'}}>
          <div style={styles.headerRight}>📡 API 數據</div>
          
          <div style={{padding: '15px', backgroundColor: styles.subtleBackground, borderRadius: '8px', marginBottom: '10px'}}>
            <h3 style={{margin: '0 0 10px 0', color: styles.color}}>🐱 Cat Fact</h3>
            <p style={{margin: '0', color: styles.color, lineHeight: '1.5'}}>{catFact || '加載中...'}</p>
          </div>

          <div style={{padding: '15px', backgroundColor: styles.subtleBackground, borderRadius: '8px', marginBottom: '10px'}}>
            <h3 style={{margin: '0 0 10px 0', color: styles.color}}>😂 Joke</h3>
            <p style={{margin: '0', color: styles.color, lineHeight: '1.5'}}>{joke || '加載中...'}</p>
          </div>

          <div style={{padding: '15px', backgroundColor: styles.subtleBackground, borderRadius: '8px'}}>
            <h3 style={{margin: '0 0 10px 0', color: styles.color}}>💡 Advice</h3>
            <p style={{margin: '0', color: styles.color, lineHeight: '1.5'}}>{advice || '加載中...'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// 動態樣式生成
// ====================================================================
function getDynamicStyles(isDarkMode, isClearBtnHovered) {
  const primary = isDarkMode ? '#bb86fc' : '#111827';
  const text = isDarkMode ? '#e5e7eb' : '#1f2937';
  const secondaryText = isDarkMode ? '#9ca3af' : '#6b7280';
  const background = isDarkMode ? '#1f2937' : '#fff';
  const subtleBackground = isDarkMode ? '#374151' : '#f9fafb';
  const border = isDarkMode ? '#4b5563' : '#e5e7eb';
  const inputBackground = isDarkMode ? '#374151' : '#fff';
  const blockBackground = isDarkMode ? '#2d3748' : '#fff';

  const userBg = isDarkMode ? '#4c51bf' : '#eef2ff';
  const userBorder = isDarkMode ? '#6366f1' : '#c7d2fe';
  const assistantBg = isDarkMode ? '#374151' : '#f1f5f9';
  const assistantBorder = isDarkMode ? '#4b5563' : '#e2e8f0';

  const dividerColor = isDarkMode ? '#4b5563' : '#e5e7eb';

  return {
    color: text,
    internalDivider: {
      borderBottom: `1px solid ${dividerColor}`,
      margin: '0 0 15px 0',
    },
    wrap: {
      display: 'flex',
      width: '100vw',
      height: '100vh',
      padding: 20,
      boxSizing: 'border-box',
      background: subtleBackground,
      color: text,
    },
    mainContainer: {
      display: 'flex',
      width: '100%',
      height: '100%',
      borderRadius: 12,
      overflow: 'hidden',
      background,
      border: `1px solid ${border}`,
    },
    controlsPanel: {
      width: '300px',
      flexShrink: 0,
      padding: 15,
      borderRight: `1px solid ${border}`,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      background: blockBackground,
    },
    chatArea: {
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    },
    headerLeft: {
      paddingBottom: 10,
      fontWeight: 700,
      fontSize: 18,
      borderBottom: `1px solid ${dividerColor}`,
      marginBottom: 15,
    },
    headerRight: {
      padding: '10px 20px',
      fontWeight: 700,
      borderBottom: `1px solid ${border}`,
      background: subtleBackground,
      flexShrink: 0,
      fontSize: 18,
    },
    label: { display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: text },
    input: {
      padding: '8px 10px',
      borderRadius: 8,
      border: `1px solid ${border}`,
      fontSize: 14,
      background: inputBackground,
      color: text,
    },
    eyeBtn: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: 16,
      padding: '0',
      display: 'flex',
      alignItems: 'center',
      lineHeight: 1,
    },
    clearBtn: {
      width: '100%',
      background: isClearBtnHovered ? (isDarkMode ? '#1f2937' : '#f0f4f7') : inputBackground,
      border: `1px solid ${border}`,
      borderRadius: 8,
      color: secondaryText,
      padding: '10px 15px',
      cursor: 'pointer',
      fontSize: 14,
      transition: 'background-color 0.2s',
    },
    messages: {
      flexGrow: 4,
      padding: 20,
      display: 'grid',
      gap: 12,
      overflowY: 'auto',
      boxSizing: 'border-box',
      background,
    },
    inputSection: {
      flexGrow: 1,
      borderTop: `1px solid ${border}`,
      padding: 20,
      background: subtleBackground,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    },
    msg: { borderRadius: 12, padding: 12, border: `1px solid ${border}`, color: text },
    user: {
      background: userBg,
      borderColor: userBorder,
      marginLeft: 'auto',
      maxWidth: '85%',
    },
    assistant: {
      background: assistantBg,
      borderColor: assistantBorder,
      marginRight: 'auto',
      maxWidth: '85%',
    },
    msgRole: { fontSize: 13, fontWeight: 700, opacity: 0.7, marginBottom: 6, color: secondaryText },
    msgBody: { fontSize: 16, lineHeight: 1.6 },
    error: {
      color: isDarkMode ? '#fca5a5' : '#b91c1c',
      padding: '10px 20px',
      borderBottom: `1px solid ${isDarkMode ? '#ef4444' : '#fecaca'}`,
      background: isDarkMode ? '#450a0a' : '#fef2f2',
      flexShrink: 0,
    },
    composer: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 10,
    },
    textAreaInput: {
      padding: '12px 14px',
      borderRadius: 12,
      border: `1px solid ${border}`,
      fontSize: 16,
      resize: 'none',
      minHeight: 60,
      flexGrow: 1,
      background: inputBackground,
      color: text,
    },
    sendBtn: {
      padding: '10px 14px',
      borderRadius: 12,
      border: `1px solid ${primary}`,
      background: primary,
      color: isDarkMode ? '#1f2937' : '#fff',
      fontSize: 16,
      cursor: 'pointer',
      transition: 'opacity 0.2s',
    },
    suggestionsContainer: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    suggestion: {
      background: isDarkMode ? '#374151' : '#f3f4f6',
      border: `1px solid ${border}`,
      borderRadius: 8,
      padding: '6px 10px',
      fontSize: 13,
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    },
    switch: {
      position: 'relative',
      display: 'inline-block',
      width: 42,
      height: 22,
      marginLeft: 10,
    },
    slider: {
      position: 'absolute',
      cursor: 'pointer',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: isDarkMode ? '#4b5563' : '#ccc',
      borderRadius: 22,
      transition: '.4s',
    },
    sliderCircle: {
      position: 'absolute',
      height: 18,
      width: 18,
      left: isDarkMode ? '22px' : '2px',
      bottom: '2px',
      backgroundColor: 'white',
      borderRadius: '50%',
      transition: '.4s',
    },
    themeToggleContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 14,
      marginBottom: 10,
    },
  };
}
