import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts";

/* ─── Constants ─────────────────────────────────────────────────── */
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const QUARTERS = [
  { label: "Q1（1〜3月）",   months: [1,2,3]   },
  { label: "Q2（4〜6月）",   months: [4,5,6]   },
  { label: "Q3（7〜9月）",   months: [7,8,9]   },
  { label: "Q4（10〜12月）", months: [10,11,12] },
];
const SECTOR_TYPE = {
  "食料品":"defensive","医薬品":"defensive","電気・ガス業":"defensive",
  "情報・通信業":"defensive","通信":"defensive","銀行業":"defensive",
  "保険業":"defensive","その他金融業":"defensive","陸運業":"defensive",
  "海運業":"defensive","空運業":"defensive","倉庫・運輸関連業":"defensive",
  "サービス業":"defensive","小売業":"defensive",
  "輸送用機器":"cyclical","電気機器":"cyclical","機械":"cyclical",
  "鉄鋼":"cyclical","非鉄金属":"cyclical","化学":"cyclical",
  "石油・石炭製品":"cyclical","石油石炭":"cyclical","卸売業":"cyclical",
  "不動産業":"cyclical","建設業":"cyclical","繊維製品":"cyclical",
  "パルプ・紙":"cyclical","ゴム製品":"cyclical","金属製品":"cyclical",
  "精密機器":"cyclical","ガラス・土石製品":"cyclical",
  "証券・商品先物取引業":"cyclical",
};
const SECTOR_COLORS = [
  "#0a84ff","#ff9f0a","#30d158","#ff453a","#bf5af2",
  "#ff6961","#64d2ff","#ff375f","#a2d2ff","#5e5ce6",
  "#40c8e0","#ffd60a","#4cd964",
];
const CSV_HEADER = "銘柄コード,銘柄名,株数,取得単価,年間配当(1株),配当月(カンマ区切り),セクター";
const CSV_EXAMPLE = `7203,トヨタ自動車,100,2800,120,"3,9",輸送用機器\n8316,三井住友FG,50,5200,330,"3,9",銀行業`;
const SAMPLE_STOCKS = [
  { id:"s1", code:"7203", name:"トヨタ自動車",  shares:100, acquisitionPrice:2800, currentPrice:3520, annualDividend:120, dividendMonths:[3,9],  sector:"輸送用機器", lastUpdated:"2026/4/6" },
  { id:"s2", code:"8316", name:"三井住友FG",    shares:50,  acquisitionPrice:5200, currentPrice:8100, annualDividend:330, dividendMonths:[3,9],  sector:"銀行業",     lastUpdated:"2026/4/6" },
  { id:"s3", code:"2914", name:"JT",            shares:200, acquisitionPrice:2400, currentPrice:4200, annualDividend:194, dividendMonths:[6,12], sector:"食料品",     lastUpdated:"2026/4/6" },
  { id:"s4", code:"8058", name:"三菱商事",      shares:80,  acquisitionPrice:3100, currentPrice:2700, annualDividend:100, dividendMonths:[3,9],  sector:"卸売業",     lastUpdated:"2026/4/6" },
];

/* ─── Helpers ────────────────────────────────────────────────────── */
const fmt = n => Math.round(n).toLocaleString("ja-JP");
const pct = n => isFinite(n) ? n.toFixed(2) + "%" : "—";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const parseCSVLine = line => {
  const cols = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; continue; }
    if (line[i] === ',' && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
    cur += line[i];
  }
  cols.push(cur.trim()); return cols;
};

/* ─── Storage ────────────────────────────────────────────────────── */
const load = async key => { try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; } };
const save = async (key, val) => { try { await window.storage.set(key, JSON.stringify(val)); } catch {} };

/* ─── Design tokens ──────────────────────────────────────────────── */
const C = {
  bg:        "#000000",
  bg2:       "#1c1c1e",
  bg3:       "#2c2c2e",
  bg4:       "#3a3a3c",
  sep:       "rgba(255,255,255,0.08)",
  textPri:   "#ffffff",
  textSec:   "rgba(255,255,255,0.6)",
  textTer:   "rgba(255,255,255,0.3)",
  blue:      "#0a84ff",
  green:     "#30d158",
  red:       "#ff453a",
  orange:    "#ff9f0a",
  purple:    "#bf5af2",
  teal:      "#40c8e0",
};

/* ─── UI Primitives ──────────────────────────────────────────────── */
const Card = ({ children, style = {}, className = "" }) => (
  <div style={{
    background: C.bg2,
    borderRadius: 20,
    overflow: "hidden",
    ...style,
  }} className={className}>{children}</div>
);

const Btn = ({ children, variant = "primary", onClick, disabled, style = {} }) => {
  const variants = {
    primary:   { background: C.blue,   color: "#fff" },
    secondary: { background: C.bg3,    color: C.textSec },
    danger:    { background: "rgba(255,69,58,0.15)", color: C.red },
    ghost:     { background: "transparent", color: C.textSec },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...variants[variant],
        border: "none",
        borderRadius: 12,
        fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
        fontSize: 14,
        fontWeight: 600,
        padding: "10px 18px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "opacity 0.15s, transform 0.1s",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        letterSpacing: "-0.2px",
        ...style,
      }}
    >{children}</button>
  );
};

const Input = ({ label, ...p }) => (
  <label style={{ display: "block" }}>
    {label && <span style={{ display: "block", fontSize: 12, color: C.textTer, marginBottom: 6, fontWeight: 500, letterSpacing: "0.2px" }}>{label}</span>}
    <input
      style={{
        width: "100%", background: C.bg3, border: `1px solid ${C.sep}`,
        borderRadius: 12, padding: "11px 14px", fontSize: 14,
        color: C.textPri, outline: "none", fontFamily: "-apple-system, sans-serif",
        boxSizing: "border-box", letterSpacing: "-0.2px",
      }}
      {...p}
    />
  </label>
);

const Select = ({ label, children, ...p }) => (
  <label style={{ display: "block" }}>
    {label && <span style={{ display: "block", fontSize: 12, color: C.textTer, marginBottom: 6, fontWeight: 500 }}>{label}</span>}
    <select
      style={{
        width: "100%", background: C.bg3, border: `1px solid ${C.sep}`,
        borderRadius: 12, padding: "11px 14px", fontSize: 14,
        color: C.textPri, outline: "none", fontFamily: "-apple-system, sans-serif",
        boxSizing: "border-box",
      }}
      {...p}
    >{children}</select>
  </label>
);

const Modal = ({ title, onClose, children }) => (
  <div
    onClick={e => e.target === e.currentTarget && onClose()}
    style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      zIndex: 50, display: "flex", alignItems: "flex-end",
      justifyContent: "center", padding: "0 0 0 0",
    }}
  >
    <div style={{
      background: C.bg2, borderRadius: "24px 24px 0 0",
      width: "100%", maxWidth: 480,
      maxHeight: "85vh", overflow: "hidden",
      display: "flex", flexDirection: "column",
      animation: "slideUp 0.3s cubic-bezier(0.32,0.72,0,1)",
    }}>
      {/* Handle */}
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
        <div style={{ width: 36, height: 4, background: C.bg4, borderRadius: 2 }} />
      </div>
      <div style={{ padding: "12px 20px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.sep}` }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: C.textPri, letterSpacing: "-0.4px" }}>{title}</span>
        <button onClick={onClose} style={{ background: C.bg3, border: "none", borderRadius: "50%", width: 28, height: 28, color: C.textSec, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>
      <div style={{ padding: "16px 20px 32px", overflowY: "auto", flex: 1 }}>{children}</div>
    </div>
  </div>
);

const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(44,44,46,0.95)", backdropFilter: "blur(20px)", borderRadius: 12, padding: "8px 12px", border: `1px solid ${C.sep}` }}>
      <p style={{ fontSize: 11, color: C.textTer, marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 600, color: C.textPri }}>¥{fmt(payload[0]?.value)}</p>
    </div>
  );
};

const BenchTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(44,44,46,0.95)", backdropFilter: "blur(20px)", borderRadius: 12, padding: "8px 12px", border: `1px solid ${C.sep}` }}>
      <p style={{ fontSize: 11, color: C.textTer, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 13, fontWeight: 600, color: p.color }}>{p.name}：{Number(p.value).toFixed(1)}</p>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [tab, setTab]         = useState("dash");
  const [stocks, setStocksS]  = useState([]);
  const [history, setHistoryS]= useState([]);
  const [modal, setModal]     = useState(null);
  const [delId, setDelId]     = useState(null);
  const [fetching, setFetching]   = useState(false);
  const [fetchMsg, setFetchMsg]   = useState("");
  const [csvText, setCsvText]     = useState("");
  const [ns, setNs] = useState({ code:"", name:"", shares:"", acquisitionPrice:"", currentPrice:"", annualDividend:"", dividendMonths:"3,9", sector:"" });
  const [nh, setNh] = useState({ code:"", date:"", amount:"" });
  const [snapshots, setSnapshots]       = useState([]);
  const [benchData, setBenchData]       = useState([]);
  const [benchLoading, setBenchLoading] = useState(false);
  const [benchMsg, setBenchMsg]         = useState("");
  const [memoStockId, setMemoStockId]   = useState(null);
  const [memoText, setMemoText]         = useState("");
  const [perfFrom, setPerfFrom]         = useState("");
  const [perfTo, setPerfTo]             = useState("");

  useEffect(() => {
    (async () => {
      const s  = await load("div-stocks");
      const h  = await load("div-history");
      const sn = await load("div-snapshots");
      const bd = await load("div-benchdata");
      if (s)  setStocksS(s);
      if (h)  setHistoryS(h);
      if (sn) setSnapshots(sn);
      if (bd) setBenchData(bd);
    })();
  }, []);

  const saveStocks  = async s => { setStocksS(s);  await save("div-stocks",  s); };
  const saveHistory = async h => { setHistoryS(h); await save("div-history", h); };

  useEffect(() => {
    if (!stocks.length) return;
    const val = stocks.reduce((a, s) => a + s.shares * (s.currentPrice || s.acquisitionPrice), 0);
    if (val === 0) return;
    const today = new Date().toLocaleDateString("ja-JP");
    setSnapshots(prev => {
      const filtered = prev.filter(p => p.date !== today);
      const next = [...filtered, { date: today, value: val }].slice(-90);
      save("div-snapshots", next);
      return next;
    });
  }, [stocks]);

  /* ── Computed ── */
  const totalCost      = stocks.reduce((a, s) => a + s.shares * s.acquisitionPrice, 0);
  const totalValue     = stocks.reduce((a, s) => a + s.shares * (s.currentPrice || s.acquisitionPrice), 0);
  const totalAnnualDiv = stocks.reduce((a, s) => a + s.shares * s.annualDividend, 0);
  const costYield      = totalCost  > 0 ? totalAnnualDiv / totalCost  * 100 : 0;
  const curYield       = totalValue > 0 ? totalAnnualDiv / totalValue * 100 : 0;
  const unrealized     = totalValue - totalCost;
  const totalHistory   = history.reduce((a, h) => a + h.amount, 0);

  const monthlyData = MONTHS.map((m, i) => ({
    month: m.replace("月", ""),
    label: m,
    amount: stocks.reduce((a, s) => {
      if (s.dividendMonths?.includes(i + 1))
        return a + s.shares * s.annualDividend / (s.dividendMonths.length || 1);
      return a;
    }, 0),
  }));

  /* ── Auto-fetch ── */
  const fetchStockData = async () => {
    if (!stocks.length) return;
    setFetching(true); setFetchMsg("🔍 株価・配当情報を検索中…");
    const codeList = stocks.map(s => `${s.code}(${s.name})`).join("、");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `以下の日本株について、web検索で最新の株価（円）と年間配当金（1株あたり・円）を調べてください。JSONのみ返してください（説明文・コードブロック・バッククォート不要）。形式: [{"code":"7203","currentPrice":3520,"annualDividend":120}] 銘柄: ${codeList}` }]
        })
      });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
      const match = text.match(/\[[\s\S]*?\]/);
      if (!match) throw new Error("no json");
      const fetched = JSON.parse(match[0]);
      const updated = stocks.map(s => {
        const f = fetched.find(x => x.code === s.code);
        return f ? { ...s, currentPrice: f.currentPrice || s.currentPrice, annualDividend: f.annualDividend || s.annualDividend, lastUpdated: new Date().toLocaleDateString("ja-JP") } : s;
      });
      await saveStocks(updated); setFetchMsg("✅ 更新完了！");
    } catch { setFetchMsg("⚠️ 取得に失敗しました"); }
    setFetching(false); setTimeout(() => setFetchMsg(""), 5000);
  };

  const fetchBenchmark = async () => {
    if (!snapshots.length) { setBenchMsg("⚠️ 株価を更新してからお試しください"); setTimeout(() => setBenchMsg(""), 4000); return; }
    setBenchLoading(true); setBenchMsg("🔍 日経・TOPIXデータを取得中…");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `日経平均株価とTOPIXの直近6ヶ月分の月次終値を調べてください。今日は${new Date().toLocaleDateString("ja-JP")}です。JSONのみ返してください（説明文・コードブロック・バッククォート一切不要）。形式: [{"date":"2025/10","nikkei":38000,"topix":2700}] dateはYYYY/MM形式、6ヶ月分。` }]
        })
      });
      const data = await res.json();
      const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
      const match = text.match(/\[[\s\S]*?\]/);
      if (!match) throw new Error("parse error");
      const raw = JSON.parse(match[0]);
      const base = { nikkei: raw[0].nikkei, topix: raw[0].topix };
      const normalized = raw.map(r => ({
        date: r.date,
        日経225: parseFloat((r.nikkei / base.nikkei * 100).toFixed(2)),
        TOPIX:   parseFloat((r.topix  / base.topix  * 100).toFixed(2)),
      }));
      await save("div-benchdata", normalized); setBenchData(normalized); setBenchMsg("✅ 取得完了！");
    } catch { setBenchMsg("⚠️ 取得に失敗しました"); }
    setBenchLoading(false); setTimeout(() => setBenchMsg(""), 5000);
  };

  /* ── CSV import ── */
  const handleImport = () => {
    const lines = csvText.trim().split("\n");
    const start = lines[0].toLowerCase().includes("コード") ? 1 : 0;
    const parsed = lines.slice(start).map(line => {
      const c = parseCSVLine(line);
      if (c.length < 5 || !c[0]) return null;
      return { id: uid(), code: c[0], name: c[1], shares: Number(c[2]), acquisitionPrice: Number(c[3]), currentPrice: Number(c[3]), annualDividend: Number(c[4]), dividendMonths: c[5] ? c[5].split(",").map(Number).filter(Boolean) : [3,9], sector: c[6] || "", lastUpdated: null };
    }).filter(Boolean);
    saveStocks([...stocks, ...parsed]); setCsvText(""); setModal(null);
  };

  const handleAddStock = () => {
    const months = ns.dividendMonths.split(",").map(s => parseInt(s.trim())).filter(Boolean);
    saveStocks([...stocks, { id: uid(), code: ns.code.trim(), name: ns.name.trim(), shares: Number(ns.shares), acquisitionPrice: Number(ns.acquisitionPrice), currentPrice: ns.currentPrice ? Number(ns.currentPrice) : Number(ns.acquisitionPrice), annualDividend: Number(ns.annualDividend), dividendMonths: months, sector: ns.sector.trim(), lastUpdated: null }]);
    setNs({ code:"", name:"", shares:"", acquisitionPrice:"", currentPrice:"", annualDividend:"", dividendMonths:"3,9", sector:"" }); setModal(null);
  };

  const handleAddHistory = () => {
    const stock = stocks.find(s => s.code === nh.code);
    const updated = [...history, { id: uid(), code: nh.code, name: stock?.name || nh.code, date: nh.date, amount: Number(nh.amount) }].sort((a, b) => b.date.localeCompare(a.date));
    saveHistory(updated); setNh({ code:"", date:"", amount:"" }); setModal(null);
  };

  const exportCSV = () => {
    const rows = stocks.map(s => `${s.code},${s.name},${s.shares},${s.acquisitionPrice},${s.annualDividend},"${(s.dividendMonths||[]).join(",")}",${s.sector}`);
    const blob = new Blob(["\uFEFF" + [CSV_HEADER, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "dividend_portfolio.csv"; a.click();
  };

  /* ─────────────────────────────────────────────────────────────── */
  /* RENDER                                                           */
  /* ─────────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.textPri, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', 'Hiragino Sans', sans-serif", paddingBottom: 100 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.3); }
        select option { background: #2c2c2e; }
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes fadeUp {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .fade-up { animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        .fade-up:nth-child(1) { animation-delay: 0s; }
        .fade-up:nth-child(2) { animation-delay: 0.06s; }
        .fade-up:nth-child(3) { animation-delay: 0.12s; }
        .fade-up:nth-child(4) { animation-delay: 0.18s; }
        .fade-up:nth-child(5) { animation-delay: 0.24s; }
        .tab-active-indicator {
          position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
          width: 4px; height: 4px; border-radius: 50%; background: ${C.blue};
        }
        .stock-row:hover { background: rgba(255,255,255,0.03); }
        .icon-btn { background: none; border: none; cursor: pointer; transition: opacity 0.15s; }
        .icon-btn:hover { opacity: 0.7; }
        textarea { background: ${C.bg3}; border: 1px solid ${C.sep}; border-radius: 12px; padding: 11px 14px; font-size: 14px; color: ${C.textPri}; resize: none; width: 100%; outline: none; font-family: -apple-system, sans-serif; box-sizing: border-box; }
        textarea::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${C.sep}` }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: C.textTer, letterSpacing: "0.5px", marginBottom: 2 }}>PORTFOLIO</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.8px" }}>配当管理</div>
          </div>
          <Btn
            variant="ghost"
            onClick={fetchStockData}
            disabled={fetching || !stocks.length}
            style={{ background: C.bg3, color: fetching ? C.textTer : C.blue, fontSize: 13, padding: "8px 14px", borderRadius: 20 }}
          >
            {fetching ? "⏳ 取得中" : "🔄 株価更新"}
          </Btn>
        </div>
        {fetchMsg && (
          <div style={{ background: C.bg3, textAlign: "center", padding: "8px", fontSize: 12, color: C.textSec }}>
            {fetchMsg}
          </div>
        )}
      </div>

      {/* ── Bottom Tab Bar ── */}
      {(() => {
        const TAB_ICONS = {
          dash: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.blue : C.textTer} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
          ),
          forecast: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.blue : C.textTer} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="7" y1="13" x2="7" y2="17"/>
              <line x1="12" y1="13" x2="12" y2="17"/>
              <line x1="17" y1="13" x2="17" y2="17"/>
            </svg>
          ),
          history: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.blue : C.textTer} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <polyline points="12 7 12 12 15.5 15.5"/>
            </svg>
          ),
          perf: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.blue : C.textTer} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          ),
          bench: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.blue : C.textTer} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
              <line x1="2" y1="20" x2="22" y2="20"/>
            </svg>
          ),
          settings: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.blue : C.textTer} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          ),
        };
        return (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: `1px solid ${C.sep}`, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            <div style={{ maxWidth: 480, margin: "0 auto", display: "flex" }}>
              {[
                ["dash",     "保有"],
                ["forecast", "予測"],
                ["history",  "履歴"],
                ["perf",     "騰落率"],
                ["bench",    "比較"],
                ["settings", "設定"],
              ].map(([id, label]) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    style={{ flex: 1, background: "none", border: "none", padding: "10px 0 8px", cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "opacity 0.15s" }}
                  >
                    <div style={{ transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)", transform: active ? "scale(1.15)" : "scale(1)" }}>
                      {TAB_ICONS[id](active)}
                    </div>
                    <span style={{ fontSize: 10, color: active ? C.blue : C.textTer, fontWeight: active ? 600 : 400, letterSpacing: "0.1px", transition: "color 0.15s" }}>{label}</span>
                    {active && <div className="tab-active-indicator" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Main ── */}
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 0" }}>

        {/* ══ DASHBOARD ══ */}
        {tab === "dash" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {stocks.length > 0 && (
              <>
                {/* Hero card */}
                <div className="fade-up" style={{ background: "linear-gradient(145deg, #0f2644 0%, #1a1a2e 40%, #1c1c1e 100%)", borderRadius: 24, padding: "24px 20px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, background: "radial-gradient(circle, rgba(10,132,255,0.2) 0%, transparent 65%)", pointerEvents: "none" }} />
                  <div style={{ fontSize: 13, color: C.textTer, letterSpacing: "0.3px", marginBottom: 6 }}>総評価額</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1 }}>¥{fmt(totalValue)}</span>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, background: unrealized >= 0 ? "rgba(48,209,88,0.15)" : "rgba(255,69,58,0.15)" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: unrealized >= 0 ? C.green : C.red }}>
                      {unrealized >= 0 ? "+" : ""}¥{fmt(unrealized)}
                    </span>
                    <span style={{ fontSize: 11, color: C.textTer }}>含み損益</span>
                  </div>
                  {/* Divider */}
                  <div style={{ height: 1, background: C.sep, margin: "16px 0" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>
                    {[
                      { label: "年間配当（予想）", val: `¥${fmt(totalAnnualDiv)}` },
                      { label: "取得利回り",        val: pct(costYield) },
                      { label: "時価利回り",         val: pct(curYield) },
                    ].map((s, i) => (
                      <div key={i} style={{ borderRight: i < 2 ? `1px solid ${C.sep}` : "none", paddingRight: i < 2 ? 12 : 0, paddingLeft: i > 0 ? 12 : 0 }}>
                        <div style={{ fontSize: 10, color: C.textTer, marginBottom: 4, letterSpacing: "0.1px" }}>{s.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri, letterSpacing: "-0.3px" }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats grid */}
                <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Card style={{ padding: "16px" }}>
                    <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>総投資額</div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" }}>¥{fmt(totalCost)}</div>
                  </Card>
                  <Card style={{ padding: "16px" }}>
                    <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>保有銘柄数</div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" }}>{stocks.length}<span style={{ fontSize: 13, color: C.textTer, marginLeft: 4 }}>銘柄</span></div>
                  </Card>
                </div>
              </>
            )}

            {/* Stock list */}
            <div className="fade-up">
              <Card>
                <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.sep}` }}>
                  <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px" }}>保有銘柄</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {stocks.length === 0 && (
                      <Btn variant="secondary" onClick={() => saveStocks(SAMPLE_STOCKS)} style={{ fontSize: 12, padding: "7px 12px" }}>サンプル</Btn>
                    )}
                    <Btn variant="secondary" onClick={() => setModal("import")} style={{ fontSize: 12, padding: "7px 12px" }}>📥 CSV</Btn>
                    <Btn onClick={() => setModal("add")} style={{ fontSize: 12, padding: "7px 12px" }}>＋ 追加</Btn>
                  </div>
                </div>

                {stocks.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 20px", color: C.textTer }}>
                    <span style={{ fontSize: 48, marginBottom: 12 }}>📊</span>
                    <p style={{ fontSize: 15, fontWeight: 600, color: C.textSec }}>銘柄を追加してください</p>
                    <p style={{ fontSize: 13, marginTop: 4 }}>CSVインポートまたは手動追加</p>
                  </div>
                ) : (
                  <div>
                    {stocks.map((s, idx) => {
                      const annual     = s.shares * s.annualDividend;
                      const sCostYield = s.acquisitionPrice > 0 ? s.annualDividend / s.acquisitionPrice * 100 : 0;
                      const curP       = s.currentPrice || s.acquisitionPrice;
                      const g          = curP - s.acquisitionPrice;
                      return (
                        <div key={s.id} className="stock-row" style={{ padding: "14px 16px", borderTop: idx > 0 ? `1px solid ${C.sep}` : "none", transition: "background 0.15s" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.3px" }}>{s.name}</div>
                              <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>{s.code}{s.sector ? ` · ${s.sector}` : ""}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: g >= 0 ? C.green : C.red, letterSpacing: "-0.4px" }}>¥{fmt(curP)}</div>
                              <div style={{ fontSize: 11, color: g >= 0 ? C.green : C.red, marginTop: 1 }}>{g >= 0 ? "+" : ""}¥{fmt(g)}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", gap: 16 }}>
                              <div>
                                <div style={{ fontSize: 10, color: C.textTer }}>株数</div>
                                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{fmt(s.shares)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: C.textTer }}>年間配当</div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: C.orange, marginTop: 2 }}>¥{fmt(annual)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: C.textTer }}>取得利回り</div>
                                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{pct(sCostYield)}</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="icon-btn" onClick={() => { setMemoStockId(s.id); setMemoText(s.memo || ""); setModal("memo"); }} style={{ fontSize: 16, color: s.memo ? C.orange : C.textTer }}>💬</button>
                              <button className="icon-btn" onClick={() => { setDelId(s.id); setModal("del"); }} style={{ fontSize: 14, color: C.textTer }}>✕</button>
                            </div>
                          </div>
                          {/* Dividend months pills */}
                          <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                            {(s.dividendMonths || []).map(m => (
                              <span key={m} style={{ fontSize: 10, background: "rgba(10,132,255,0.15)", color: C.blue, borderRadius: 6, padding: "2px 7px", fontWeight: 600 }}>{m}月</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {/* Total row */}
                    <div style={{ padding: "14px 16px", borderTop: `1px solid rgba(255,255,255,0.12)`, background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: C.textSec, fontWeight: 600 }}>合計 {stocks.length}銘柄</span>
                      <div style={{ display: "flex", gap: 20, textAlign: "right" }}>
                        <div>
                          <div style={{ fontSize: 10, color: C.textTer }}>評価額</div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>¥{fmt(totalValue)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: C.textTer }}>年間配当</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.orange }}>¥{fmt(totalAnnualDiv)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ══ FORECAST ══ */}
        {tab === "forecast" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Monthly chart */}
            <div className="fade-up">
              <Card style={{ padding: "20px 12px 16px" }}>
                <div style={{ padding: "0 8px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px" }}>月次配当予測</div>
                    <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>年間 ¥{fmt(totalAnnualDiv)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: C.textTer }}>月平均 ¥{fmt(totalAnnualDiv / 12)}</div>
                </div>
                {stocks.length === 0 ? (
                  <p style={{ textAlign: "center", color: C.textTer, padding: "32px 0", fontSize: 14 }}>銘柄を追加すると予測が表示されます</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={monthlyData} margin={{ top: 0, right: 8, left: -28, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.sep} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.textTer }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: C.textTer }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                      <Bar dataKey="amount" fill={C.blue} radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* Quarterly */}
            <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {QUARTERS.map(q => {
                const amount = monthlyData.filter((_, i) => q.months.includes(i + 1)).reduce((a, m) => a + m.amount, 0);
                return (
                  <Card key={q.label} style={{ padding: "16px" }}>
                    <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>{q.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" }}>¥{fmt(amount)}</div>
                  </Card>
                );
              })}
            </div>

            {/* Per-stock breakdown */}
            {stocks.length > 0 && (
              <div className="fade-up">
                <Card style={{ padding: "20px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 16 }}>銘柄別配当構成</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {[...stocks].sort((a, b) => b.shares * b.annualDividend - a.shares * a.annualDividend).map(s => {
                      const annual = s.shares * s.annualDividend;
                      const ratio  = totalAnnualDiv > 0 ? annual / totalAnnualDiv * 100 : 0;
                      return (
                        <div key={s.id}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                            <span style={{ fontSize: 12, color: C.textTer }}>¥{fmt(annual)} ({ratio.toFixed(1)}%)</span>
                          </div>
                          <div style={{ height: 4, background: C.bg3, borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", background: C.blue, borderRadius: 99, width: `${ratio}%`, opacity: 0.8, transition: "width 0.6s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* Sector */}
            {stocks.length > 0 && (() => {
              const sectorMap = {};
              stocks.forEach(s => { const k = s.sector || "未分類"; sectorMap[k] = (sectorMap[k] || 0) + s.shares * (s.currentPrice || s.acquisitionPrice); });
              const total = Object.values(sectorMap).reduce((a, b) => a + b, 0) || 1;
              const sectorData = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, color: SECTOR_COLORS[i % SECTOR_COLORS.length] }));
              let cyc = 0, def = 0, unk = 0;
              stocks.forEach(s => { const a = s.shares * (s.currentPrice || s.acquisitionPrice); const t = SECTOR_TYPE[s.sector]; if (t === "cyclical") cyc += a; else if (t === "defensive") def += a; else unk += a; });
              const tot = cyc + def + unk || 1;
              return (
                <>
                  <div className="fade-up">
                    <Card style={{ padding: "20px" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 16 }}>セクター別比率</div>
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        <div style={{ flexShrink: 0 }}>
                          <ResponsiveContainer width={140} height={140}>
                            <PieChart>
                              <Pie data={sectorData} cx="50%" cy="50%" innerRadius={42} outerRadius={64} dataKey="value" paddingAngle={3} startAngle={90} endAngle={-270}>
                                {sectorData.map((e, i) => <Cell key={i} fill={e.color} stroke={C.bg2} strokeWidth={2} />)}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                          {sectorData.map((s, i) => (
                            <div key={i}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: C.textSec, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{(s.value / total * 100).toFixed(1)}%</span>
                              </div>
                              <div style={{ height: 3, background: C.bg3, borderRadius: 99 }}>
                                <div style={{ height: "100%", background: s.color, borderRadius: 99, width: `${s.value / total * 100}%`, opacity: 0.8 }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="fade-up">
                    <Card style={{ padding: "20px" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 4 }}>景気敏感 vs ディフェンシブ</div>
                      <div style={{ fontSize: 12, color: C.textTer, marginBottom: 16 }}>時価ベース</div>
                      {[
                        { label: "ディフェンシブ", pct: def / tot * 100, color: C.green },
                        { label: "景気敏感",       pct: cyc / tot * 100, color: C.blue  },
                        ...(unk / tot * 100 > 0.5 ? [{ label: "未分類", pct: unk / tot * 100, color: C.bg4 }] : []),
                      ].map(row => (
                        <div key={row.label} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: row.color }}>{row.pct.toFixed(1)}%</span>
                          </div>
                          <div style={{ height: 6, background: C.bg3, borderRadius: 99 }}>
                            <div style={{ height: "100%", background: row.color, borderRadius: 99, width: `${row.pct}%`, transition: "width 0.7s ease" }} />
                          </div>
                        </div>
                      ))}
                      <div style={{ background: C.bg3, borderRadius: 12, padding: "10px 14px", fontSize: 12, color: C.textTer, lineHeight: 1.5, marginTop: 4 }}>
                        💡 ディフェンシブ銘柄は景気後退時に安定、景気敏感銘柄は拡大期に高リターンが期待されます。
                      </div>
                    </Card>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ══ HISTORY ══ */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {history.length > 0 && (
              <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Card style={{ padding: "16px" }}>
                  <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>累計受取配当</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px", color: C.green }}>¥{fmt(totalHistory)}</div>
                </Card>
                <Card style={{ padding: "16px" }}>
                  <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>受取回数</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" }}>{history.length}<span style={{ fontSize: 13, color: C.textTer, marginLeft: 4 }}>回</span></div>
                </Card>
              </div>
            )}
            <div className="fade-up">
              <Card>
                <div style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.sep}` }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>受取履歴</span>
                  <Btn onClick={() => setModal("hist")} style={{ fontSize: 12, padding: "7px 12px" }}>＋ 記録</Btn>
                </div>
                {history.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 20px", color: C.textTer }}>
                    <span style={{ fontSize: 48, marginBottom: 12 }}>💰</span>
                    <p style={{ fontSize: 15, fontWeight: 600, color: C.textSec }}>まだ記録がありません</p>
                    <p style={{ fontSize: 13, marginTop: 4 }}>配当受取時に記録してください</p>
                  </div>
                ) : (
                  history.map((h, i) => (
                    <div key={h.id} style={{ padding: "14px 16px", borderTop: i > 0 ? `1px solid ${C.sep}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{h.name}</div>
                        <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>{h.date}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: C.green }}>+¥{fmt(h.amount)}</span>
                        <button className="icon-btn" onClick={() => saveHistory(history.filter(x => x.id !== h.id))} style={{ color: C.textTer, fontSize: 14, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </div>
        )}

        {/* ══ PERFORMANCE ══ */}
        {tab === "perf" && (() => {
          const hasSnaps = snapshots.length >= 2;
          const minDate  = snapshots[0]?.date ?? "";
          const maxDate  = snapshots[snapshots.length - 1]?.date ?? "";

          const fromSnap = perfFrom
            ? snapshots.find(s => s.date >= perfFrom) ?? snapshots[0]
            : snapshots[0];
          const toSnap = perfTo
            ? [...snapshots].reverse().find(s => s.date <= perfTo) ?? snapshots[snapshots.length - 1]
            : snapshots[snapshots.length - 1];

          const fromVal  = fromSnap?.value ?? 0;
          const toVal    = toSnap?.value   ?? 0;
          const diff     = toVal - fromVal;
          const pctDiff  = fromVal > 0 ? diff / fromVal * 100 : null;
          const isGain   = pctDiff !== null && pctDiff >= 0;

          const applyPreset = days => {
            if (days === null) { setPerfFrom(""); setPerfTo(""); return; }
            const to = new Date(), from = new Date();
            from.setDate(from.getDate() - days);
            setPerfFrom(from.toISOString().slice(0, 10));
            setPerfTo(to.toISOString().slice(0, 10));
          };

          // Chart data sliced to selected range
          const chartData = hasSnaps
            ? snapshots.filter(s => (!perfFrom || s.date >= perfFrom) && (!perfTo || s.date <= perfTo))
            : [];

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Hero result card */}
              <div className="fade-up" style={{
                background: !hasSnaps
                  ? C.bg2
                  : isGain
                    ? "linear-gradient(145deg, #0d2e1a 0%, #1c1c1e 100%)"
                    : "linear-gradient(145deg, #2e0d0d 0%, #1c1c1e 100%)",
                borderRadius: 24, padding: "28px 20px", position: "relative", overflow: "hidden",
              }}>
                {hasSnaps && (
                  <div style={{
                    position: "absolute", top: -60, right: -60, width: 200, height: 200,
                    background: `radial-gradient(circle, ${isGain ? "rgba(48,209,88,0.2)" : "rgba(255,69,58,0.2)"} 0%, transparent 65%)`,
                    pointerEvents: "none",
                  }} />
                )}
                <div style={{ fontSize: 12, color: C.textTer, letterSpacing: "0.4px", marginBottom: 8 }}>
                  {hasSnaps && fromSnap && toSnap
                    ? `${fromSnap.date} → ${toSnap.date}`
                    : "期間を指定してください"}
                </div>
                <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-2px", lineHeight: 1, color: !hasSnaps ? C.textTer : isGain ? C.green : C.red }}>
                  {pctDiff !== null ? `${isGain ? "+" : ""}${pctDiff.toFixed(2)}%` : "—"}
                </div>
                {pctDiff !== null && (
                  <div style={{ marginTop: 12, display: "flex", gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.textTer, marginBottom: 3 }}>損益額</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: isGain ? C.green : C.red, letterSpacing: "-0.5px" }}>
                        {isGain ? "+" : ""}¥{fmt(diff)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.textTer, marginBottom: 3 }}>開始時評価額</div>
                      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.5px" }}>¥{fmt(fromVal)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.textTer, marginBottom: 3 }}>終了時評価額</div>
                      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.5px" }}>¥{fmt(toVal)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Preset chips */}
              <div className="fade-up">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "1週間",  days: 7   },
                    { label: "2週間",  days: 14  },
                    { label: "1ヶ月",  days: 30  },
                    { label: "3ヶ月",  days: 90  },
                    { label: "6ヶ月",  days: 180 },
                    { label: "全期間", days: null },
                  ].map(p => {
                    // Determine if this preset is currently active
                    const isActive = (() => {
                      if (p.days === null) return !perfFrom && !perfTo;
                      const from = new Date(); from.setDate(from.getDate() - p.days);
                      return perfFrom === from.toISOString().slice(0, 10);
                    })();
                    return (
                      <button
                        key={p.label}
                        onClick={() => applyPreset(p.days)}
                        style={{
                          padding: "8px 16px", borderRadius: 99, fontSize: 13, fontWeight: isActive ? 700 : 500,
                          border: `1px solid ${isActive ? C.blue : C.bg4}`,
                          background: isActive ? "rgba(10,132,255,0.15)" : "none",
                          color: isActive ? C.blue : C.textSec, cursor: "pointer", transition: "all 0.15s",
                        }}
                      >{p.label}</button>
                    );
                  })}
                </div>
              </div>

              {/* Date pickers */}
              <div className="fade-up">
                <Card style={{ padding: "20px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, letterSpacing: "-0.3px" }}>期間を指定</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { label: "開始日", val: perfFrom, set: setPerfFrom },
                      { label: "終了日", val: perfTo,   set: setPerfTo   },
                    ].map(({ label, val, set }) => (
                      <div key={label}>
                        <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>{label}</div>
                        <input
                          type="date"
                          min={minDate} max={maxDate}
                          value={val}
                          onChange={e => set(e.target.value)}
                          style={{ width: "100%", background: C.bg3, border: `1px solid ${C.sep}`, borderRadius: 12, padding: "11px 12px", fontSize: 14, color: C.textPri, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                    ))}
                  </div>
                  {!hasSnaps && (
                    <div style={{ marginTop: 14, background: C.bg3, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.textTer, lineHeight: 1.5 }}>
                      💡 「株価更新」を複数回行うとスナップショットが蓄積され、期間比較が使えるようになります。
                    </div>
                  )}
                </Card>
              </div>

              {/* Chart for selected period */}
              {chartData.length >= 2 && (
                <div className="fade-up">
                  <Card style={{ padding: "20px 12px 16px" }}>
                    <div style={{ padding: "0 8px", marginBottom: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.3px" }}>評価額の推移</div>
                      <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>選択期間中のポートフォリオ評価額</div>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={chartData} margin={{ top: 4, right: 16, left: -24, bottom: 0 }}>
                        <defs>
                          <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isGain ? C.green : C.red} stopOpacity={0.25} />
                            <stop offset="100%" stopColor={isGain ? C.green : C.red} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.sep} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.textTer }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(5)} />
                        <YAxis
                          tick={{ fontSize: 9, fill: C.textTer }} axisLine={false} tickLine={false}
                          tickFormatter={v => `${(v / 10000).toFixed(0)}万`}
                          domain={["auto", "auto"]}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div style={{ background: "rgba(44,44,46,0.95)", backdropFilter: "blur(20px)", borderRadius: 12, padding: "8px 12px", border: `1px solid ${C.sep}` }}>
                                <p style={{ fontSize: 11, color: C.textTer, marginBottom: 2 }}>{label}</p>
                                <p style={{ fontSize: 15, fontWeight: 600, color: C.textPri }}>¥{fmt(payload[0]?.value)}</p>
                              </div>
                            );
                          }}
                        />
                        <Area type="monotone" dataKey="value" stroke={isGain ? C.green : C.red} strokeWidth={2} fill="url(#perfGrad)"
                          dot={false} activeDot={{ r: 4, fill: isGain ? C.green : C.red, stroke: C.bg2, strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              )}

              {/* Snapshot log */}
              {hasSnaps && (
                <div className="fade-up">
                  <Card>
                    <div style={{ padding: "16px", borderBottom: `1px solid ${C.sep}` }}>
                      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.3px" }}>スナップショット履歴</div>
                      <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>株価更新時に自動記録（直近30件）</div>
                    </div>
                    {[...snapshots].reverse().slice(0, 30).map((s, i, arr) => {
                      const prev = arr[i + 1];
                      const d = prev ? s.value - prev.value : null;
                      const p = d !== null && prev.value > 0 ? d / prev.value * 100 : null;
                      return (
                        <div key={i} style={{ padding: "12px 16px", borderTop: i > 0 ? `1px solid ${C.sep}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 13, color: i === 0 ? C.textPri : C.textSec }}>{s.date}</span>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 14, fontWeight: i === 0 ? 700 : 500 }}>¥{fmt(s.value)}</div>
                            {p !== null && (
                              <div style={{ fontSize: 11, color: d >= 0 ? C.green : C.red, marginTop: 1 }}>
                                {d >= 0 ? "+" : ""}{p.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                </div>
              )}

            </div>
          );
        })()}

        {/* ══ BENCHMARK ══ */}
        {tab === "bench" && (() => {
          const portBase = snapshots[0]?.value || 0;
          const portIndexed = snapshots.map(s => ({ date: s.date.slice(0, 7).replace("-", "/"), ポートフォリオ: portBase > 0 ? parseFloat((s.value / portBase * 100).toFixed(2)) : 100 }));
          const allDates = [...new Set([...portIndexed.map(p => p.date), ...benchData.map(b => b.date)])].sort();
          const merged = allDates.map(d => {
            const p = portIndexed.find(x => x.date === d) || portIndexed.findLast(x => x.date <= d);
            const b = benchData.find(x => x.date === d);
            return { date: d, ...(p ? { ポートフォリオ: p.ポートフォリオ } : {}), ...(b ? { 日経225: b.日経225, TOPIX: b.TOPIX } : {}) };
          }).filter(d => d.ポートフォリオ || d.日経225);
          const hasData = merged.length > 0;
          const latest = merged[merged.length - 1];
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="fade-up">
                <Card style={{ padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px" }}>ポートフォリオ vs 市場</div>
                      <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>初回スナップ=100 で指数化</div>
                    </div>
                    <Btn onClick={fetchBenchmark} disabled={benchLoading} style={{ fontSize: 12, padding: "7px 12px" }}>{benchLoading ? "⏳" : "🔄"} 更新</Btn>
                  </div>
                  {benchMsg && <div style={{ fontSize: 12, color: C.textSec, margin: "8px 0" }}>{benchMsg}</div>}
                  {!hasData ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", color: C.textTer }}>
                      <span style={{ fontSize: 40, marginBottom: 12 }}>📈</span>
                      <p style={{ fontSize: 14, color: C.textSec, textAlign: "center" }}>「更新」を押して日経・TOPIXデータを取得</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={merged} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.sep} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: C.textTer }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: C.textTer }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                        <Tooltip content={<BenchTooltip />} />
                        <Line type="monotone" dataKey="ポートフォリオ" stroke={C.blue}   strokeWidth={2.5} dot={false} connectNulls />
                        <Line type="monotone" dataKey="日経225"        stroke={C.orange} strokeWidth={2}   dot={false} strokeDasharray="4 2" connectNulls />
                        <Line type="monotone" dataKey="TOPIX"          stroke={C.green}  strokeWidth={2}   dot={false} strokeDasharray="4 2" connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </div>

              {hasData && (
                <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { key: "ポートフォリオ", color: C.blue,   icon: "💼" },
                    { key: "日経225",        color: C.orange, icon: "🗾" },
                    { key: "TOPIX",          color: C.green,  icon: "📊" },
                  ].map(({ key, color, icon }) => {
                    const val = latest?.[key]; const diff = val ? val - 100 : null;
                    return (
                      <Card key={key} style={{ padding: "14px 12px" }}>
                        <div style={{ fontSize: 10, color: C.textTer, marginBottom: 4 }}>{icon} {key}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.5px" }}>{val ? val.toFixed(1) : "—"}</div>
                        {diff !== null && <div style={{ fontSize: 12, fontWeight: 600, color: diff >= 0 ? C.green : C.red, marginTop: 2 }}>{diff >= 0 ? "+" : ""}{diff.toFixed(1)}%</div>}
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Period performance */}
              {snapshots.length >= 2 && (() => {
                const minDate = snapshots[0].date, maxDate = snapshots[snapshots.length - 1].date;
                const fromSnap = perfFrom ? snapshots.find(s => s.date >= perfFrom) || snapshots[0] : snapshots[0];
                const toSnap   = perfTo   ? [...snapshots].reverse().find(s => s.date <= perfTo) || snapshots[snapshots.length - 1] : snapshots[snapshots.length - 1];
                const fromVal = fromSnap?.value || 0, toVal = toSnap?.value || 0;
                const diff = toVal - fromVal;
                const pctDiff = fromVal > 0 ? diff / fromVal * 100 : null;
                const presets = [{ label: "1週間", days: 7 }, { label: "1ヶ月", days: 30 }, { label: "3ヶ月", days: 90 }, { label: "全期間", days: null }];
                const applyPreset = days => {
                  if (days === null) { setPerfFrom(""); setPerfTo(""); return; }
                  const to = new Date(), from = new Date(); from.setDate(from.getDate() - days);
                  setPerfFrom(from.toISOString().slice(0, 10)); setPerfTo(to.toISOString().slice(0, 10));
                };
                return (
                  <div className="fade-up">
                    <Card style={{ padding: "20px" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>期間指定 騰落率</div>
                      <div style={{ fontSize: 12, color: C.textTer, marginBottom: 16 }}>スナップショットの範囲内で指定</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                        {presets.map(p => (
                          <button key={p.label} onClick={() => applyPreset(p.days)} style={{ padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 500, border: `1px solid ${C.bg4}`, background: "none", color: C.textSec, cursor: "pointer" }}>{p.label}</button>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                        {[
                          { label: "開始日", val: perfFrom, set: setPerfFrom },
                          { label: "終了日", val: perfTo,   set: setPerfTo   },
                        ].map(({ label, val, set }) => (
                          <div key={label}>
                            <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>{label}</div>
                            <input type="date" min={minDate} max={maxDate} value={val} onChange={e => set(e.target.value)}
                              style={{ width: "100%", background: C.bg3, border: `1px solid ${C.sep}`, borderRadius: 12, padding: "10px 12px", fontSize: 13, color: C.textPri, outline: "none", boxSizing: "border-box" }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ borderRadius: 16, padding: "16px", background: pctDiff === null ? C.bg3 : pctDiff >= 0 ? "rgba(48,209,88,0.12)" : "rgba(255,69,58,0.12)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                        <div>
                          <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>{fromSnap.date} → {toSnap.date}</div>
                          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-1.5px", color: pctDiff === null ? C.textTer : pctDiff >= 0 ? C.green : C.red }}>
                            {pctDiff !== null ? `${pctDiff >= 0 ? "+" : ""}${pctDiff.toFixed(2)}%` : "—"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, color: C.textTer, marginBottom: 4 }}>損益額</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: diff >= 0 ? C.green : C.red }}>{diff >= 0 ? "+" : ""}¥{fmt(diff)}</div>
                          <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>¥{fmt(fromVal)} → ¥{fmt(toVal)}</div>
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ══ SETTINGS ══ */}
        {tab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="fade-up">
              <Card style={{ padding: "20px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>データ管理</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Btn variant="secondary" onClick={() => setModal("import")} style={{ width: "100%", justifyContent: "flex-start" }}>📥 CSVインポート</Btn>
                  <Btn variant="secondary" onClick={exportCSV} disabled={!stocks.length} style={{ width: "100%", justifyContent: "flex-start" }}>📤 CSVエクスポート</Btn>
                </div>
              </Card>
            </div>
            <div className="fade-up">
              <Card style={{ padding: "20px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>CSVフォーマット</div>
                <div style={{ fontSize: 12, color: C.textTer, marginBottom: 12 }}>以下の形式で作成してください（1行目はヘッダー）</div>
                <div style={{ background: C.bg3, borderRadius: 12, padding: "12px 14px", fontSize: 11, fontFamily: "monospace", color: C.textSec, overflowX: "auto", whiteSpace: "pre", lineHeight: 1.6 }}>
                  {CSV_HEADER}{"\n"}{CSV_EXAMPLE}
                </div>
              </Card>
            </div>
            <div className="fade-up">
              <Card style={{ padding: "20px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.red, marginBottom: 8 }}>危険ゾーン</div>
                <div style={{ fontSize: 12, color: C.textTer, marginBottom: 14 }}>削除したデータは復元できません</div>
                <Btn variant="danger" onClick={async () => { if (confirm("全データを削除しますか？")) { await saveStocks([]); await saveHistory([]); } }} style={{ width: "100%" }}>🗑️ 全データを削除</Btn>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* ══ MODALS ══ */}
      {modal === "add" && (
        <Modal title="銘柄を追加" onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="銘柄コード *" placeholder="7203" value={ns.code} onChange={e => setNs({ ...ns, code: e.target.value })} />
              <Input label="セクター" placeholder="輸送用機器" value={ns.sector} onChange={e => setNs({ ...ns, sector: e.target.value })} />
            </div>
            <Input label="銘柄名 *" placeholder="トヨタ自動車" value={ns.name} onChange={e => setNs({ ...ns, name: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="株数 *" type="number" placeholder="100" value={ns.shares} onChange={e => setNs({ ...ns, shares: e.target.value })} />
              <Input label="取得単価（円）*" type="number" placeholder="2800" value={ns.acquisitionPrice} onChange={e => setNs({ ...ns, acquisitionPrice: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="現在株価（円）" type="number" placeholder="取得単価と同じ" value={ns.currentPrice} onChange={e => setNs({ ...ns, currentPrice: e.target.value })} />
              <Input label="年間配当/1株（円）*" type="number" placeholder="120" value={ns.annualDividend} onChange={e => setNs({ ...ns, annualDividend: e.target.value })} />
            </div>
            <Input label="配当月（カンマ区切り）" placeholder="3,9" value={ns.dividendMonths} onChange={e => setNs({ ...ns, dividendMonths: e.target.value })} />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setModal(null)} style={{ flex: 1 }}>キャンセル</Btn>
              <Btn onClick={handleAddStock} disabled={!ns.code || !ns.name || !ns.shares || !ns.acquisitionPrice || !ns.annualDividend} style={{ flex: 1 }}>追加</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal === "import" && (
        <Modal title="CSVインポート" onClose={() => { setModal(null); setCsvText(""); }}>
          <p style={{ fontSize: 13, color: C.textTer, marginBottom: 12 }}>ファイル選択 or テキストを直接貼り付け</p>
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", border: `2px dashed ${C.bg4}`, borderRadius: 16, padding: "24px", cursor: "pointer", marginBottom: 12 }}>
            <span style={{ fontSize: 32, marginBottom: 8 }}>📂</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.textSec }}>CSVファイルを選択</span>
            <span style={{ fontSize: 12, color: C.textTer, marginTop: 4 }}>.csv ファイル対応</span>
            <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setCsvText(ev.target.result); r.readAsText(f, "UTF-8"); e.target.value = ""; }} />
          </label>
          <textarea rows={5} placeholder={CSV_HEADER + "\n" + CSV_EXAMPLE} value={csvText} onChange={e => setCsvText(e.target.value)} />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => { setModal(null); setCsvText(""); }} style={{ flex: 1 }}>キャンセル</Btn>
            <Btn onClick={handleImport} disabled={!csvText.trim()} style={{ flex: 1 }}>インポート</Btn>
          </div>
        </Modal>
      )}

      {modal === "hist" && (
        <Modal title="配当受取を記録" onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Select label="銘柄 *" value={nh.code} onChange={e => setNh({ ...nh, code: e.target.value })}>
              <option value="">選択してください</option>
              {stocks.map(s => <option key={s.id} value={s.code}>{s.name}（{s.code}）</option>)}
            </Select>
            <Input label="受取日 *" type="date" value={nh.date} onChange={e => setNh({ ...nh, date: e.target.value })} />
            <Input label="受取金額（税引後・円）*" type="number" placeholder="4800" value={nh.amount} onChange={e => setNh({ ...nh, amount: e.target.value })} />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setModal(null)} style={{ flex: 1 }}>キャンセル</Btn>
              <Btn onClick={handleAddHistory} disabled={!nh.code || !nh.date || !nh.amount} style={{ flex: 1 }}>記録</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal === "del" && (
        <Modal title="銘柄を削除" onClose={() => { setModal(null); setDelId(null); }}>
          <p style={{ fontSize: 14, color: C.textSec }}>この銘柄をポートフォリオから削除しますか？</p>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{stocks.find(s => s.id === delId)?.name}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Btn variant="secondary" onClick={() => { setModal(null); setDelId(null); }} style={{ flex: 1 }}>キャンセル</Btn>
            <Btn variant="danger" onClick={() => { saveStocks(stocks.filter(s => s.id !== delId)); setModal(null); setDelId(null); }} style={{ flex: 1, background: C.red, color: "#fff" }}>削除</Btn>
          </div>
        </Modal>
      )}

      {modal === "memo" && (
        <Modal title={`メモ — ${stocks.find(s => s.id === memoStockId)?.name || ""}`} onClose={() => setModal(null)}>
          <p style={{ fontSize: 12, color: C.textTer, marginBottom: 10 }}>購入理由・投資メモ・売却検討など自由に記録</p>
          <textarea rows={6} placeholder={"例：高配当かつ連続増配。景気後退時のヘッジとして保有。\n目標株価 ¥5,500 に達したら一部売却検討。"} value={memoText} onChange={e => setMemoText(e.target.value)} />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => setModal(null)} style={{ flex: 1 }}>キャンセル</Btn>
            {memoText && <Btn variant="danger" onClick={() => { saveStocks(stocks.map(s => s.id === memoStockId ? { ...s, memo: "" } : s)); setModal(null); }} style={{ padding: "10px 16px" }}>削除</Btn>}
            <Btn onClick={() => { saveStocks(stocks.map(s => s.id === memoStockId ? { ...s, memo: memoText } : s)); setModal(null); }} style={{ flex: 1 }}>保存</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}