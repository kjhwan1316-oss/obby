import './styles/main.css'

type Platform = { x: number; y: number; w: number; h: number; kind: 'normal' | 'moving' | 'vanish' | 'bounce' | 'ice' }
type Hazard = { x: number; y: number; w: number; h: number; kind: 'lava' | 'laser' | 'saw' }
type Stage = { id: number; difficulty: string; platforms: Platform[]; hazards: Hazard[]; goal: { x: number; y: number }; time: number }

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const ctx = canvas.getContext('2d')!
const ui = document.querySelector<HTMLDivElement>('#ui')!
const stages: Stage[] = Array.from({ length: 100 }, (_, i) => makeStage(i + 1))
let stageIndex = Number(localStorage.getItem('jump100-stage') ?? 0)
let deaths = 0, playing = false, last = 0, cameraX = 0, elapsed = 0
let checkpoint = { x: 70, y: 360 }
const keys = new Set<string>()
const player = { x: 70, y: 350, w: 24, h: 30, vx: 0, vy: 0, grounded: false }

function makeStage(id: number): Stage {
  const d = Math.min(1, (id - 1) / 99), count = 8 + Math.floor(id / 9)
  const platforms: Platform[] = [{ x: 0, y: 430, w: 250, h: 28, kind: 'normal' }]
  const hazards: Hazard[] = []
  let x = 220, y = 390
  for (let i = 1; i < count; i++) {
    const gap = 46 + ((id * 17 + i * 29) % Math.floor(76 + d * 62)); x += gap
    y = 340 - ((id * 13 + i * 31) % Math.floor(130 + d * 95))
    const width = Math.max(48, 108 - Math.floor(d * 43) - ((id + i) % 3) * 7), roll = (id * 7 + i * 11) % 100
    const kind: Platform['kind'] = id < 15 ? 'normal' : roll < 18 + d * 18 ? 'moving' : roll < 35 + d * 16 ? 'vanish' : roll < 48 + d * 15 ? 'bounce' : roll < 62 + d * 12 ? 'ice' : 'normal'
    platforms.push({ x, y, w: width, h: 20, kind })
    if (id >= 12 && (i + id) % 3 === 0) hazards.push({ x: x - gap * 0.55, y: 420, w: Math.min(70, gap * 0.65), h: 12, kind: id >= 65 && i % 2 === 0 ? 'laser' : id >= 35 && i % 3 === 0 ? 'saw' : 'lava' })
    if (id >= 55 && i % 4 === 0) hazards.push({ x: x + width * 0.35, y: y - 74, w: 8, h: 74, kind: 'laser' })
  }
  const last = platforms[platforms.length - 1]
  return { id, difficulty: id < 20 ? '입문' : id < 45 ? '도전' : id < 75 ? '극한' : '마스터', platforms, hazards, goal: { x: last.x + last.w - 30, y: last.y - 50 }, time: Math.max(22, 62 - Math.floor(d * 28)) }
}

function resize() { canvas.width = Math.floor(innerWidth * devicePixelRatio); canvas.height = Math.floor(innerHeight * devicePixelRatio); canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0) }
addEventListener('resize', resize); resize()
function resetStage() { player.x = checkpoint.x; player.y = checkpoint.y; player.vx = 0; player.vy = 0; cameraX = Math.max(0, player.x - innerWidth * 0.35); elapsed = 0; updateHud(); draw() }
function startStage(i = stageIndex) { stageIndex = Math.max(0, Math.min(99, i)); checkpoint = { x: 70, y: 360 }; playing = true; deaths = 0; document.querySelector('#start')?.remove(); resetStage(); last = performance.now(); requestAnimationFrame(loop) }
function die() { deaths++; resetStage(); pulse('다시 도전!') }
function finish() { playing = false; const next = Math.min(99, stageIndex + 1); if (next > Number(localStorage.getItem('jump100-stage') ?? 0)) localStorage.setItem('jump100-stage', String(next)); showStart(true) }
function pulse(text: string) { const el = document.querySelector('#pulse'); if (el) { el.textContent = text; el.classList.remove('show'); void el.clientWidth; el.classList.add('show') } }
function loop(now: number) { if (!playing) return; const dt = Math.min(0.032, (now - last) / 1000); last = now; update(dt); draw(); requestAnimationFrame(loop) }
function update(dt: number) {
  const s = stages[stageIndex], left = keys.has('ArrowLeft') || keys.has('a'), right = keys.has('ArrowRight') || keys.has('d'), jump = keys.has(' ') || keys.has('ArrowUp') || keys.has('w')
  player.vx += ((right ? 1 : 0) - (left ? 1 : 0)) * 1250 * dt; player.vx *= Math.pow(0.0008, dt); player.vx = Math.max(-260, Math.min(260, player.vx))
  if (jump && player.grounded) { player.vy = -590; player.grounded = false }
  player.vy += 1450 * dt; const oldY = player.y; player.x += player.vx * dt; player.y += player.vy * dt; player.grounded = false
  for (const p of s.platforms) { const px = p.x + (p.kind === 'moving' ? Math.sin(elapsed * 2 + p.x) * 32 : 0); const visible = p.kind !== 'vanish' || Math.sin(elapsed * 3 + p.x * 0.01) > -0.45; if (visible && player.vy >= 0 && oldY + player.h <= p.y + 4 && player.y + player.h >= p.y && player.x + player.w > px && player.x < px + p.w) { player.y = p.y - player.h; player.vy = p.kind === 'bounce' ? -850 : 0; player.grounded = true } }
  for (const h of s.hazards) { const active = h.kind !== 'laser' || Math.sin(elapsed * 4) > -0.2; if (active && hit(player, h)) return die() }
  elapsed += dt; if (player.y > 620 || elapsed > s.time) return die(); if (player.x > checkpoint.x + 250) checkpoint = { x: player.x, y: Math.min(player.y, 360) }
  if (hit(player, { x: s.goal.x, y: s.goal.y, w: 32, h: 54 })) return finish(); cameraX += (player.x - innerWidth * 0.36 - cameraX) * Math.min(1, dt * 5); updateHud()
}
function hit(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y }
function draw() { const s = stages[stageIndex]; ctx.clearRect(0, 0, innerWidth, innerHeight); const g = ctx.createLinearGradient(0, 0, 0, innerHeight); g.addColorStop(0, '#101b3b'); g.addColorStop(1, '#40265b'); ctx.fillStyle = g; ctx.fillRect(0, 0, innerWidth, innerHeight); ctx.fillStyle = 'rgba(255,255,255,.45)'; for (let i = 0; i < 55; i++) ctx.fillRect((i * 137) % innerWidth, (i * 71) % 300, (i % 3) + 1, (i % 3) + 1); ctx.save(); ctx.translate(-cameraX, 0); for (const h of s.hazards) drawHazard(h); for (const p of s.platforms) drawPlatform(p); drawGoal(s.goal); drawPlayer(); ctx.restore() }
function drawPlatform(p: Platform) { const x = p.x + (p.kind === 'moving' ? Math.sin(elapsed * 2 + p.x) * 32 : 0); if (p.kind === 'vanish' && Math.sin(elapsed * 3 + p.x * 0.01) <= -0.45) return; ctx.fillStyle = p.kind === 'bounce' ? '#62f2c1' : p.kind === 'ice' ? '#9de7ff' : p.kind === 'vanish' ? '#d68cff' : p.kind === 'moving' ? '#ffbe5c' : '#f6f0dd'; ctx.fillRect(x, p.y, p.w, p.h); ctx.fillStyle = 'rgba(22,16,49,.28)'; ctx.fillRect(x, p.y + 12, p.w, 8); ctx.fillStyle = '#fff'; ctx.fillRect(x + 6, p.y + 4, Math.max(0, p.w - 18), 3) }
function drawHazard(h: Hazard) { ctx.fillStyle = h.kind === 'lava' ? '#ff5b55' : h.kind === 'laser' ? '#ff5de5' : '#ffc857'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14; if (h.kind === 'saw') { ctx.beginPath(); ctx.arc(h.x + h.w / 2, h.y, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3b194f'; ctx.beginPath(); ctx.arc(h.x + h.w / 2, h.y, 7, 0, Math.PI * 2); ctx.fill() } else ctx.fillRect(h.x, h.y, h.w, h.h); ctx.shadowBlur = 0 }
function drawGoal(g: Stage['goal']) { ctx.fillStyle = '#69f5ff'; ctx.shadowColor = '#69f5ff'; ctx.shadowBlur = 22; ctx.beginPath(); ctx.arc(g.x + 16, g.y + 24, 26 + Math.sin(elapsed * 4) * 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#13204a'; ctx.beginPath(); ctx.arc(g.x + 16, g.y + 24, 15, 0, Math.PI * 2); ctx.fill() }
function drawPlayer() { ctx.fillStyle = '#ffd35c'; ctx.fillRect(player.x, player.y, player.w, player.h); ctx.fillStyle = '#1a183c'; ctx.fillRect(player.x + 5, player.y + 7, 5, 5); ctx.fillRect(player.x + 15, player.y + 7, 5, 5); ctx.fillStyle = '#ff7a45'; ctx.fillRect(player.x + 3, player.y + player.h - 5, player.w - 6, 5) }
function updateHud() { const s = stages[stageIndex], el = document.querySelector('#hud'); if (el) el.innerHTML = `<div class="hud-left"><b>JUMP 100</b><span>스테이지 ${String(s.id).padStart(2, '0')} · ${s.difficulty}</span></div><div class="hud-center"><i style="width:${Math.max(4, Math.min(100, (player.x / Math.max(1, s.goal.x)) * 100))}%"></i></div><div class="hud-right"><span>실패 ${deaths}</span><span>남은 시간 ${Math.max(0, Math.ceil(s.time - elapsed))}초</span></div>` }
function showStart(completed = false) { playing = false; const unlocked = Number(localStorage.getItem('jump100-stage') ?? 0); ui.innerHTML = `<div id="start" class="start"><div class="card"><div class="eyebrow">2D PLATFORM CHALLENGE</div><h1>JUMP <em>100</em></h1><p>${completed ? '스테이지 클리어! 다음 코스에 도전하세요.' : '점프하고, 피하고, 100개의 코스를 돌파하세요.'}</p><div class="stage-select"><label>STAGE</label><select id="stageSelect">${stages.map((s, i) => `<option value="${i}" ${i === stageIndex ? 'selected' : ''} ${i > unlocked ? 'disabled' : ''}>${String(i + 1).padStart(2, '0')} · ${s.difficulty}</option>`).join('')}</select></div><button id="play">${completed ? '다음 스테이지' : '게임 시작'}</button><div class="help"><kbd>A</kbd><kbd>D</kbd> 이동　<kbd>SPACE</kbd> 점프　 <kbd>R</kbd> 재시작</div><div class="progress">해금 ${Math.min(100, unlocked + 1)} / 100</div></div></div><div id="pulse"></div>`; document.querySelector('#play')?.addEventListener('click', () => { const selected = Number((document.querySelector('#stageSelect') as HTMLSelectElement).value); startStage(completed ? Math.min(99, selected + 1) : selected) }) }
for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'a', 'd', 'w', ' ']) addEventListener('keydown', e => { if (k === e.key) { keys.add(k); e.preventDefault() } }); addEventListener('keyup', e => keys.delete(e.key)); addEventListener('keydown', e => { if (e.key === 'r' && playing) resetStage() })
ui.innerHTML = '<div id="hud"></div><div id="pulse"></div>'; showStart(); draw()
