const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const SETTINGS = {
    GRAVITY: 0.82, JUMP: -12.5, SPEED: 9.2, GROUND: 540, TICK: 1/60
};

let state = {
    active: false, cameraX: 0, attempts: 1, objects: [], levelLen: 0,
    bg: '#0066ff', accumulator: 0, lastTime: 0, levelIdx: 0
};

let player = { x: 400, y: 0, w: 38, h: 38, dy: 0, rot: 0, mode: 'CUBE', onGround: false, dead: false };
let input = { hold: false };

const levelConfigs = [
    { name: "Stereo Madness", bg: "#0066ff", diff: "EASY" },
    { name: "Back on Track", bg: "#00ccff", diff: "EASY" },
    { name: "Polargeist", bg: "#a020f0", diff: "NORMAL" },
    { name: "Dry Out", bg: "#ff8c00", diff: "NORMAL" },
    { name: "Base After Base", bg: "#4B0082", diff: "HARD" },
    { name: "Can't Let Go", bg: "#FF0000", diff: "HARD" },
    { name: "Jumper", bg: "#32CD32", diff: "HARDER" },
    { name: "Time Machine", bg: "#FF1493", diff: "HARDER" },
    { name: "Cycles", bg: "#00008B", diff: "INSANE" },
    { name: "Blast Processing", bg: "#222", diff: "INSANE" }
];

// Populate Level Selection
const list = document.getElementById('level-list');
levelConfigs.forEach((cfg, i) => {
    list.innerHTML += `<div class="lvl-card" onclick="startLevel(${i})"><b>${cfg.name}</b><br><small>${cfg.diff}</small></div>`;
});

window.onkeydown = (e) => { 
    if(e.code === 'Space' || e.code === 'ArrowUp') input.hold = true; 
    if(e.code === 'Escape') returnToMenu();
};
window.onkeyup = (e) => { if(e.code === 'Space' || e.code === 'ArrowUp') input.hold = false; };
canvas.onmousedown = () => input.hold = true;
canvas.onmouseup = () => input.hold = false;

function returnToMenu() {
    state.active = false;
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
}

function createLevel(idx) {
    state.objects = [];
    let x = 1200;
    const add = (t, ox, oy, ow=40, oh=40, m=null) => state.objects.push({t, x:ox, y:oy, w:ow, h:oh, m});
    
    state.bg = levelConfigs[idx].bg;

    if(idx === 0) { // Authentic Stereo Madness Start
        for(let i=0; i<3; i++) { add('spike', x + (i*400), SETTINGS.GROUND-40); }
        add('block', x+1400, SETTINGS.GROUND-40, 120, 40);
        add('block', x+1800, SETTINGS.GROUND-80, 120, 40);
        add('portal', x+2500, 0, 120, SETTINGS.GROUND, 'SHIP'); // Unmissable Portal
        x = x + 3000;
    }

    // Fill rest of level procedurally but densely
    while (x < 40000) {
        if(player.mode === 'WAVE') {
            let gap = 180 + Math.sin(x/400)*80;
            add('block', x, 0, 80, gap);
            add('block', x, gap+180, 80, 400);
            x += 80;
        } else {
            add('block', x, SETTINGS.GROUND-40, 40, 40);
            if(Math.random() > 0.4) add('spike', x+120, SETTINGS.GROUND-40);
            if(x % 5000 === 0) add('portal', x, 0, 120, SETTINGS.GROUND, 'WAVE');
            x += 300;
        }
    }
    state.levelLen = x + 2000;
}

function startLevel(idx) {
    state.levelIdx = idx;
    state.active = true;
    state.attempts = 1;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    createLevel(idx);
    resetPlayer(true);
    state.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function resetPlayer(full) {
    player.y = SETTINGS.GROUND - player.h; player.dy = 0; player.rot = 0;
    player.mode = (state.levelIdx === 9) ? 'WAVE' : 'CUBE'; // Start Wave in Blast Processing
    player.dead = false; state.cameraX = 0;
    if(!full) state.attempts++;
    const att = document.getElementById('attempt-text');
    att.innerText = "ATTEMPT " + state.attempts; att.style.opacity = 1;
    setTimeout(() => att.style.opacity = 0, 1500);
}

function updatePhysics() {
    if(!state.active || player.dead) return;
    state.cameraX += SETTINGS.SPEED;
    
    if(player.mode === 'CUBE') {
        player.dy += SETTINGS.GRAVITY;
        if(player.onGround && input.hold) { player.dy = SETTINGS.JUMP; player.onGround = false; }
        if(!player.onGround) player.rot += 6; else player.rot = Math.round(player.rot/90)*90;
    } else if(player.mode === 'SHIP') {
        player.dy += input.hold ? -0.48 : 0.42; player.rot = player.dy * 2.5;
    } else if(player.mode === 'WAVE') {
        player.dy = input.hold ? -9.5 : 9.5; player.rot = (player.dy > 0) ? 25 : -25;
    }

    player.y += player.dy;

    if(player.y + player.h >= SETTINGS.GROUND) {
        player.y = SETTINGS.GROUND - player.h; player.dy = 0; player.onGround = true;
    } else if(player.y <= 0) {
        player.y = 0; player.dy = 0; if(player.mode !== 'BALL') crash();
    } else { player.onGround = false; }

    const pR = { l: state.cameraX + player.x + 8, r: state.cameraX + player.x + player.w - 8, t: player.y + 8, b: player.y + player.h - 8 };

    for(let o of state.objects) {
        if(o.x > pR.r + 200) break;
        if(pR.r > o.x && pR.l < o.x+o.w && pR.b > o.y && pR.t < o.y+o.h) {
            if(o.t === 'spike') crash();
            if(o.t === 'block') {
                if(player.y - player.dy + player.h <= o.y + 12) {
                    player.y = o.y - player.h; player.dy = 0; player.onGround = true;
                } else crash();
            }
            if(o.t === 'portal') { player.mode = o.m; player.dy = 0; }
        }
    }
}

function crash() {
    player.dead = true;
    document.getElementById('flash').style.opacity = 0.8;
    setTimeout(() => { document.getElementById('flash').style.opacity = 0; resetPlayer(false); }, 450);
}

function draw() {
    ctx.fillStyle = state.bg; ctx.fillRect(0,0,1280,640);
    ctx.fillStyle = "#000"; ctx.fillRect(0, SETTINGS.GROUND, 1280, 100);
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.strokeRect(-1, SETTINGS.GROUND, 1282, 1);

    ctx.save(); ctx.translate(-state.cameraX, 0);
    for(let o of state.objects) {
        if(o.x < state.cameraX - 100 || o.x > state.cameraX + 1300) continue;
        if(o.t === 'block') { ctx.fillStyle = "#000"; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.strokeStyle = "#fff"; ctx.strokeRect(o.x, o.y, o.w, o.h); }
        else if(o.t === 'spike') { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(o.x, o.y+o.h); ctx.lineTo(o.x+o.w/2, o.y); ctx.lineTo(o.x+o.w, o.y+o.h); ctx.fill(); }
        else if(o.t === 'portal') { ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(o.x, 0, o.w, SETTINGS.GROUND); }
    }
    if(!player.dead) {
        ctx.save(); ctx.translate(state.cameraX + player.x + 19, player.y + 19); ctx.rotate(player.rot * Math.PI / 180);
        ctx.fillStyle = "#0ff"; ctx.fillRect(-19,-19,38,38); ctx.strokeStyle="#fff"; ctx.lineWidth=3; ctx.strokeRect(-19,-19,38,38);
        ctx.restore();
    }
    ctx.restore();
    let pct = Math.floor((state.cameraX / state.levelLen) * 100);
    document.getElementById('progress-fill').style.width = pct + "%";
    document.getElementById('percent-text').innerText = pct + "%";
}

function gameLoop(time) {
    if(!state.active) return;
    state.accumulator += (time - state.lastTime) / 1000;
    state.lastTime = time;
    while(state.accumulator >= SETTINGS.TICK) { updatePhysics(); state.accumulator -= SETTINGS.TICK; }
    draw(); requestAnimationFrame(gameLoop);
}
