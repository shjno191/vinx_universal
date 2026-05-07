<script setup lang="ts">
import { useGlobalLoading, loadingTheme } from '@vinx/sdk';

const { globalLoading } = useGlobalLoading();
</script>

<template>
  <Teleport to="body">
    <transition name="loading-fade">
      <div v-if="globalLoading.show" class="p-loading-overlay" :class="[loadingTheme + '-mode']">
        <div class="p-loading-card" :class="[loadingTheme + '-card']">
          
          <!-- ============================================= -->
          <!-- THEME 1: CUTE — Kawaii Pastel Dream         -->
          <!-- ============================================= -->
          <template v-if="loadingTheme === 'cute'">
            <div class="cute-scene">
              <div class="cute-heart h1">💖</div>
              <div class="cute-heart h2">💝</div>
              <div class="cute-heart h3">💗</div>
              <div class="cute-heart h4">💓</div>

              <div class="cute-cat">
                <div class="cute-cat-head">
                  <div class="cute-ear left"><div class="cute-ear-inner"></div></div>
                  <div class="cute-ear right"><div class="cute-ear-inner"></div></div>
                  <div class="cute-face">
                    <div class="cute-eye left"><div class="cute-pupil"></div><div class="cute-shine"></div></div>
                    <div class="cute-eye right"><div class="cute-pupil"></div><div class="cute-shine"></div></div>
                    <div class="cute-nose"></div>
                    <div class="cute-mouth"></div>
                    <div class="cute-blush left"></div>
                    <div class="cute-blush right"></div>
                  </div>
                </div>
                <div class="cute-paw-row">
                  <div class="cute-paw left"></div>
                  <div class="cute-paw right"></div>
                </div>
              </div>
            </div>

            <div class="p-info-box">
              <div class="cute-bubble">
                <span class="cute-bubble-text">nyaa~ working hard (๑•̀ㅁ•́๑)✧</span>
              </div>
              <h3 class="cute-title">{{ globalLoading.message }}</h3>
              <div class="cute-progress-wrap">
                <div class="cute-progress-track">
                  <div class="cute-progress-fill" :style="{ width: globalLoading.progress + '%' }">
                    <span class="cute-paw-icon">🐾</span>
                  </div>
                </div>
                <div class="cute-pct-row">
                  <span class="cute-pct">{{ globalLoading.progress }}%</span>
                  <span class="cute-hint">almost there... ✨</span>
                </div>
              </div>
            </div>
          </template>

          <!-- ============================================= -->
          <!-- THEME 2: PREMIUM — Obsidian Glass           -->
          <!-- ============================================= -->
          <template v-else-if="loadingTheme === 'premium'">
            <div class="prm-ambient-top"></div>
            <div class="prm-ambient-bottom"></div>

            <div class="prm-ring-stack">
              <svg viewBox="0 0 120 120" class="prm-ring-svg outer">
                <circle cx="60" cy="60" r="55" class="prm-ring-track" />
                <circle cx="60" cy="60" r="55" class="prm-ring-arc arc-outer"
                  :style="{ strokeDashoffset: 345 - (345 * globalLoading.progress / 100) }" />
              </svg>
              <svg viewBox="0 0 80 80" class="prm-ring-svg inner">
                <circle cx="40" cy="40" r="34" class="prm-ring-track" />
                <circle cx="40" cy="40" r="34" class="prm-ring-arc arc-inner"
                  :style="{ strokeDashoffset: 214 - (214 * globalLoading.progress / 100) }" />
              </svg>
              <div class="prm-pct-core">
                <span class="prm-num">{{ globalLoading.progress }}</span>
                <span class="prm-unit">%</span>
              </div>
            </div>

            <div class="p-info-box">
              <div class="prm-tag">
                <span class="prm-dot"></span>
                PROCESSING SYSTEM
                <span class="prm-dot"></span>
              </div>
              <h3 class="prm-title">{{ globalLoading.message }}</h3>
              <div class="prm-line-bar">
                <div class="prm-line-fill" :style="{ width: globalLoading.progress + '%' }"></div>
                <div class="prm-line-glow" :style="{ left: globalLoading.progress + '%' }"></div>
              </div>
              <div class="prm-footer-row">
                <span class="prm-footer-item">VINX_OS v2.0</span>
                <span class="prm-footer-sep">|</span>
                <span class="prm-footer-item">{{ globalLoading.progress }}% LOADED</span>
              </div>
            </div>
          </template>

          <!-- ============================================= -->
          <!-- THEME 3: CYBER — Tokyo Neon Hacker          -->
          <!-- ============================================= -->
          <template v-else-if="loadingTheme === 'cyber'">
            <div class="cyber-grid-bg"></div>
            <div class="cyber-scanlines"></div>

            <div class="cyber-header-bar">
              <span class="cyber-logo">VINX_UNIVERSAL</span>
              <div class="cyber-status-dots">
                <span class="csb red"></span>
                <span class="csb yellow"></span>
                <span class="csb green"></span>
              </div>
            </div>

            <div class="cyber-main">
              <div class="cyber-pct-box">
                <div class="cyber-pct-glitch" :data-text="globalLoading.progress + '%'">{{ globalLoading.progress }}%</div>
                <div class="cyber-corner tl"></div>
                <div class="cyber-corner tr"></div>
                <div class="cyber-corner bl"></div>
                <div class="cyber-corner br"></div>
                <div class="cyber-scan-sweep"></div>
              </div>

              <div class="cyber-msg-box">
                <div class="cyber-label">// DATA_RIPPER v4.2 // PROTOCOL_ACTIVE</div>
                <h3 class="cyber-title">
                  <span class="cyber-prompt">></span>
                  {{ globalLoading.message }}<span class="cyber-cursor">_</span>
                </h3>
              </div>
            </div>

            <div class="cyber-bar-section">
              <div class="cyber-bar-label">
                <span>SYS_LOAD_BUFFER</span>
                <span>{{ globalLoading.progress }}/100</span>
              </div>
              <div class="cyber-bar-outer">
                <div class="cyber-bar-track">
                  <div class="cyber-bar-fill" :style="{ width: globalLoading.progress + '%' }">
                    <div class="cyber-bar-glow"></div>
                  </div>
                </div>
              </div>
              <div class="cyber-bar-footer">SECURE_CHANNEL_LOCKED // PORT_8080</div>
            </div>
          </template>

          <!-- ============================================= -->
          <!-- THEME 4: RETRO — Windows 95 Authentic       -->
          <!-- ============================================= -->
          <template v-else-if="loadingTheme === 'retro'">
            <div class="win95-titlebar">
              <div class="win95-icon">📁</div>
              <span class="win95-title-text">Vinx Universal - Đang xử lý yêu cầu...</span>
              <div class="win95-btn-group">
                <div class="win95-btn">_</div>
                <div class="win95-btn"></div>
                <div class="win95-btn win95-close">✖️</div>
              </div>
            </div>

            <div class="win95-body">
              <div class="win95-left">
                <div class="win95-big-icon">💿💽</div>
              </div>
              <div class="win95-right">
                <div class="win95-msg-primary">Windows đang cập nhật hệ thống của bạn.</div>
                <div class="win95-msg-secondary">{{ globalLoading.message }}...</div>
                <div class="win95-spacer"></div>
                <div class="win95-bar-wrap">
                  <div class="win95-bar-inner">
                    <div
                      v-for="i in 25" :key="i"
                      class="win95-block"
                      :class="{ active: i <= Math.ceil(globalLoading.progress / 4) }"
                    ></div>
                  </div>
                </div>
                <div class="win95-pct-label">{{ globalLoading.progress }}% Hoàn thành</div>
              </div>
            </div>

            <div class="win95-statusbar">
              <div class="win95-status-cell">
                <span class="win95-status-light" :class="{ blink: globalLoading.progress < 100 }"></span>
                Đang tải dữ liệu...
              </div>
              <div class="win95-status-divider"></div>
              <div class="win95-status-cell">Vinx OS v1.0.0</div>
            </div>
          </template>

          <!-- ============================================= -->
          <!-- THEME 5: NATURE — Forest Zen                -->
          <!-- ============================================= -->
          <template v-else-if="loadingTheme === 'nature'">
            <div class="nat-bg-leaves">
              <span class="nat-leaf nl1">🍃</span>
              <span class="nat-leaf nl2">🍃</span>
              <span class="nat-leaf nl3">🌿</span>
              <span class="nat-leaf nl4">🌿</span>
            </div>

            <div class="nat-orb-wrap">
              <svg viewBox="0 0 140 140" class="nat-ring-svg">
                <circle cx="70" cy="70" r="60" class="nat-ring-bg" />
                <circle cx="70" cy="70" r="60" class="nat-ring-fill"
                  :style="{ strokeDashoffset: 377 - (377 * globalLoading.progress / 100) }" />
              </svg>
              <div class="nat-orb-center">
                <span class="nat-big-emoji">🌱</span>
                <span class="nat-orb-pct">{{ globalLoading.progress }}%</span>
              </div>
            </div>

            <div class="p-info-box">
              <div class="nat-badge">
                <span>🌿</span> GROWING SYSTEM <span>🌿</span>
              </div>
              <h3 class="nat-title">{{ globalLoading.message }}</h3>
              <div class="nat-bar-wrap">
                <div class="nat-bar-track">
                  <div class="nat-bar-fill" :style="{ width: globalLoading.progress + '%' }">
                    <div class="nat-bar-sparkle"></div>
                  </div>
                </div>
              </div>
              <div class="nat-flowers">
                <span>🌸</span><span>🌼</span><span>🍀</span><span>🌺</span><span>🌻</span>
              </div>
            </div>
          </template>

          <!-- ============================================= -->
          <!-- THEME 6: ORBIT — Deep Space Explorer        -->
          <!-- ============================================= -->
          <template v-else-if="loadingTheme === 'orbit'">
            <div class="orb-starfield">
              <div v-for="i in 30" :key="i" class="orb-star" :style="{
                left: (i * 37 % 100) + '%',
                top: (i * 53 % 100) + '%',
                animationDelay: (i * 0.13) + 's',
                width: (i % 3 === 0 ? 2 : 1) + 'px',
                height: (i % 3 === 0 ? 2 : 1) + 'px'
              }"></div>
            </div>

            <div class="orb-system">
              <div class="orb-ring ring-1"></div>
              <div class="orb-ring ring-2"></div>
              <div class="orb-ring ring-3"></div>

              <div class="orb-sun">
                <div class="orb-corona"></div>
                <div class="orb-sun-core">
                  <span class="orb-pct">{{ globalLoading.progress }}</span>
                  <span class="orb-pct-unit">%</span>
                </div>
              </div>

              <div class="orb-planet p1"></div>
              <div class="orb-planet p2"></div>
              <div class="orb-planet p3"></div>
            </div>

            <div class="p-info-box">
              <div class="orb-mission-tag">
                <span class="orb-blink-dot"></span>
                MISSION IN PROGRESS
              </div>
              <h3 class="orb-title">{{ globalLoading.message }}</h3>
              <div class="orb-progress-bar">
                <div class="orb-bar-fill" :style="{ width: globalLoading.progress + '%' }">
                  <div class="orb-bar-comet"></div>
                </div>
              </div>
              <div class="orb-telemetry">
                <span>T+ {{ globalLoading.progress }}s</span>
                <span>SIGNAL_LOCK 🛸</span>
                <span>ORBIT_{{ globalLoading.progress < 50 ? 'ENTRY' : 'STABLE' }}</span>
              </div>
            </div>
          </template>

        </div>
      </div>
    </transition>

    <!-- INLINE SVG GRADIENTS (FIXED: INSIDE TELEPORT PREVENTS VITE ERROR) -->
    <svg width="0" height="0" style="position:fixed; visibility: hidden">
      <defs>
        <linearGradient id="grad-outer" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#6366f1" />
          <stop offset="100%" stop-color="#db2777" />
        </linearGradient>
        <linearGradient id="grad-inner" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#db2777" />
          <stop offset="100%" stop-color="#f59e0b" />
        </linearGradient>
        <linearGradient id="nat-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stop-color="#a5d6a7" />
          <stop offset="50%"  stop-color="#4caf50" />
          <stop offset="100%" stop-color="#2e7d32" />
        </linearGradient>
      </defs>
    </svg>
  </Teleport>
</template>

<style scoped>
/* 
   BASE OVERLAY & TRANSITIONS
*/
.p-loading-overlay {
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  z-index: 999999; backdrop-filter: blur(12px); transition: all 0.5s ease;
}
.p-loading-card { position: relative; display: flex; flex-direction: column; align-items: center; overflow: hidden; }
.p-info-box { text-align: center; width: 100%; z-index: 5; }

.loading-fade-enter-active, .loading-fade-leave-active { transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
.loading-fade-enter-from { opacity: 0; transform: scale(0.9); filter: blur(10px); }
.loading-fade-leave-to { opacity: 0; transform: scale(1.1); filter: blur(5px); }

/* 
   THEME 1: CUTE
*/
.cute-mode { background: rgba(255, 192, 203, 0.5); }
.cute-card {
  width: 440px; background: #fff; border: 4px solid #ffc2d4; border-radius: 40px;
  padding: 40px; box-shadow: 0 20px 50px rgba(255, 105, 180, 0.2);
}
.cute-scene { position: relative; width: 150px; height: 130px; margin-bottom: 20px; }
.cute-heart { position: absolute; font-size: 1.2rem; animation: float 3s infinite ease-in-out; opacity: 0.8; }
.h1 { top: 0; left: 10px; animation-delay: 0s; }
.h2 { top: 20px; right: 10px; animation-delay: 0.5s; }
.h3 { bottom: 10px; left: 20px; animation-delay: 1s; }
.h4 { bottom: 0; right: 30px; animation-delay: 1.5s; }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }

.cute-cat { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
.cute-cat-head {
  width: 80px; height: 70px; background: #fff; border: 3px solid #ffc2d4; border-radius: 50% 50% 45% 45%;
  position: relative;
}
.cute-ear {
  width: 25px; height: 25px; background: #fff; border: 3px solid #ffc2d4; border-radius: 5px 20px 5px 5px;
  position: absolute; top: -12px;
}
.cute-ear.left { left: 5px; transform: rotate(-10deg); }
.cute-ear.right { right: 5px; transform: rotate(55deg) scaleX(-1); }
.cute-ear-inner { position: absolute; inset: 4px; background: #ffc2d4; border-radius: 3px 15px 3px 3px; }
.cute-face { width: 100%; height: 100%; position: relative; }
.cute-eye { width: 12px; height: 12px; background: #333; border-radius: 50%; position: absolute; top: 30px; animation: blink 4s infinite; }
.cute-eye.left { left: 18px; }
.cute-eye.right { right: 18px; }
.cute-nose { width: 8px; height: 5px; background: #ff99aa; border-radius: 50%; position: absolute; top: 45px; left: 50%; transform: translateX(-50%); }
.cute-mouth { width: 14px; height: 7px; border-bottom: 2.5px solid #ff99aa; border-radius: 0 0 10px 10px; position: absolute; top: 52px; left: 50%; transform: translateX(-50%); }
.cute-blush { width: 15px; height: 8px; background: pink; border-radius: 50%; opacity: 0.4; position: absolute; top: 42px; }
.cute-blush.left { left: 8px; }
.cute-blush.right { right: 8px; }
.cute-paw-row { display: flex; justify-content: center; gap: 40px; margin-top: 75px; }
.cute-paw { width: 20px; height: 12px; background: #fff; border: 3px solid #ffc2d4; border-radius: 10px 10px 5px 5px; animation: pawStep 1s infinite alternate; }
.cute-paw.left { animation-delay: 0s; }
.cute-paw.right { animation-delay: 0.5s; }

.cute-bubble { background: #fff0f5; color: #ff69b4; border: 2px solid #ffc2d4; border-radius: 20px; padding: 5px 15px; font-size: 0.8rem; font-weight: bold; margin-bottom: 12px; display: inline-block; }
.cute-title { color: #ff69b4; font-size: 1.2rem; margin: 0 0 15px; }
.cute-progress-track { height: 18px; background: #fff0f5; border-radius: 10px; border: 3px solid #ffc2d4; overflow: hidden; position: relative; }
.cute-progress-fill { height: 100%; background: linear-gradient(90deg, #ff99aa, #ff69b4); transition: width 0.4s ease; position: relative; }
.cute-paw-icon { position: absolute; right: 2px; top: 50%; transform: translateY(-50%); font-size: 0.8rem; }
.cute-pct-row { display: flex; justify-content: space-between; margin-top: 5px; font-size: 0.8rem; color: #ff69b4; font-weight: bold; }

/* 
   THEME 2: PREMIUM
*/
.premium-mode { background: rgba(0, 0, 0, 0.9); }
.premium-card {
  width: 460px; background: rgba(30, 30, 30, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 30px;
  padding: 50px; backdrop-filter: blur(40px); box-shadow: 0 40px 100px rgba(0,0,0,0.8);
}
.prm-ambient-top { position: absolute; top: -50%; left: -20%; width: 100%; height: 100%; background: radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%); }
.prm-ambient-bottom { position: absolute; bottom: -50%; right: -20%; width: 100%; height: 100%; background: radial-gradient(circle, rgba(219,39,119,0.1) 0%, transparent 70%); }

.prm-ring-stack { position: relative; width: 140px; height: 140px; margin-bottom: 30px; }
.prm-ring-svg { transform: rotate(-90deg); position: absolute; }
.prm-ring-svg.outer { width: 100%; height: 100%; }
.prm-ring-svg.inner { width: 70%; height: 70%; top: 15%; left: 15%; }
.prm-ring-track { fill: none; stroke: rgba(255, 255, 255, 0.05); stroke-width: 5; }
.prm-ring-arc { fill: none; stroke-width: 5; stroke-linecap: round; stroke-dasharray: 345; transition: stroke-dashoffset 0.5s ease; }
.arc-outer { stroke: url(#grad-outer); }
.arc-inner { stroke: url(#grad-inner); stroke-dasharray: 214; }
.prm-pct-core { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.prm-num { font-size: 2.5rem; font-weight: bold; color: #fff; }
.prm-unit { font-size: 1rem; color: #6366f1; margin: 10px 0 0 2px; }

.prm-tag { color: rgba(255,255,255,0.4); font-size: 0.7rem; letter-spacing: 3px; font-weight: bold; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; }
.prm-dot { width: 4px; height: 4px; background: #6366f1; border-radius: 50%; }
.prm-title { font-size: 1.1rem; color: #fff; margin-bottom: 25px; font-weight: normal; }
.prm-line-bar { height: 2px; background: rgba(255,255,255,0.05); border-radius: 1px; position: relative; margin-bottom: 15px; }
.prm-line-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #db2777); transition: width 0.5s ease; }
.prm-line-glow { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; background: #fff; border-radius: 50%; box-shadow: 0 0 15px #6366f1; transition: left 0.5s ease; }
.prm-footer-row { display: flex; justify-content: space-between; font-size: 0.6rem; color: rgba(255,255,255,0.2); letter-spacing: 1px; }

/* 
   THEME 3: CYBER
*/
.cyber-mode { background: #05000a; }
.cyber-card { width: 500px; background: #000; border: 2px solid #0ff; box-shadow: 0 0 20px #0ff; position: relative; display: flex; flex-direction: column; overflow: hidden; border-radius: 4px; }
.cyber-grid-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(0,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.05) 1px, transparent 1px); background-size: 20px 20px; }
.cyber-scanlines { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.02) 2px, rgba(0,255,255,0.02) 4px); pointer-events: none; }
.cyber-header-bar { background: rgba(0, 255, 255, 0.1); border-bottom: 2px solid #0ff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 2; }
.cyber-logo { font-family: monospace; font-weight: bold; color: #0ff; letter-spacing: 2px; }
.cyber-status-dots { display: flex; gap: 5px; }
.csb { width: 8px; height: 8px; border-radius: 50%; }
.csb.red { background: #f0f; } .csb.yellow { background: #ff0; } .csb.green { background: #0f0; }

.cyber-main { padding: 30px; display: flex; align-items: center; gap: 25px; z-index: 2; }
.cyber-pct-box { width: 100px; height: 100px; border: 2px solid #0ff; position: relative; display: flex; align-items: center; justify-content: center; }
.cyber-pct-glitch { font-family: monospace; font-size: 2rem; font-weight: bold; color: #0ff; text-shadow: 2px 2px #f0f; }
.cyber-corner { position: absolute; width: 10px; height: 10px; border: 2px solid #f0f; }
.tl { top: -2px; left: -2px; border-right: none; border-bottom: none; }
.tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
.bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
.br { bottom: -2px; right: -2px; border-left: none; border-top: none; }
.cyber-scan-sweep { position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: #0ff; box-shadow: 0 0 10px #0ff; animation: sweep 2s infinite linear; }
@keyframes sweep { 0% { top: 0; } 100% { top: 100%; } }

.cyber-msg-box { flex: 1; }
.cyber-label { font-size: 0.6rem; color: #f0f; font-family: monospace; margin-bottom: 5px; }
.cyber-title { font-family: monospace; color: #0ff; font-size: 1.1rem; }
.cyber-prompt { color: #f0f; margin-right: 10px; }
.cyber-cursor { animation: blink 1s infinite; }

.cyber-bar-section { padding: 0 30px 30px; z-index: 2; }
.cyber-bar-label { display: flex; justify-content: space-between; font-family: monospace; color: #0ff; font-size: 0.7rem; margin-bottom: 5px; }
.cyber-bar-outer { height: 14px; border: 1px solid #0ff; padding: 2px; }
.cyber-bar-track { height: 100%; background: rgba(0, 255, 255, 0.1); position: relative; }
.cyber-bar-fill { height: 100%; background: #0ff; transition: width 0.4s ease; box-shadow: 0 0 15px #0ff; }
.cyber-bar-glow { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: barGlow 2s infinite; }
@keyframes barGlow { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
.cyber-bar-footer { font-family: monospace; font-size: 0.6rem; color: #f0f; margin-top: 8px; text-align: right; }

/* 
   THEME 4: RETRO
*/
.retro-mode { background: #008080; }
.retro-card { width: 450px; background: #c0c0c0; border: 2px solid; border-color: #fff #808080 #808080 #fff; padding: 2px; gap: 0; }
.win95-titlebar { background: linear-gradient(90deg, #000080, #1084d0); color: #fff; padding: 3px 5px; display: flex; align-items: center; gap: 5px; }
.win95-icon { font-size: 0.8rem; }
.win95-title-text { font-size: 0.75rem; font-weight: bold; flex: 1; font-family: 'MS Sans Serif', Arial, sans-serif; }
.win95-btn-group { display: flex; gap: 2px; }
.win95-btn { width: 16px; height: 14px; background: #c0c0c0; border: 1.5px solid; border-color: #fff #404040 #404040 #fff; color: #000; font-size: 0.6rem; display: flex; align-items: center; justify-content: center; font-weight: bold; }
.win95-close { margin-left: 2px; }

.win95-body { padding: 20px; display: flex; gap: 20px; }
.win95-left { padding-top: 5px; }
.win95-big-icon { font-size: 3rem; }
.win95-right { flex: 1; }
.win95-msg-primary { font-size: 0.8rem; margin-bottom: 5px; font-weight: bold; }
.win95-msg-secondary { font-size: 0.75rem; color: #404040; margin-bottom: 15px; }
.win95-spacer { height: 10px; }
.win95-bar-wrap { height: 22px; background: #fff; border: 1.5px solid; border-color: #808080 #fff #fff #808080; padding: 2px; }
.win95-bar-inner { height: 100%; display: flex; gap: 2px; }
.win95-block { width: 12px; height: 100%; background: #000080; opacity: 0; }
.win95-block.active { opacity: 1; }
.win95-pct-label { margin-top: 8px; font-size: 0.7rem; text-align: right; }

.win95-statusbar { border-top: 1.5px solid #808080; padding: 2px; display: flex; gap: 5px; background: #c0c0c0; }
.win95-status-cell { border: 1.5px solid; border-color: #808080 #fff #fff #808080; padding: 2px 8px; font-size: 0.65rem; color: #000; display: flex; align-items: center; gap: 6px; }
.win95-status-light { width: 8px; height: 8px; background: #0f0; border-radius: 50%; box-shadow: inset 1px 1px 2px #000; }
.win95-status-light.blink { animation: blinkStatus 0.8s infinite; }
@keyframes blinkStatus { 0%, 100% { background: #0f0; } 50% { background: #080; } }
.win95-status-divider { flex: 1; }

/* 
   THEME 5: NATURE
*/
.nature-mode { background: #e8f5e9; }
.nature-card { width: 440px; background: #fff; border-radius: 30px; padding: 40px; box-shadow: 0 15px 40px rgba(76, 175, 80, 0.15); border: 2px solid #a5d6a7; overflow: hidden; }
.nat-bg-leaves { position: absolute; inset: 0; overflow: hidden; z-index: 0; opacity: 0.3; }
.nat-leaf { position: absolute; font-size: 1.5rem; animation: leafFall 6s infinite ease-in-out; }
.nl1 { top: 10px; left: 10%; animation-delay: 0s; }
.nl2 { top: 30px; left: 80%; animation-delay: 1.5s; }
.nl3 { bottom: 20px; left: 30%; animation-delay: 3s; }
.nl4 { bottom: 40px; right: 20%; animation-delay: 4.5s; }
@keyframes leafFall { 0% { transform: translateY(-20px) rotate(0deg); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(400px) rotate(360deg); opacity: 0; } }

.nat-orb-wrap { position: relative; width: 130px; height: 130px; margin-bottom: 25px; z-index: 1; }
.nat-ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.nat-ring-bg { fill: none; stroke: #e8f5e9; stroke-width: 6; }
.nat-ring-fill { fill: none; stroke: url(#nat-grad); stroke-width: 6; stroke-linecap: round; stroke-dasharray: 377; transition: stroke-dashoffset 0.5s ease; }
.nat-orb-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.nat-big-emoji { font-size: 2.2rem; }
.nat-orb-pct { font-size: 0.9rem; font-weight: bold; color: #2e7d32; }

.nat-badge { background: #c8e6c9; color: #1b5e20; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; margin-bottom: 12px; display: inline-flex; align-items: center; gap: 6px; }
.nat-title { color: #1b5e20; font-size: 1.1rem; margin-bottom: 20px; }
.nat-bar-wrap { height: 8px; background: #e8f5e9; border-radius: 4px; overflow: hidden; margin-bottom: 20px; }
.nat-bar-fill { height: 100%; background: linear-gradient(90deg, #81c784, #4caf50); border-radius: 4px; transition: width 0.5s ease; position: relative; }
.nat-bar-sparkle { position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: barGlow 2s infinite; }
.nat-flowers { display: flex; justify-content: center; gap: 12px; font-size: 1.2rem; }

/* 
   THEME 6: ORBIT
*/
.orbit-mode { background: #010409; }
.orbit-card { width: 440px; background: rgba(13, 17, 23, 0.8); border: 1px solid #30363d; border-radius: 24px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); backdrop-filter: blur(10px); }
.orb-starfield { position: absolute; inset: 0; overflow: hidden; }
.orb-star { position: absolute; background: #fff; border-radius: 50%; opacity: 0; animation: twinkle 3s infinite; }
@keyframes twinkle { 0%, 100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 0.8; transform: scale(1.2); } }

.orb-system { position: relative; width: 140px; height: 140px; margin-bottom: 25px; display: flex; align-items: center; justify-content: center; }
.orb-ring { position: absolute; border: 1px solid rgba(255,255,255,0.05); border-radius: 50%; }
.ring-1 { width: 100px; height: 100px; }
.ring-2 { width: 130px; height: 130px; }
.ring-3 { width: 160px; height: 160px; opacity: 0.3; }

.orb-sun { position: relative; width: 45px; height: 45px; border-radius: 50%; background: #ffd700; box-shadow: 0 0 20px rgba(255,215,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 2; }
.orb-corona { position: absolute; inset: -4px; border-radius: 50%; background: radial-gradient(circle, rgba(255,215,0,0.2) 0%, transparent 70%); animation: pulse 2s infinite; }
.orb-sun-core { display: flex; flex-direction: column; align-items: center; color: #000; line-height: 1; }
.orb-pct { font-size: 1.1rem; font-weight: bold; }
.orb-pct-unit { font-size: 0.6rem; font-weight: bold; }

.orb-planet { position: absolute; border-radius: 50%; animation: orbit infinite linear; }
.p1 { width: 8px; height: 8px; background: #8b5cf6; top: 20px; left: 50%; margin-left: -4px; transform-origin: center 50px; animation-duration: 4s; }
.p2 { width: 12px; height: 12px; background: #3b82f6; top: 5px; left: 50%; margin-left: -6px; transform-origin: center 65px; animation-duration: 7s; }
.p3 { width: 10px; height: 10px; background: #ef4444; top: -10px; left: 50%; margin-left: -5px; transform-origin: center 80px; animation-duration: 10s; }
@keyframes orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.orb-mission-tag { display: inline-flex; align-items: center; gap: 8px; font-size: 0.65rem; color: #8b949e; letter-spacing: 2px; margin-bottom: 12px; }
.orb-blink-dot { width: 6px; height: 6px; background: #f85149; border-radius: 50%; animation: blinkStatus 1s infinite; }
.orb-title { color: #c9d1d9; font-size: 1.1rem; margin-bottom: 20px; }
.orb-progress-bar { height: 4px; background: #21262d; border-radius: 2px; overflow: visible; position: relative; margin-bottom: 15px; }
.orb-bar-fill { height: 100%; border-radius: 2px; background: #ffd700; box-shadow: 0 0 10px rgba(255,215,0,0.5); transition: width 0.5s ease; position: relative; }
.orb-bar-comet { position: absolute; right: -5px; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; background: #fff; border-radius: 50%; box-shadow: 0 0 10px #fff; }
.orb-telemetry { display: flex; justify-content: center; gap: 15px; font-size: 0.6rem; color: #484f58; font-family: monospace; }
</style>
