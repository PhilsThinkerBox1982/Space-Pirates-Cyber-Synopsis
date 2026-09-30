const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const timerElement = document.querySelector("#timer");
const livesElement = document.querySelector("#lives");
const bestScoreElement = document.querySelector("#best-score");
const overlay = document.querySelector("#overlay");
const overlayEyebrow = document.querySelector("#overlay-eyebrow");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const startButton = document.querySelector("#start-button");
const startLabel = document.querySelector("#start-label");
const pauseButton = document.querySelector("#pause-button");
const gameStatus = document.querySelector("#game-status");
const toast = document.querySelector("#toast");

const RUN_LENGTH = 45;
const PLAYER_RADIUS = 19;
const keys = new Set();
const touchDirections = new Map();

let width = 0;
let height = 0;
let pixelRatio = 1;
let stars = [];
let objects = [];
let playerX = 0.5;
let lives = 3;
let score = 0;
let elapsed = 0;
let spawnTimer = 0;
let invulnerableFor = 0;
let lastFrame = 0;
let toastTimer = 0;
let gameState = "ready";
let bestScore = 0;

try {
  bestScore = Number(window.localStorage.getItem("neon-corsair-best")) || 0;
} catch (error) {
  console.warn("Could not read the saved best score.", error);
}
bestScoreElement.textContent = formatScore(bestScore);

function formatScore(value) {
  return String(value).padStart(4, "0");
}

function announce(message) {
  gameStatus.textContent = message;
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  width = bounds.width;
  height = bounds.height;
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  stars = Array.from({ length: Math.max(45, Math.floor((width * height) / 4200)) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 1.7 + 0.3,
    twinkle: Math.random() * Math.PI * 2,
  }));
}

function resetRun() {
  objects = [];
  playerX = 0.5;
  lives = 3;
  score = 0;
  elapsed = 0;
  spawnTimer = 0.55;
  invulnerableFor = 0;
  updateHud();
}

function updateHud() {
  scoreElement.textContent = formatScore(score);
  timerElement.textContent = Math.max(0, RUN_LENGTH - elapsed).toFixed(1);
  livesElement.textContent = `${"◆ ".repeat(lives)}${"◇ ".repeat(3 - lives)}`.trim();
  livesElement.setAttribute("aria-label", `${lives} of 3 hull points remaining`);
}

function startRun() {
  resetRun();
  gameState = "playing";
  overlay.classList.add("is-hidden");
  pauseButton.disabled = false;
  pauseButton.innerHTML = 'PAUSE <span aria-hidden="true">Ⅱ</span>';
  announce("Run started. Collect cyan data shards and avoid orange mines.");
}

function pauseRun() {
  if (gameState === "playing") {
    gameState = "paused";
    showOverlay("RUN PAUSED", "Catch your breath, captain.", "Ready when you are.", "RESUME RUN");
    pauseButton.innerHTML = 'RESUME <span aria-hidden="true">▶</span>';
    announce("Run paused.");
  } else if (gameState === "paused") {
    gameState = "playing";
    overlay.classList.add("is-hidden");
    pauseButton.innerHTML = 'PAUSE <span aria-hidden="true">Ⅱ</span>';
    announce("Run resumed.");
  }
}

function showOverlay(eyebrow, title, copy, buttonText) {
  overlayEyebrow.textContent = eyebrow;
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  startLabel.textContent = buttonText;
  overlay.classList.remove("is-hidden");
  startButton.focus({ preventScroll: true });
}

function finishRun(won) {
  gameState = "over";
  pauseButton.disabled = true;
  const isNewBest = score > bestScore;
  if (isNewBest) {
    bestScore = score;
    bestScoreElement.textContent = formatScore(bestScore);
    try {
      window.localStorage.setItem("neon-corsair-best", String(bestScore));
    } catch (error) {
      console.warn("Could not save the best score.", error);
    }
  }

  const result = won ? "Run complete" : "Ship lost";
  const copy = won
    ? `You made it through the nebula with ${formatScore(score)} data.`
    : `You recovered ${formatScore(score)} data before the mines got you.`;
  showOverlay(isNewBest ? "NEW PERSONAL BEST" : result.toUpperCase(), won ? "Clean getaway." : "That got messy.", copy, "RUN IT BACK");
  announce(`${result}. Final score: ${score}.${isNewBest ? " New personal best." : ""}`);
}

function spawnObject() {
  const isShard = Math.random() < 0.34;
  const size = isShard ? 10 : 13;
  const margin = Math.max(28, size * 2);
  objects.push({
    type: isShard ? "shard" : "mine",
    x: margin + Math.random() * Math.max(1, width - margin * 2),
    y: -size * 2,
    radius: size,
    speed: height * (0.24 + Math.random() * 0.15) * (1 + elapsed * 0.018),
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 2.2,
  });
}

function update(delta) {
  if (gameState !== "playing") return;

  elapsed = Math.min(RUN_LENGTH, elapsed + delta);
  invulnerableFor = Math.max(0, invulnerableFor - delta);
  toastTimer = Math.max(0, toastTimer - delta);

  let direction = 0;
  if (keys.has("ArrowLeft") || keys.has("a")) direction -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) direction += 1;
  for (const touchDirection of touchDirections.values()) direction += touchDirection;
  playerX = Math.max(0.06, Math.min(0.94, playerX + direction * delta * 0.76));

  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    spawnObject();
    spawnTimer = Math.max(0.31, 0.82 - elapsed * 0.009);
  }

  const playerY = height - 51;
  const playerPixelX = width * playerX;
  objects = objects.filter((object) => {
    if (gameState !== "playing") return false;
    object.y += object.speed * delta;
    object.rotation += object.spin * delta;
    const dx = object.x - playerPixelX;
    const dy = object.y - playerY;
    const collides = Math.hypot(dx, dy) < object.radius + PLAYER_RADIUS;

    if (collides && object.type === "shard") {
      score += 100;
      toast.textContent = "+100";
      toast.style.left = `${playerX * 100}%`;
      toast.classList.remove("is-visible");
      void toast.offsetWidth;
      toast.classList.add("is-visible");
      toastTimer = 0.65;
      updateHud();
      return false;
    }
    if (collides && object.type === "mine" && invulnerableFor === 0) {
      lives -= 1;
      invulnerableFor = 1.1;
      updateHud();
      announce(`Hull hit. ${lives} of 3 hull points remaining.`);
      if (lives === 0) finishRun(false);
      return false;
    }
    return object.y < height + object.radius;
  });

  updateHud();
  if (elapsed >= RUN_LENGTH && gameState === "playing") finishRun(true);
}

function drawShip(x, y, time) {
  if (invulnerableFor > 0 && Math.floor(time * 13) % 2 === 0) return;
  context.save();
  context.translate(x, y);
  context.shadowBlur = 22;
  context.shadowColor = "#7fffea";
  context.fillStyle = "#9dfff0";
  context.strokeStyle = "#eaffff";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, -19);
  context.lineTo(15, 15);
  context.lineTo(0, 9);
  context.lineTo(-15, 15);
  context.closePath();
  context.fill();
  context.stroke();
  context.shadowBlur = 13;
  context.fillStyle = "#ffad67";
  context.beginPath();
  context.moveTo(-5, 14);
  context.lineTo(0, 23 + Math.sin(time * 18) * 3);
  context.lineTo(5, 14);
  context.closePath();
  context.fill();
  context.restore();
}

function drawObject(object) {
  context.save();
  context.translate(object.x, object.y);
  context.rotate(object.rotation);
  context.shadowBlur = 17;

  if (object.type === "shard") {
    context.shadowColor = "#5ef6ff";
    context.fillStyle = "#73fbff";
    context.strokeStyle = "#e1ffff";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, -object.radius);
    context.lineTo(object.radius * 0.72, 0);
    context.lineTo(0, object.radius);
    context.lineTo(-object.radius * 0.72, 0);
    context.closePath();
    context.fill();
    context.stroke();
  } else {
    context.shadowColor = "#ff8a51";
    context.fillStyle = "#ff985f";
    context.strokeStyle = "#ffd3ab";
    context.lineWidth = 1.5;
    context.beginPath();
    for (let point = 0; point < 16; point += 1) {
      const angle = (point / 16) * Math.PI * 2;
      const radius = point % 2 === 0 ? object.radius * 1.25 : object.radius * 0.84;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (point === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = "#522934";
    context.beginPath();
    context.arc(0, 0, 4, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function draw(time) {
  context.clearRect(0, 0, width, height);
  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#0c1023");
  background.addColorStop(1, "#111127");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  for (const star of stars) {
    const alpha = 0.28 + (Math.sin(time * 1.2 + star.twinkle) + 1) * 0.26;
    context.fillStyle = `rgba(198, 222, 255, ${alpha})`;
    context.fillRect(star.x, star.y, star.size, star.size);
  }

  const nebula = context.createRadialGradient(width * 0.52, height * 0.42, 3, width * 0.52, height * 0.42, height * 0.56);
  nebula.addColorStop(0, "rgba(63, 52, 120, 0.16)");
  nebula.addColorStop(1, "rgba(24, 27, 54, 0)");
  context.fillStyle = nebula;
  context.fillRect(0, 0, width, height);

  for (const object of objects) drawObject(object);
  drawShip(width * playerX, height - 51, time);
}

function frame(timestamp) {
  const delta = lastFrame === 0 ? 0 : Math.min((timestamp - lastFrame) / 1000, 0.05);
  lastFrame = timestamp;
  update(delta);
  draw(timestamp / 1000);
  if (toastTimer === 0) toast.classList.remove("is-visible");
  requestAnimationFrame(frame);
}

startButton.addEventListener("click", () => {
  if (gameState === "paused") pauseRun();
  else startRun();
});

pauseButton.addEventListener("click", pauseRun);

window.addEventListener("keydown", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (["ArrowLeft", "ArrowRight", "a", "d"].includes(key)) {
    if (gameState === "playing") event.preventDefault();
    keys.add(key);
  }
  if ((key === "p" || key === "Escape") && !event.repeat) pauseRun();
});

window.addEventListener("keyup", (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
});

window.addEventListener("blur", () => {
  keys.clear();
  touchDirections.clear();
  if (gameState === "playing") pauseRun();
});

for (const button of document.querySelectorAll("[data-move]")) {
  button.addEventListener("pointerdown", (event) => {
    if (gameState !== "playing") return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    touchDirections.set(event.pointerId, Number(button.dataset.move));
  });
  const release = (event) => touchDirections.delete(event.pointerId);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
requestAnimationFrame(frame);
