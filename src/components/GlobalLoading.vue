<script setup lang="ts">
import { useTranslateManager } from '../composables/useTranslateManager';
import { loadingTheme } from '../store';

const { globalLoading } = useTranslateManager();
</script>

<template>
  <Teleport to="body">
    <transition name="loading-fade">
      <div v-if="globalLoading.active" class="p-loading-overlay" :class="{
        'cute-mode': loadingTheme === 'cute',
        'premium-mode': loadingTheme === 'premium',
        'cyber-mode': loadingTheme === 'cyber',
        'retro-mode': loadingTheme === 'retro',
        'nature-mode': loadingTheme === 'nature',
        'orbit-mode': loadingTheme === 'orbit'
      }">
        <div class="p-loading-card" :class="{
          'cute-card': loadingTheme === 'cute',
          'premium-card': loadingTheme === 'premium',
          'cyber-card': loadingTheme === 'cyber',
          'retro-card': loadingTheme === 'retro',
          'nature-card': loadingTheme === 'nature',
          'orbit-card': loadingTheme === 'orbit'
        }">
          
          <!-- THEME: CUTE (Kawaii Cat) -->
          <template v-if="loadingTheme === 'cute'">
            <div class="cute-cat-container">
              <div class="cat-head">
                <div class="cat-ear left"></div>
                <div class="cat-ear right"></div>
                <div class="cat-face">
                  <div class="cat-eye left"><div class="eye-sparkle"></div></div>
                  <div class="cat-eye right"><div class="eye-sparkle"></div></div>
                  <div class="cat-nose"></div>
                  <div class="cat-mouth"></div>
                  <div class="cat-whiskers left"><span></span><span></span><span></span></div>
                  <div class="cat-whiskers right"><span></span><span></span><span></span></div>
                </div>
              </div>
              <div class="cat-paws"><div class="cat-paw left"></div><div class="cat-paw right"></div></div>
            </div>

            <div class="p-info-box">
              <div class="p-label-group">
                <div class="cute-status-badge">Working hard for you! <span>(｡◕‿◕｡)</span></div>
                <h3 class="cute-main-title">{{ globalLoading.message }}</h3>
              </div>
              <div class="cute-progress-section">
                <div class="cute-progress-header">
                  <span class="pct-num">{{ globalLoading.progress }}%</span>
                  <span class="pct-detail">Almost there...</span>
                </div>
                <div class="cute-bar-track">
                  <div class="cute-bar-fill" :style="{ width: globalLoading.progress + '%' }">
                    <div class="paw-indicator">🐾</div>
                  </div>
                </div>
                <p class="cute-motivational">Be patient, humans! ✨</p>
              </div>
            </div>
            <div class="cute-decor-bubble bubble-1"></div>
            <div class="cute-decor-bubble bubble-2"></div>
          </template>

          <!-- THEME: PREMIUM (Neon Neon) -->
          <template v-else-if="loadingTheme === 'premium'">
            <div class="p-spinner-box">
                <svg viewBox="0 0 100 100" class="p-svg-spinner">
                  <defs>
                    <linearGradient id="spinner-grad-global" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#6366f1" />
                      <stop offset="100%" stop-color="#db2777" />
                    </linearGradient>
                  </defs>
                  <circle class="p-path-bg" cx="50" cy="50" r="45" />
                  <circle class="p-path-fill" cx="50" cy="50" r="45" stroke="url(#spinner-grad-global)" :style="{ strokeDashoffset: 283 - (283 * globalLoading.progress / 100) }" />
                </svg>
              <div class="p-pct-display">
                <span class="p-pct-num">{{ globalLoading.progress }}</span>
                <span class="p-pct-unit">%</span>
              </div>
            </div>
            <div class="p-info-box">
              <div class="p-label-group">
                <div class="p-status-pill">NEURAL SYNCING</div>
                <h3 class="p-main-title">{{ globalLoading.message }}</h3>
              </div>
              <div class="p-bar-wrapper">
                <div class="p-bar-track">
                  <div class="p-bar-fill" :style="{ width: globalLoading.progress + '%' }"></div>
                </div>
                <div class="p-bar-labels"><span>CORE QUANTUM</span><span>STABILIZING</span></div>
              </div>
            </div>
            <div class="p-bg-glow"></div>
          </template>

          <!-- THEME: CYBER (Cyberpunk) -->
          <template v-else-if="loadingTheme === 'cyber'">
            <div class="cyber-glitch-box">
              <div class="cyber-scan-line"></div>
              <div class="cyber-text-pct" :data-text="globalLoading.progress + '%'">{{ globalLoading.progress }}%</div>
            </div>
            <div class="p-info-box">
              <div class="p-label-group">
                <div class="cyber-badge">Vinx_OS // DATA_RIPPER</div>
                <h3 class="cyber-title">> {{ globalLoading.message }}_</h3>
              </div>
              <div class="cyber-progress-area">
                <div class="cyber-track">
                  <div class="cyber-fill" :style="{ width: globalLoading.progress + '%' }">
                    <div class="cyber-pixels"></div>
                  </div>
                </div>
                <div class="cyber-footer">SECURE_LINK_ACTIVE // PORT_8080</div>
              </div>
            </div>
            <div class="cyber-grid"></div>
          </template>

          <!-- THEME: RETRO (Win95) -->
          <template v-else-if="loadingTheme === 'retro'">
            <div class="retro-window-header">
              <span class="retro-win-title">System Update</span>
              <div class="retro-win-buttons"><span>_</span><span>[ ]</span><span>X</span></div>
            </div>
            <div class="retro-body">
              <div class="retro-icon-box">💾</div>
              <div class="retro-content">
                <div class="retro-msg">Vinx Universal is processing your request.</div>
                <div class="retro-detail">{{ globalLoading.message }}...</div>
                <div class="retro-bar-track">
                  <div class="retro-blocks">
                    <div v-for="i in 20" :key="i" class="retro-block" :class="{ active: i <= (globalLoading.progress / 5) }"></div>
                  </div>
                </div>
                <div class="retro-pct-text">{{ globalLoading.progress }}% complete</div>
              </div>
            </div>
            <div class="retro-footer">
              <button class="retro-btn" disabled>Cancel</button>
            </div>
          </template>

          <!-- THEME: NATURE (Garden) -->
          <template v-else-if="loadingTheme === 'nature'">
            <div class="nature-circle">
              <div class="leaf-anim l1">🍃</div>
              <div class="leaf-anim l2">🍀</div>
              <div class="nature-pct">{{ globalLoading.progress }}%</div>
            </div>
            <div class="p-info-box">
              <div class="p-label-group">
                <div class="nature-badge">GROWING SYSTEM</div>
                <h3 class="nature-title">{{ globalLoading.message }}</h3>
              </div>
              <div class="nature-track">
                <div class="nature-fill" :style="{ width: globalLoading.progress + '%' }"></div>
              </div>
              <div class="nature-flowers"><span>🌸</span><span>🌼</span><span>🌻</span></div>
            </div>
          </template>

          <!-- THEME: ORBIT (Space) -->
          <template v-else-if="loadingTheme === 'orbit'">
            <div class="orbit-box">
              <div class="orbit-sun">{{ globalLoading.progress }}%</div>
              <div class="planet p1"></div>
              <div class="planet p2"></div>
              <div class="planet p3"></div>
            </div>
            <div class="p-info-box">
              <div class="p-label-group">
                <div class="orbit-badge">DEEP SPACE SCANNING</div>
                <h3 class="orbit-title">{{ globalLoading.message }}</h3>
              </div>
              <div class="orbit-track">
                <div class="orbit-fill" :style="{ width: globalLoading.progress + '%' }"></div>
              </div>
              <div class="orbit-stars">✨ Constellating data patterns...</div>
            </div>
          </template>

        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* MULTI-THEME LOADING MODAL STYLES */
.p-loading-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  z-index: 999999;
  backdrop-filter: blur(15px);
  transition: all 0.5s ease;
}

.p-loading-card {
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 30px;
  overflow: hidden;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* === THEME 1: CUTE (Kawaii Cat) === */
.cute-mode { background: rgba(255, 240, 245, 0.85); }
.cute-card {
  width: 460px; background: #FFF; border: 4px solid #FFD1DC; border-radius: 40px; padding: 50px 30px;
  box-shadow: 0 30px 60px -12px rgba(255, 182, 193, 0.4);
}
.cute-cat-container { position: relative; width: 140px; height: 120px; }
.cat-head { position: absolute; width: 100px; height: 85px; background: #FFF; border: 3px solid #f0f0f0; border-radius: 50% 50% 45% 45%; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 2; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
.cat-ear { position: absolute; width: 35px; height: 35px; background: #FFF; border: 3px solid #f0f0f0; border-radius: 8px 30px 8px 8px; z-index: 1; top: -15px; }
.cat-ear.left { left: 10px; transform: rotate(-15deg); animation: earWiggleLeft 3s infinite; }
.cat-ear.right { right: 10px; transform: rotate(60deg) scaleX(-1); animation: earWiggleRight 3s infinite; }
.cat-ear::after { content: ''; position: absolute; width: 18px; height: 18px; background: #FFD1DC; border-radius: 5px 20px 5px 5px; top: 6px; left: 6px; }
.cat-eye { position: absolute; width: 14px; height: 14px; background: #333; border-radius: 50%; top: 35px; animation: blink 4s infinite; }
.cat-eye.left { left: 25px; } .cat-eye.right { right: 25px; }
.cat-nose { position: absolute; width: 8px; height: 5px; background: #FFB6C1; border-radius: 50%; top: 52px; left: 50%; transform: translateX(-50%); }
.cat-whiskers { position: absolute; top: 45px; display: flex; flex-direction: column; gap: 4px; }
.cat-whiskers.left { left: -15px; } .cat-whiskers.right { right: -15px; transform: scaleX(-1); }
.cat-whiskers span { width: 25px; height: 2px; background: #EEE; border-radius: 2px; }
.cat-paws { position: absolute; bottom: 0px; width: 100%; display: flex; justify-content: center; gap: 40px; }
.cat-paw { width: 20px; height: 12px; background: #FFF; border: 2px solid #EEE; border-radius: 10px 10px 5px 5px; animation: pawStep 1.5s infinite alternate; }
.cat-paw.right { animation-delay: 0.75s; }
.cute-status-badge { display: inline-block; background: #FFF0F5; color: #DB2777; padding: 6px 20px; border-radius: 100px; font-size: 0.75rem; font-weight: 800; border: 2px solid #FFD1DC; margin-bottom: 10px; }
.cute-bar-track { height: 20px; background: #F8F8F8; border-radius: 50px; border: 3px solid #FFD1DC; position: relative; overflow: hidden; }
.cute-bar-fill { height: 100%; background: linear-gradient(90deg, #FFD1DC, #FFB6C1, #DB2777); background-size: 300% 100%; animation: candyMove 3s linear infinite; border-radius: 50px; position: relative; transition: width 0.5s; }
.paw-indicator { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); font-size: 0.8rem; }

/* === THEME 2: PREMIUM (Neon Glass) === */
.premium-mode { background: rgba(5, 5, 10, 0.92); }
.premium-card {
  width: 440px; background: rgba(20, 20, 35, 0.6); 
  border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 32px; padding: 45px;
  box-shadow: 0 50px 100px rgba(0,0,0,0.9), 0 0 40px rgba(99, 102, 241, 0.15); 
  backdrop-filter: blur(30px);
  animation: premiumEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}
@keyframes premiumEntrance { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

.p-spinner-box { position: relative; width: 140px; height: 140px; margin-bottom: 20px; }
.p-svg-spinner { width: 100%; height: 100%; transform: rotate(-90deg); filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.5)); }
.p-path-bg { fill: none; stroke: rgba(255,255,255,0.03); stroke-width: 5; }
.p-path-fill { fill: none; stroke: url(#spinner-grad-p); stroke-width: 5; stroke-linecap: round; transition: stroke-dashoffset 0.5s ease; stroke-dasharray: 283; }

.p-pct-display { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; align-items: baseline; gap: 2px; }
.p-pct-num { font-size: 2.8rem; font-weight: 950; color: #fff; text-shadow: 0 0 25px rgba(99, 102, 241, 0.8); font-family: sans-serif; }
.p-pct-unit { font-size: 1rem; color: #6366f1; font-weight: 900; }

.p-status-pill { 
  display: inline-block; padding: 6px 16px; background: linear-gradient(90deg, rgba(99, 102, 241, 0.2), rgba(219, 39, 119, 0.2)); 
  border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 100px; color: #fff; 
  font-size: 0.7rem; font-weight: 900; letter-spacing: 0.2em; margin-bottom: 12px;
  text-shadow: 0 0 10px rgba(255,255,255,0.5);
}
.p-main-title { font-size: 1.2rem; color: rgba(255,255,255,0.9); margin: 0; font-weight: 800; letter-spacing: -0.01em; }
.p-bar-track { height: 6px; width: 100%; background: rgba(255,255,255,0.04); border-radius: 3px; margin-top: 25px; position: relative; overflow: hidden; }
.p-bar-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #db2777); border-radius: 3px; box-shadow: 0 0 20px #6366f1; transition: width 0.5s; }
.p-bg-glow { 
  position: absolute; top: -40%; left: -40%; width: 180%; height: 180%; 
  background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 60%); 
  pointer-events: none; animation: glowPulse 4s infinite ease-in-out; 
}
@keyframes glowPulse { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }

/* === THEME 3: CYBER (Cyberpunk) === */
.cyber-mode { background: #000; }
.cyber-card {
  width: 450px; background: #fee715; border: 4px solid #000; border-radius: 0; padding: 40px;
  box-shadow: 12px 12px 0 #000, -12px -12px 0 rgba(255, 0, 255, 0.5);
}
.cyber-glitch-box { position: relative; padding: 20px; background: #000; color: #fee715; margin-bottom: 20px; font-family: monospace; }
.cyber-scan-line { position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: rgba(255, 0, 255, 0.3); animation: cyberScan 2s infinite; }
.cyber-text-pct { font-size: 3.5rem; font-weight: 900; position: relative; }
.cyber-badge { background: #000; color: #fee715; padding: 4px 8px; border-radius: 0; font-weight: 900; font-size: 0.7rem; display: inline-block; margin-bottom: 10px; }
.cyber-title { color: #000; font-weight: 950; font-size: 1.2rem; }
.cyber-track { height: 30px; background: #000; border: 2px solid #000; position: relative; margin-top: 20px; }
.cyber-fill { height: 100%; background: #fee715; transition: width 0.3s; position: relative; }
.cyber-pixels { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background-image: repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px); }
.cyber-grid { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px); background-size: 20px 20px; pointer-events: none; }
@keyframes cyberScan { 0% { top: 0; } 100% { top: 100%; } }

/* === THEME 4: RETRO (Win95) === */
.retro-mode { background: #008080; }
.retro-card {
  width: 400px; background: #c0c0c0; border: 2px solid; border-color: #fff #808080 #808080 #fff; padding: 3px; display: block !important;
}
.retro-window-header { background: #000080; color: #fff; padding: 4px 6px; display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; }
.retro-win-buttons { display: flex; gap: 2px; }
.retro-win-buttons span { width: 16px; height: 14px; background: #c0c0c0; border: 1px solid; border-color: #fff #808080 #808080 #fff; color: #000; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: default; }
.retro-body { padding: 20px; display: flex; gap: 20px; color: #000; font-size: 12px; }
.retro-icon-box { font-size: 32px; }
.retro-msg { font-weight: bold; margin-bottom: 5px; }
.retro-detail { margin-bottom: 15px; }
.retro-bar-track { height: 22px; width: 100%; border: 2px solid; border-color: #808080 #fff #fff #808080; background: #fff; position: relative; margin-top: 10px; }
.retro-bar-fill { height: 100%; background: #000080; width: 0; transition: width 0.3s; }
.retro-blocks { position: absolute; inset: 0; display: flex; gap: 2px; padding: 2px; }
.retro-block { flex: 1; height: 100%; opacity: 0; }
.retro-block.active { background: #000080 !important; opacity: 1 !important; }
.retro-pct-text { margin-top: 5px; text-align: center; }
.retro-footer { padding: 10px; display: flex; justify-content: flex-end; border-top: 1px solid #808080; }
.retro-btn { padding: 4px 20px; background: #c0c0c0; border: 2px solid; border-color: #fff #808080 #808080 #fff; font-size: 12px; }

/* === THEME 5: NATURE (Garden) === */
.nature-mode { background: #e8f5e9; }
.nature-card { width: 440px; background: #fff; border-radius: 30px; padding: 50px 30px; border: 8px solid #a5d6a7; }
.nature-circle { position: relative; width: 120px; height: 120px; background: #c8e6c9; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; overflow: hidden; }
.nature-pct { font-size: 1.8rem; font-weight: 900; color: #2e7d32; z-index: 2; }
.leaf-anim { position: absolute; font-size: 1.5rem; animation: leafFall 3s infinite linear; }
.l1 { left: 20%; top: -20px; } .l2 { right: 20%; top: -20px; animation-delay: 1.5s; }
.nature-badge { background: #4caf50; color: #fff; padding: 4px 15px; border-radius: 20px; font-weight: 800; font-size: 0.7rem; display: inline-block; margin-bottom: 10px; }
.nature-title { color: #1b5e20; font-weight: 800; }
.nature-track { height: 12px; background: #f1f8e9; border-radius: 6px; position: relative; margin-top: 10px; border: 2px solid #a5d6a7; overflow: hidden; }
.nature-fill { height: 100%; background: linear-gradient(90deg, #81c784, #4caf50); transition: width 0.5s; }
.nature-flowers { display: flex; gap: 15px; font-size: 1.2rem; margin-top: 10px; }
@keyframes leafFall { 0% { top: -20px; transform: rotate(0deg) translateX(0); } 100% { top: 120px; transform: rotate(360deg) translateX(20px); } }

/* === THEME 6: ORBIT (Space) === */
.orbit-mode { background: #050505; }
.orbit-card { width: 440px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 40px; padding: 50px 30px; }
.orbit-box { position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
.orbit-sun { width: 80px; height: 80px; background: radial-gradient(circle, #fff, #ffe082); border-radius: 50%; box-shadow: 0 0 40px #ffe082; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #000; font-size: 1.4rem; z-index: 5; }
.planet { position: absolute; border-radius: 50%; }
.p1 { width: 10px; height: 10px; background: #64b5f6; transform-origin: 80px center; animation: orbitRot 4s infinite linear; }
.p2 { width: 15px; height: 15px; background: #ff7043; transform-origin: 65px center; animation: orbitRot 6s infinite linear; }
.p3 { width: 8px; height: 8px; background: #ce93d8; transform-origin: 50px center; animation: orbitRot 3s infinite linear; }
.orbit-badge { color: #ffe082; font-weight: 900; font-size: 0.7rem; letter-spacing: 0.2em; border-bottom: 2px solid #ffe082; padding-bottom: 4px; margin-bottom: 15px; }
.orbit-title { color: #fff; font-weight: 700; opacity: 0.9; }
.orbit-track { height: 2px; background: rgba(255,255,255,0.1); border-radius: 1px; margin-top: 20px; }
.orbit-fill { height: 100%; background: #ffe082; box-shadow: 0 0 10px #ffe082; transition: width 0.5s; border-radius: 1px; }
.orbit-stars { color: rgba(255,255,255,0.4); font-size: 0.7rem; margin-top: 10px; font-style: italic; }
@keyframes orbitRot { from { transform: rotate(0deg) translateX(80px) rotate(0deg); } to { transform: rotate(360deg) translateX(80px) rotate(-360deg); } }

/* Shared Utilities */
.p-info-box { text-align: center; width: 100%; z-index: 5; }
.loading-fade-enter-active, .loading-fade-leave-active { transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
.loading-fade-enter-from { opacity: 0; transform: scale(0.9); filter: blur(10px); }
.loading-fade-leave-to { opacity: 0; transform: scale(1.1); filter: blur(5px); }

/* Common Helper Keyframes */
@keyframes earWiggleLeft { 0%, 90%, 100% { transform: rotate(-15deg); } 95% { transform: rotate(-25deg); } }
@keyframes earWiggleRight { 0%, 90%, 100% { transform: rotate(60deg) scaleX(-1); } 95% { transform: rotate(70deg) scaleX(-1); } }
@keyframes blink { 0%, 95%, 100% { transform: scaleY(1); } 97.5% { transform: scaleY(0.1); } }
@keyframes pawStep { from { transform: translateY(0); } to { transform: translateY(-5px); } }
@keyframes candyMove { 0% { background-position: 100% 0; } 100% { background-position: -200% 0; } }
</style>
