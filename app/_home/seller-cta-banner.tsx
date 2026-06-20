import Link from 'next/link'

/**
 * 首頁「成為 Kozukase 賣家」招募 Banner — Mountain Vista（旅遊主題）
 *
 * 像素級重現 Claude Design 的 C3 精緻版設計：藍天漸層底 + 三層山脈剪影
 * + 暖色日出光暈 + 4 朵精緻雲朵 + 飛鳥 + 星點，全部為純 CSS / inline SVG。
 * 以設計稿原始座標（1072×240）繪製，外層用容器查詢單位整塊等比縮放，
 * 各裝置比例完全一致。動畫與 hover 樣式定義於 globals.css（.seller-banner-*）。
 */
export function SellerCtaBanner() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 md:py-20">
      {/* === 手機版（< md）：精簡可讀卡片 ===
          桌機那張 1072×240 藝術 banner 若整塊 transform:scale 縮到手機寬，
          會被壓成 ~361×81px 的細條、文字縮到 ~12px 不可讀，故手機另做正常比例卡片。 */}
      <Link
        href="/become-seller"
        className="seller-banner-card md:hidden block relative overflow-hidden no-underline"
        style={{
          borderRadius: '18px',
          padding: '20px',
          background:
            'linear-gradient(165deg, #1A237E 0%, #1565C0 45%, #2D8FD5 100%)',
          boxShadow: '0 10px 30px rgba(21,101,192,0.22)',
        }}
      >
        {/* 右上裝飾光暈 */}
        <div
          style={{
            position: 'absolute',
            right: '-30px',
            top: '-30px',
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(255,213,79,0.22) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.22)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <span
              className="seller-banner-dot"
              style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FFE082', flexShrink: 0 }}
            />
            招募中
          </span>
          <div
            style={{
              marginTop: '12px',
              fontSize: '20px',
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}
          >
            成為 Kozukase 賣家
          </div>
          <div
            style={{
              marginTop: '4px',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.88)',
              lineHeight: 1.5,
            }}
          >
            讓更多買家找到你的代購服務
          </div>
          <span
            style={{
              marginTop: '16px',
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              height: '44px',
              borderRadius: '12px',
              background: 'white',
              color: '#1565C0',
              fontSize: '15px',
              fontWeight: 700,
            }}
          >
            立即上架
            <span style={{ fontSize: '17px' }}>→</span>
          </span>
        </div>
      </Link>

      {/* === 桌機版（≥ md）：Mountain Vista 像素藝術 banner === */}
      <div className="seller-banner-wrap hidden md:block">
        <div className="seller-banner-scaler">
          <div
            className="seller-banner-card"
            style={{
              position: 'relative',
              width: '1072px',
              height: '240px',
              borderRadius: '22px',
              overflow: 'hidden',
              background:
                'linear-gradient(175deg, #1A237E 0%, #1565C0 25%, #42A5F5 50%, #80DEEA 72%, #B2EBF2 100%)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 52px',
              boxSizing: 'border-box',
            }}
          >
            {/* === 地平線霞光（大氣散射，墊在山脈後方營造景深） === */}
            <div
              style={{
                position: 'absolute',
                right: '40px',
                bottom: '0',
                width: '760px',
                height: '150px',
                background:
                  'radial-gradient(120% 100% at 72% 100%, rgba(255,190,120,0.22) 0%, rgba(255,170,110,0.10) 32%, transparent 62%)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '0',
                right: '0',
                bottom: '0',
                height: '70px',
                background:
                  'linear-gradient(to top, rgba(178,235,242,0.18) 0%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />

            {/* === 日出光暈 === */}
            {/* 大範圍暖色環境光 */}
            <div
              style={{
                position: 'absolute',
                right: '130px',
                bottom: '55px',
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(255,183,77,0.30) 0%, rgba(255,138,101,0.12) 35%, transparent 70%)',
                pointerEvents: 'none',
                animation: 'sb-sunPulse 7s ease-in-out infinite',
              }}
            />
            {/* 太陽核心 */}
            <div
              style={{
                position: 'absolute',
                right: '195px',
                bottom: '72px',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(255,213,79,0.45) 0%, rgba(255,183,77,0.20) 50%, transparent 80%)',
                pointerEvents: 'none',
              }}
            />
            {/* 太陽光環（緩慢旋轉） */}
            <div
              style={{
                position: 'absolute',
                right: '178px',
                bottom: '55px',
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                border: '1px solid rgba(255,213,79,0.10)',
                pointerEvents: 'none',
                animation: 'sb-rayRotate 40s linear infinite',
              }}
            />

            {/* === 山脈層次 === */}
            {/* 後層山脈（紫藍，最高） */}
            <svg
              style={{ position: 'absolute', right: 0, bottom: 0, pointerEvents: 'none', width: '560px', height: '155px' }}
            >
              <defs>
                <linearGradient id="sbMtn1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5C6BC0" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3949AB" stopOpacity="0.15" />
                </linearGradient>
              </defs>
              <polygon
                points="0,155 45,65 95,90 155,28 215,72 275,42 340,78 400,22 455,68 510,50 560,155"
                fill="url(#sbMtn1)"
              />
            </svg>
            {/* 中層山脈（翠綠） */}
            <svg
              style={{ position: 'absolute', right: 0, bottom: 0, pointerEvents: 'none', width: '510px', height: '115px' }}
            >
              <defs>
                <linearGradient id="sbMtn2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#26A69A" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#00897B" stopOpacity="0.22" />
                </linearGradient>
              </defs>
              <polygon
                points="0,115 40,62 95,80 150,38 205,65 265,42 320,72 375,48 420,68 470,55 510,115"
                fill="url(#sbMtn2)"
              />
            </svg>
            {/* 前層山脈（深藍，最濃） */}
            <svg
              style={{ position: 'absolute', right: 0, bottom: 0, pointerEvents: 'none', width: '460px', height: '85px' }}
            >
              <defs>
                <linearGradient id="sbMtn3" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1565C0" stopOpacity="0.22" />
                  <stop offset="50%" stopColor="#0D47A1" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#1A237E" stopOpacity="0.20" />
                </linearGradient>
              </defs>
              <polygon
                points="0,85 35,50 85,65 135,32 185,55 240,35 300,58 350,40 400,60 460,85"
                fill="url(#sbMtn3)"
              />
            </svg>
            {/* 雪頂（最高峰白色尖端） */}
            <svg
              style={{ position: 'absolute', right: 0, bottom: 0, pointerEvents: 'none', width: '560px', height: '155px' }}
            >
              <polygon points="150,28 162,40 138,40" fill="white" fillOpacity="0.12" />
              <polygon points="395,22 408,36 382,36" fill="white" fillOpacity="0.10" />
              <polygon points="270,42 282,52 258,52" fill="white" fillOpacity="0.08" />
            </svg>
            {/* 山脊迎光描邊（暖色 rim light，呼應日出方向） */}
            <svg
              style={{ position: 'absolute', right: 0, bottom: 0, pointerEvents: 'none', width: '460px', height: '85px' }}
            >
              <defs>
                <linearGradient id="sbRim" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#FFE0B2" stopOpacity="0" />
                  <stop offset="55%" stopColor="#FFE0B2" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="#FFD180" stopOpacity="0.45" />
                </linearGradient>
              </defs>
              <polyline
                points="0,85 35,50 85,65 135,32 185,55 240,35 300,58 350,40 400,60 460,85"
                fill="none"
                stroke="url(#sbRim)"
                strokeWidth="1.4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>

            {/* === 精緻雲朵 === */}
            {/* 雲 A：大型細節雲（右上，近太陽帶暖色） */}
            <div
              style={{
                position: 'absolute',
                right: '50px',
                top: '16px',
                pointerEvents: 'none',
                animation: 'sb-cloudDriftA 11s ease-in-out infinite',
              }}
            >
              <svg viewBox="0 0 160 65" width="155" height="63">
                <ellipse cx="45" cy="42" rx="32" ry="18" fill="white" fillOpacity="0.12" />
                <ellipse cx="80" cy="32" rx="40" ry="24" fill="white" fillOpacity="0.16" />
                <ellipse cx="115" cy="42" rx="32" ry="18" fill="white" fillOpacity="0.12" />
                <ellipse cx="62" cy="26" rx="20" ry="14" fill="white" fillOpacity="0.13" />
                <ellipse cx="98" cy="28" rx="18" ry="12" fill="white" fillOpacity="0.11" />
                <ellipse cx="80" cy="22" rx="24" ry="14" fill="white" fillOpacity="0.10" />
                <ellipse cx="80" cy="35" rx="35" ry="18" fill="#FFD54F" fillOpacity="0.04" />
                <ellipse cx="75" cy="20" rx="16" ry="8" fill="white" fillOpacity="0.08" />
              </svg>
            </div>

            {/* 雲 B：中型雲（左側，冷色） */}
            <div
              style={{
                position: 'absolute',
                right: '310px',
                bottom: '55px',
                pointerEvents: 'none',
                animation: 'sb-cloudDriftB 9s ease-in-out infinite',
              }}
            >
              <svg viewBox="0 0 130 55" width="120" height="50">
                <ellipse cx="35" cy="35" rx="26" ry="15" fill="white" fillOpacity="0.15" />
                <ellipse cx="65" cy="25" rx="32" ry="20" fill="white" fillOpacity="0.18" />
                <ellipse cx="95" cy="35" rx="26" ry="15" fill="white" fillOpacity="0.15" />
                <ellipse cx="50" cy="22" rx="16" ry="11" fill="white" fillOpacity="0.12" />
                <ellipse cx="78" cy="22" rx="14" ry="10" fill="white" fillOpacity="0.10" />
                <ellipse cx="65" cy="18" rx="20" ry="10" fill="white" fillOpacity="0.08" />
                <ellipse cx="62" cy="17" rx="12" ry="6" fill="white" fillOpacity="0.07" />
              </svg>
            </div>

            {/* 雲 C：小型輕薄雲（最右上） */}
            <div
              style={{
                position: 'absolute',
                right: '220px',
                top: '10px',
                pointerEvents: 'none',
                animation: 'sb-cloudDriftC 13s ease-in-out infinite',
              }}
            >
              <svg viewBox="0 0 80 32" width="72" height="29">
                <ellipse cx="22" cy="20" rx="16" ry="10" fill="white" fillOpacity="0.11" />
                <ellipse cx="40" cy="15" rx="20" ry="13" fill="white" fillOpacity="0.13" />
                <ellipse cx="58" cy="20" rx="16" ry="10" fill="white" fillOpacity="0.11" />
                <ellipse cx="40" cy="12" rx="14" ry="7" fill="white" fillOpacity="0.07" />
              </svg>
            </div>

            {/* 雲 D：山頂附近的小雲 */}
            <div
              style={{
                position: 'absolute',
                right: '420px',
                top: '45px',
                pointerEvents: 'none',
                animation: 'sb-cloudDriftA 15s ease-in-out infinite 3s',
                opacity: 0.7,
              }}
            >
              <svg viewBox="0 0 60 25" width="52" height="22">
                <ellipse cx="16" cy="16" rx="13" ry="8" fill="white" fillOpacity="0.12" />
                <ellipse cx="30" cy="11" rx="16" ry="10" fill="white" fillOpacity="0.14" />
                <ellipse cx="44" cy="16" rx="13" ry="8" fill="white" fillOpacity="0.12" />
              </svg>
            </div>

            {/* === 飛鳥 === */}
            {/* 鳥群 1（帶暖色） */}
            <svg
              style={{
                position: 'absolute',
                right: '260px',
                top: '28px',
                pointerEvents: 'none',
                animation: 'sb-birdFly 5.5s ease-in-out infinite',
              }}
              viewBox="0 0 65 28"
              width="58"
              height="25"
            >
              <path d="M3,14 Q10,4 17,14" fill="none" stroke="white" strokeOpacity="0.38" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M20,9 Q26,2 32,9" fill="none" stroke="white" strokeOpacity="0.32" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M36,16 Q41,9 46,16" fill="none" stroke="rgba(255,213,79,0.35)" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M49,11 Q53,6 57,11" fill="none" stroke="white" strokeOpacity="0.24" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            {/* 鳥群 2（較小，後方） */}
            <svg
              style={{
                position: 'absolute',
                right: '350px',
                top: '50px',
                pointerEvents: 'none',
                animation: 'sb-birdFly2 6.5s ease-in-out infinite 1.8s',
              }}
              viewBox="0 0 38 16"
              width="30"
              height="13"
            >
              <path d="M2,11 Q7,4 12,11" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M16,8 Q20,3 24,8" fill="none" stroke="rgba(255,183,77,0.25)" strokeWidth="1.1" strokeLinecap="round" />
              <path d="M27,11 Q30,6 33,11" fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="1" strokeLinecap="round" />
            </svg>

            {/* === 星點閃爍 === */}
            <div style={{ position: 'absolute', right: '190px', top: '18px', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,213,79,0.6)', animation: 'sb-sparkle 4s ease-in-out infinite', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', right: '380px', top: '35px', width: '3px', height: '3px', borderRadius: '50%', background: 'white', animation: 'sb-sparkle 5s ease-in-out infinite 1.5s', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', right: '470px', top: '60px', width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,183,77,0.5)', animation: 'sb-sparkle 3.5s ease-in-out infinite 2.5s', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', right: '290px', top: '12px', width: '2px', height: '2px', borderRadius: '50%', background: 'white', animation: 'sb-sparkle 6s ease-in-out infinite 0.8s', pointerEvents: 'none' }} />

            {/* === 收邊層（提升文字對比 + 電影感質感，皆在內容下方） === */}
            {/* 左側暗部，讓白字更立體好讀 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '62%',
                pointerEvents: 'none',
                background:
                  'linear-gradient(90deg, rgba(13,33,90,0.30) 0%, rgba(13,33,90,0.12) 42%, transparent 100%)',
              }}
            />
            {/* 膠片顆粒，消除數位漸層的扁平感 */}
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.45 }}
            >
              <filter id="sbGrain">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              </filter>
              <rect width="100%" height="100%" filter="url(#sbGrain)" />
            </svg>
            {/* 暈角 + 頂緣高光，電影感收邊 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '22px',
                pointerEvents: 'none',
                boxShadow:
                  'inset 0 0 90px rgba(13,33,90,0.32), inset 0 1px 1px rgba(255,255,255,0.22)',
              }}
            />

            {/* === 文字內容 === */}
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '5px 16px',
                  borderRadius: '20px',
                  background: 'rgba(255,255,255,0.25)',
                  backdropFilter: 'blur(6px)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.3px',
                  width: 'fit-content',
                  gap: '7px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                <span
                  className="seller-banner-dot"
                  style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#FFE082', flexShrink: 0 }}
                />
                招募中
              </span>
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: 900,
                  color: 'white',
                  letterSpacing: '-0.5px',
                  lineHeight: 1.2,
                  textShadow: '0 1px 0 rgba(255,255,255,0.12), 0 3px 16px rgba(13,33,90,0.30)',
                }}
              >
                成為 <span style={{ fontWeight: 800 }}>Kozukase</span> 賣家
              </div>
              <div
                style={{
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.90)',
                  fontWeight: 500,
                  textShadow: '0 1px 6px rgba(13,33,90,0.28)',
                }}
              >
                讓更多買家找到你的代購服務
              </div>
            </div>

            {/* === CTA === */}
            <div style={{ position: 'relative', zIndex: 2 }}>
              <Link
                href="/become-seller"
                className="seller-banner-cta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '13px 28px',
                  borderRadius: '14px',
                  background: 'white',
                  color: '#1565C0',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: '0 4px 18px rgba(0,0,0,0.08)',
                }}
              >
                立即上架
                <span className="seller-banner-arrow" style={{ fontSize: '18px', marginLeft: '2px', display: 'inline-block' }}>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
