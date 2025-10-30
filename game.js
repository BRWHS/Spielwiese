// ==========================================
// CLIPPER vs LIGHTER - Pro 2D Platformer
// Mit handgezeichneten, animierten Charakteren!
// ==========================================

const CONFIG = {
    canvas: { width: 1200, height: 600 },
    player: {
        width: 50,
        height: 70,
        speed: 4.5,
        runSpeed: 7,
        jumpPower: 13,
        doubleJumpPower: 11,
        gravity: 0.55,
        maxFallSpeed: 16,
        acceleration: 0.7,
        friction: 0.88
    },
    camera: {
        followSpeed: 0.12,
        deadZone: 250
    }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.canvas.width;
        this.canvas.height = CONFIG.canvas.height;
        
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('platformerHighScore')) || 0;
        this.lives = 5;
        this.isRunning = false;
        
        this.player = null;
        this.enemies = [];
        this.platforms = [];
        this.collectibles = [];
        this.particles = [];
        
        // Parallax
        this.background = {
            mountains: { x: 0, speed: 0.15 },
            hills: { x: 0, speed: 0.35 },
            trees: { x: 0, speed: 0.6 }
        };
        
        this.camera = { x: 0, y: 0 };
        this.keys = {};
        this.shake = 0;
        this.flash = 0;
        this.time = 0;
        
        this.setupControls();
        this.updateUI();
    }
    
    setupControls() {
        document.getElementById('startButton').onclick = () => this.start();
        document.getElementById('restartButton').onclick = () => this.restart();
        
        window.addEventListener('keydown', e => {
            this.keys[e.key] = true;
            if ([' ', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
            if ((e.key === ' ' || e.key === 'ArrowUp') && this.player) this.player.jump();
            if (e.key === 'Shift' && this.player) this.player.isRunning = true;
        });
        
        window.addEventListener('keyup', e => {
            this.keys[e.key] = false;
            if (e.key === 'Shift' && this.player) this.player.isRunning = false;
        });
    }
    
    start() {
        document.getElementById('startScreen').classList.add('hidden');
        this.reset();
        this.createLevel();
        this.isRunning = true;
        this.gameLoop();
    }
    
    restart() {
        document.getElementById('gameOverScreen').classList.remove('visible');
        this.start();
    }
    
    reset() {
        this.score = 0;
        this.lives = 5;
        this.enemies = [];
        this.platforms = [];
        this.collectibles = [];
        this.particles = [];
        this.camera = { x: 0, y: 0 };
        this.player = new Player(this, 200, 100);
        this.shake = 0;
        this.flash = 0;
        this.time = 0;
        this.updateUI();
    }
    
    createLevel() {
        // Ground platforms
        for (let i = 0; i < 10; i++) {
            this.platforms.push(new Platform(i * 300, 500, 350, 40, 'ground'));
        }
        
        // Floating platforms with variety
        const floatingPlatforms = [
            { x: 400, y: 400, w: 120, h: 20 },
            { x: 600, y: 340, w: 140, h: 20 },
            { x: 850, y: 280, w: 100, h: 20 },
            { x: 1050, y: 220, w: 120, h: 20 },
            { x: 1300, y: 300, w: 160, h: 20 },
            { x: 1550, y: 380, w: 140, h: 20 },
            { x: 1800, y: 320, w: 120, h: 20 },
            { x: 2050, y: 260, w: 100, h: 20 },
            { x: 2250, y: 360, w: 140, h: 20 },
            { x: 2500, y: 420, w: 160, h: 20 },
        ];
        
        floatingPlatforms.forEach(p => {
            this.platforms.push(new Platform(p.x, p.y, p.w, p.h, 'floating'));
        });
        
        // High platforms
        this.platforms.push(new Platform(750, 180, 100, 20, 'floating'));
        this.platforms.push(new Platform(1400, 140, 100, 20, 'floating'));
        this.platforms.push(new Platform(2100, 160, 100, 20, 'floating'));
        
        // Spawn enemies
        this.spawnEnemy(650, 300);
        this.spawnEnemy(1100, 180);
        this.spawnEnemy(1600, 340);
        this.spawnEnemy(2100, 220);
        this.spawnEnemy(2550, 380);
        
        // Collectibles (coins)
        floatingPlatforms.forEach((p, i) => {
            if (i % 2 === 0) {
                this.collectibles.push(new Coin(p.x + p.w / 2, p.y - 50));
            }
        });
        
        // Extra coins on high platforms
        this.collectibles.push(new Coin(800, 130));
        this.collectibles.push(new Coin(1450, 90));
        this.collectibles.push(new Coin(2150, 110));
        
        // Trail of coins
        for (let i = 0; i < 15; i++) {
            this.collectibles.push(new Coin(500 + i * 150, 250 - Math.sin(i * 0.5) * 80));
        }
    }
    
    spawnEnemy(x, y) {
        this.enemies.push(new Enemy(this, x, y));
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        this.time += 0.016;
        this.update();
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update() {
        this.player.update();
        this.updateCamera();
        this.updateParallax();
        
        // Enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update();
            
            if (this.checkCollision(this.player, enemy)) {
                if (this.player.vy > 0 && this.player.y + this.player.height * 0.6 < enemy.y + 10) {
                    this.killEnemy(enemy, i);
                    this.player.vy = -9;
                } else if (this.player.invincible <= 0) {
                    this.hitPlayer();
                }
            }
        }
        
        // Collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const coin = this.collectibles[i];
            coin.update();
            
            if (this.checkCollision(this.player, coin)) {
                this.collectibles.splice(i, 1);
                this.score += 50;
                this.updateUI();
                
                for (let j = 0; j < 12; j++) {
                    const angle = (Math.PI * 2 * j) / 12;
                    this.particles.push(new Particle(
                        coin.x, coin.y,
                        Math.cos(angle) * 3,
                        Math.sin(angle) * 3,
                        '#FFD700', 'star'
                    ));
                }
            }
        }
        
        this.particles = this.particles.filter(p => {
            p.update();
            return p.life > 0;
        });
        
        if (this.shake > 0) this.shake *= 0.88;
        if (this.shake < 0.3) this.shake = 0;
        if (this.flash > 0) this.flash -= 0.04;
    }
    
    updateCamera() {
        const targetX = this.player.x - CONFIG.canvas.width / 2;
        const targetY = Math.max(0, this.player.y - CONFIG.canvas.height / 2 + 50);
        
        this.camera.x += (targetX - this.camera.x) * CONFIG.camera.followSpeed;
        this.camera.y += (targetY - this.camera.y) * CONFIG.camera.followSpeed;
        
        this.camera.x = Math.max(0, this.camera.x);
        this.camera.y = Math.max(0, Math.min(this.camera.y, 150));
    }
    
    updateParallax() {
        this.background.mountains.x = -this.camera.x * this.background.mountains.speed;
        this.background.hills.x = -this.camera.x * this.background.hills.speed;
        this.background.trees.x = -this.camera.x * this.background.trees.speed;
    }
    
    render() {
        const shakeX = this.shake * (Math.random() - 0.5) * 2;
        const shakeY = this.shake * (Math.random() - 0.5) * 2;
        
        this.ctx.save();
        this.ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);
        
        // Sky
        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        const sky = this.ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
        sky.addColorStop(0, '#4A90E2');
        sky.addColorStop(0.5, '#7DAFDA');
        sky.addColorStop(1, '#B8D8F0');
        this.ctx.fillStyle = sky;
        this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
        
        // Sun
        this.ctx.shadowColor = '#FFE5B4';
        this.ctx.shadowBlur = 40;
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(900, 120, 50, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        this.ctx.restore();
        
        // Parallax layers
        this.drawMountains();
        this.drawHills();
        this.drawTrees();
        
        // Game objects
        this.platforms.forEach(p => p.draw(this.ctx));
        this.collectibles.forEach(c => c.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.player.draw(this.ctx);
        
        this.ctx.restore();
        
        // Flash
        if (this.flash > 0) {
            this.ctx.fillStyle = `rgba(255, 50, 50, ${this.flash * 0.35})`;
            this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
        }
    }
    
    drawMountains() {
        this.ctx.fillStyle = '#6B88A8';
        const mountains = [
            { x: 0, y: 400, w: 250, h: 180 },
            { x: 200, y: 380, w: 300, h: 200 },
            { x: 450, y: 410, w: 220, h: 170 },
            { x: 650, y: 390, w: 280, h: 190 }
        ];
        
        mountains.forEach(m => {
            for (let i = -1; i < 5; i++) {
                const x = m.x + this.background.mountains.x + i * 900;
                this.ctx.beginPath();
                this.ctx.moveTo(x, m.y + this.camera.y);
                this.ctx.lineTo(x + m.w / 2, m.y - m.h + this.camera.y);
                this.ctx.lineTo(x + m.w, m.y + this.camera.y);
                this.ctx.lineTo(x + m.w, 600 + this.camera.y);
                this.ctx.lineTo(x, 600 + this.camera.y);
                this.ctx.fill();
            }
        });
    }
    
    drawHills() {
        this.ctx.fillStyle = '#8BA870';
        const hills = [
            { x: 0, y: 460, w: 350, h: 120 },
            { x: 300, y: 480, w: 300, h: 100 },
            { x: 550, y: 470, w: 320, h: 110 }
        ];
        
        hills.forEach(h => {
            for (let i = -1; i < 6; i++) {
                const x = h.x + this.background.hills.x + i * 900;
                this.ctx.beginPath();
                this.ctx.moveTo(x, h.y + this.camera.y);
                this.ctx.quadraticCurveTo(
                    x + h.w / 2, h.y - h.h + this.camera.y,
                    x + h.w, h.y + this.camera.y
                );
                this.ctx.lineTo(x + h.w, 600 + this.camera.y);
                this.ctx.lineTo(x, 600 + this.camera.y);
                this.ctx.fill();
            }
        });
    }
    
    drawTrees() {
        const trees = [50, 180, 350, 520, 690, 850];
        
        trees.forEach(baseX => {
            for (let i = 0; i < 5; i++) {
                const x = baseX + this.background.trees.x + i * 1000;
                const y = 490 + this.camera.y;
                
                // Trunk
                this.ctx.fillStyle = '#5C4A3C';
                this.ctx.fillRect(x - 6, y, 12, 50);
                
                // Foliage
                this.ctx.fillStyle = '#4A7C3A';
                this.ctx.beginPath();
                this.ctx.arc(x, y - 5, 22, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(x - 18, y + 5, 18, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(x + 18, y + 5, 18, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
    }
    
    checkCollision(a, b) {
        return a.x < b.x + b.width * 0.65 &&
               a.x + a.width * 0.65 > b.x &&
               a.y < b.y + b.height * 0.65 &&
               a.y + a.height * 0.65 > b.y;
    }
    
    killEnemy(enemy, index) {
        this.enemies.splice(index, 1);
        this.score += 100;
        this.updateUI();
        
        for (let i = 0; i < 25; i++) {
            const angle = (Math.PI * 2 * i) / 25;
            const speed = 2 + Math.random() * 5;
            this.particles.push(new Particle(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                ['#FF6B6B', '#FF4444', '#CC0000'][Math.floor(Math.random() * 3)],
                'square'
            ));
        }
    }
    
    hitPlayer() {
        this.lives--;
        this.shake = 18;
        this.flash = 1;
        this.player.invincible = 90;
        this.player.vy = -10;
        this.player.vx = -this.player.facing * 7;
        this.updateUI();
        
        if (this.lives <= 0) {
            this.gameOver();
        }
    }
    
    gameOver() {
        this.isRunning = false;
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('platformerHighScore', this.highScore);
        }
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverScreen').classList.add('visible');
        this.updateUI();
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('highscore').textContent = this.highScore;
        document.getElementById('lives').textContent = '❤️'.repeat(Math.max(0, this.lives));
    }
}

// Platform class continues...

class Platform {
    constructor(x, y, width, height, type = 'ground') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
    }
    
    draw(ctx) {
        if (this.type === 'ground') {
            // Ground platform with grass
            const grassGrad = ctx.createLinearGradient(0, this.y - 8, 0, this.y);
            grassGrad.addColorStop(0, '#6FA83A');
            grassGrad.addColorStop(1, '#5C8A2F');
            ctx.fillStyle = grassGrad;
            ctx.fillRect(this.x, this.y - 8, this.width, 8);
            
            // Grass blades
            ctx.strokeStyle = '#4A7C3A';
            ctx.lineWidth = 2;
            for (let i = 0; i < this.width; i += 10) {
                const h = 5 + Math.random() * 8;
                ctx.beginPath();
                ctx.moveTo(this.x + i, this.y - 8);
                ctx.lineTo(this.x + i + 2, this.y - 8 - h);
                ctx.stroke();
            }
            
            // Dirt
            const dirtGrad = ctx.createLinearGradient(0, this.y, 0, this.y + this.height);
            dirtGrad.addColorStop(0, '#8B6F47');
            dirtGrad.addColorStop(1, '#6B5537');
            ctx.fillStyle = dirtGrad;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // Dirt texture
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            for (let i = 0; i < this.width; i += 30) {
                for (let j = 0; j < this.height; j += 20) {
                    ctx.fillRect(this.x + i + Math.random() * 10, this.y + j, 15, 10);
                }
            }
        } else {
            // Floating platform
            const platformGrad = ctx.createLinearGradient(0, this.y, 0, this.y + this.height);
            platformGrad.addColorStop(0, '#A68B5B');
            platformGrad.addColorStop(0.5, '#8B7355');
            platformGrad.addColorStop(1, '#6B5B47');
            ctx.fillStyle = platformGrad;
            
            // Rounded platform
            ctx.beginPath();
            ctx.roundRect(this.x, this.y, this.width, this.height, 10);
            ctx.fill();
            
            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(this.x + 5, this.y + 3, this.width - 10, 4);
            
            // Border
            ctx.strokeStyle = '#5C4A3C';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(this.x, this.y, this.width, this.height, 10);
            ctx.stroke();
        }
    }
}

// Player with full animations!
class Player {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = CONFIG.player.width;
        this.height = CONFIG.player.height;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.canDoubleJump = false;
        this.hasDoubleJumped = false;
        this.facing = 1;
        this.isRunning = false;
        this.invincible = 0;
        
        // Animation
        this.animFrame = 0;
        this.animTimer = 0;
        this.animSpeed = 0.15;
        this.state = 'idle'; // idle, run, jump, fall
        this.rotation = 0;
        this.scaleX = 1;
        this.scaleY = 1;
    }
    
    update() {
        if (this.invincible > 0) this.invincible--;
        
        // Movement
        const speed = this.isRunning ? CONFIG.player.runSpeed : CONFIG.player.speed;
        
        if (this.game.keys['ArrowLeft']) {
            this.vx -= CONFIG.player.acceleration;
            this.vx = Math.max(this.vx, -speed);
            this.facing = -1;
        } else if (this.game.keys['ArrowRight']) {
            this.vx += CONFIG.player.acceleration;
            this.vx = Math.min(this.vx, speed);
            this.facing = 1;
        } else {
            this.vx *= CONFIG.player.friction;
            if (Math.abs(this.vx) < 0.1) this.vx = 0;
        }
        
        this.x += this.vx;
        
        // Gravity
        this.vy += CONFIG.player.gravity;
        this.vy = Math.min(this.vy, CONFIG.player.maxFallSpeed);
        this.y += this.vy;
        
        // Platform collision
        this.onGround = false;
        
        this.game.platforms.forEach(platform => {
            // Horizontal collision
            if (this.vx > 0) {
                if (this.x + this.width > platform.x &&
                    this.x + this.width < platform.x + 10 &&
                    this.y + this.height > platform.y + 5 &&
                    this.y < platform.y + platform.height) {
                    this.x = platform.x - this.width;
                    this.vx = 0;
                }
            } else if (this.vx < 0) {
                if (this.x < platform.x + platform.width &&
                    this.x > platform.x + platform.width - 10 &&
                    this.y + this.height > platform.y + 5 &&
                    this.y < platform.y + platform.height) {
                    this.x = platform.x + platform.width;
                    this.vx = 0;
                }
            }
            
            // Vertical collision
            if (this.x + this.width * 0.25 < platform.x + platform.width &&
                this.x + this.width * 0.75 > platform.x) {
                
                if (this.vy > 0 &&
                    this.y + this.height >= platform.y &&
                    this.y + this.height <= platform.y + 25) {
                    this.y = platform.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                    this.canDoubleJump = true;
                    this.hasDoubleJumped = false;
                    
                    if (this.scaleY < 0.9) {
                        for (let i = 0; i < 6; i++) {
                            this.game.particles.push(new Particle(
                                this.x + this.width / 2,
                                this.y + this.height,
                                (Math.random() - 0.5) * 4,
                                -Math.random() * 3,
                                '#B8A690', 'circle'
                            ));
                        }
                    }
                }
                
                if (this.vy < 0 &&
                    this.y <= platform.y + platform.height &&
                    this.y > platform.y) {
                    this.y = platform.y + platform.height;
                    this.vy = 0;
                }
            }
        });
        
        // Death plane
        if (this.y > 650) {
            this.game.hitPlayer();
            this.x = 200;
            this.y = 100;
            this.vx = 0;
            this.vy = 0;
        }
        
        // Animation state
        if (this.onGround) {
            if (Math.abs(this.vx) > 0.5) {
                this.state = 'run';
                this.animSpeed = this.isRunning ? 0.25 : 0.18;
            } else {
                this.state = 'idle';
                this.animSpeed = 0.08;
            }
        } else {
            this.state = this.vy < 0 ? 'jump' : 'fall';
        }
        
        // Animation timer
        this.animTimer += this.animSpeed;
        if (this.animTimer >= 1) {
            this.animTimer = 0;
            this.animFrame++;
            
            const maxFrames = {
                idle: 4,
                run: 6,
                jump: 1,
                fall: 1
            };
            
            if (this.animFrame >= maxFrames[this.state]) {
                this.animFrame = 0;
            }
        }
        
        // Squash & stretch
        if (this.onGround && Math.abs(this.vx) > 0.5) {
            const bounce = Math.sin(this.animTimer * Math.PI * 2);
            this.scaleY = 1 + bounce * 0.08;
            this.scaleX = 2 - this.scaleY;
        } else if (!this.onGround) {
            this.scaleY += (this.vy < 0 ? 1.12 : 0.88 - this.scaleY) * 0.3;
            this.scaleX = 2 - this.scaleY;
            this.rotation = this.vx * 0.04 * this.facing;
        } else {
            this.scaleY += (1 - this.scaleY) * 0.3;
            this.scaleX += (1 - this.scaleX) * 0.3;
            this.rotation = 0;
        }
        
        // Run particles
        if (this.onGround && Math.abs(this.vx) > 2 && Math.random() > 0.75) {
            this.game.particles.push(new Particle(
                this.x + this.width / 2,
                this.y + this.height,
                (Math.random() - 0.5) * 2,
                -Math.random() * 2,
                '#D4C4B0', 'circle'
            ));
        }
    }
    
    jump() {
        if (this.onGround) {
            this.vy = -CONFIG.player.jumpPower;
            this.onGround = false;
            
            for (let i = 0; i < 10; i++) {
                const angle = Math.PI * 0.4 + Math.random() * Math.PI * 0.2;
                const speed = 2 + Math.random() * 3;
                this.game.particles.push(new Particle(
                    this.x + this.width / 2,
                    this.y + this.height,
                    Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
                    -Math.sin(angle) * speed,
                    '#FFD700', 'star'
                ));
            }
        } else if (this.canDoubleJump && !this.hasDoubleJumped) {
            this.vy = -CONFIG.player.doubleJumpPower;
            this.hasDoubleJumped = true;
            
            for (let i = 0; i < 18; i++) {
                const angle = (Math.PI * 2 * i) / 18;
                const speed = 3 + Math.random() * 2;
                this.game.particles.push(new Particle(
                    this.x + this.width / 2,
                    this.y + this.height / 2,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    '#00D4FF', 'star'
                ));
            }
        }
    }
    
    draw(ctx) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        
        // Shadow
        if (!this.invincible || this.invincible % 4 < 2) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.beginPath();
            ctx.ellipse(cx, this.y + this.height + 3, this.width / 2, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Character
        if (!this.invincible || this.invincible % 6 < 3) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(this.rotation);
            ctx.scale(this.facing * this.scaleX, this.scaleY);
            
            if (!this.onGround) {
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 10;
            }
            
            this.drawCharacter(ctx);
            
            ctx.restore();
        }
    }
    
    drawCharacter(ctx) {
        const frame = this.animFrame;
        const w = this.width;
        const h = this.height;
        
        // Body
        ctx.fillStyle = '#4A90E2';
        ctx.strokeStyle = '#2C5AA0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-w * 0.3, -h * 0.15, w * 0.6, h * 0.5, 12);
        ctx.fill();
        ctx.stroke();
        
        // Head
        ctx.fillStyle = '#FFD4A3';
        ctx.strokeStyle = '#D4A574';
        ctx.beginPath();
        ctx.arc(0, -h * 0.28, w * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Eyes
        const eyeY = -h * 0.3;
        ctx.fillStyle = '#000';
        
        if (this.state === 'run') {
            const blink = frame === 2 ? 0.5 : 1;
            ctx.beginPath();
            ctx.arc(-w * 0.12, eyeY, 3 * blink, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(w * 0.12, eyeY, 3 * blink, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(-w * 0.15, eyeY - 2, 5, 4);
            ctx.fillRect(w * 0.1, eyeY - 2, 5, 4);
        }
        
        // Mouth
        if (this.state === 'jump' || this.state === 'fall') {
            ctx.beginPath();
            ctx.arc(0, -h * 0.2, w * 0.15, 0, Math.PI);
            ctx.stroke();
        }
        
        // Arms
        const armSwing = this.state === 'run' ? Math.sin(frame * Math.PI / 3) * 0.6 : 0;
        const armY = this.state === 'jump' ? -0.5 : (this.state === 'fall' ? 0.3 : 0);
        
        ctx.fillStyle = '#FFD4A3';
        ctx.strokeStyle = '#D4A574';
        
        // Left arm
        ctx.save();
        ctx.translate(-w * 0.3, -h * 0.1);
        ctx.rotate(-armSwing + armY);
        ctx.beginPath();
        ctx.roundRect(-5, 0, 10, h * 0.35, 5);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, h * 0.35, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        // Right arm
        ctx.save();
        ctx.translate(w * 0.3, -h * 0.1);
        ctx.rotate(armSwing + armY);
        ctx.beginPath();
        ctx.roundRect(-5, 0, 10, h * 0.35, 5);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, h * 0.35, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        // Legs
        const legSwing = this.state === 'run' ? Math.sin(frame * Math.PI / 3) * 0.5 : 0;
        const legY = this.state === 'jump' ? -0.4 : (this.state === 'fall' ? 0.2 : 0);
        
        ctx.fillStyle = '#2C5AA0';
        ctx.strokeStyle = '#1A3A70';
        
        // Left leg
        ctx.save();
        ctx.translate(-w * 0.15, h * 0.3);
        ctx.rotate(legSwing + legY);
        ctx.fillRect(-6, 0, 12, h * 0.3);
        ctx.strokeRect(-6, 0, 12, h * 0.3);
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-7, h * 0.28, 14, 8);
        ctx.restore();
        
        // Right leg
        ctx.save();
        ctx.translate(w * 0.15, h * 0.3);
        ctx.rotate(-legSwing + legY);
        ctx.fillRect(-6, 0, 12, h * 0.3);
        ctx.strokeRect(-6, 0, 12, h * 0.3);
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-7, h * 0.28, 14, 8);
        ctx.restore();
    }
}

// Animated Enemy
class Enemy {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = CONFIG.player.width;
        this.height = CONFIG.player.height;
        this.vx = -1.8;
        this.vy = 0;
        this.onGround = false;
        this.patrolStart = x - 80;
        this.patrolEnd = x + 80;
        
        // Animation
        this.animFrame = 0;
        this.animTimer = 0;
        this.animSpeed = 0.12;
        this.time = Math.random() * 10;
    }
    
    update() {
        this.time += 0.1;
        this.animTimer += this.animSpeed;
        if (this.animTimer >= 1) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
        }
        
        // Patrol
        this.x += this.vx;
        
        if (this.x < this.patrolStart) {
            this.x = this.patrolStart;
            this.vx = 1.8;
        } else if (this.x > this.patrolEnd) {
            this.x = this.patrolEnd;
            this.vx = -1.8;
        }
        
        // Gravity
        this.vy += 0.6;
        this.y += this.vy;
        
        // Platform collision
        this.onGround = false;
        this.game.platforms.forEach(platform => {
            if (this.x + this.width * 0.3 < platform.x + platform.width &&
                this.x + this.width * 0.7 > platform.x &&
                this.vy > 0 &&
                this.y + this.height >= platform.y &&
                this.y + this.height <= platform.y + 25) {
                this.y = platform.y - this.height;
                this.vy = 0;
                this.onGround = true;
            }
        });
        
        // Trail
        if (Math.random() > 0.88) {
            this.game.particles.push(new Particle(
                this.x + this.width / 2,
                this.y + this.height / 2,
                this.vx * 0.3 + (Math.random() - 0.5),
                (Math.random() - 0.5) * 2,
                '#FF4444', 'square'
            ));
        }
    }
    
    draw(ctx) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const glow = Math.sin(this.time * 4) * 0.5 + 0.5;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(cx, this.y + this.height + 3, this.width / 2, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(this.vx > 0 ? 1 : -1, 1);
        
        // Evil glow
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 12 + glow * 8;
        
        const w = this.width;
        const h = this.height;
        const frame = this.animFrame;
        
        // Body
        ctx.fillStyle = '#2C2C2C';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-w * 0.3, -h * 0.15, w * 0.6, h * 0.5, 12);
        ctx.fill();
        ctx.stroke();
        
        // Head
        ctx.fillStyle = '#3C3C3C';
        ctx.beginPath();
        ctx.arc(0, -h * 0.28, w * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Evil eyes (glowing!)
        const eyeGlow = 0.6 + glow * 0.4;
        ctx.shadowBlur = 15;
        ctx.fillStyle = `rgba(255, 0, 0, ${eyeGlow})`;
        ctx.beginPath();
        ctx.arc(-w * 0.12, -h * 0.3, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w * 0.12, -h * 0.3, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Evil grin
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -h * 0.2, w * 0.2, 0.2, Math.PI - 0.2);
        ctx.stroke();
        
        // Arms (menacing)
        const armSwing = Math.sin(frame * Math.PI / 2) * 0.3;
        ctx.fillStyle = '#2C2C2C';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        
        // Left arm
        ctx.save();
        ctx.translate(-w * 0.3, -h * 0.1);
        ctx.rotate(-0.3 + armSwing);
        ctx.fillRect(-5, 0, 10, h * 0.35);
        ctx.strokeRect(-5, 0, 10, h * 0.35);
        ctx.fillStyle = '#1C1C1C';
        ctx.beginPath();
        ctx.arc(0, h * 0.35, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        // Right arm (raised menacingly)
        ctx.save();
        ctx.translate(w * 0.3, -h * 0.1);
        ctx.rotate(0.8 - armSwing);
        ctx.fillRect(-5, 0, 10, h * 0.35);
        ctx.strokeRect(-5, 0, 10, h * 0.35);
        ctx.fillStyle = '#1C1C1C';
        ctx.beginPath();
        ctx.arc(0, h * 0.35, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
        // Legs (stomping)
        const legSwing = Math.sin(frame * Math.PI / 2) * 0.4;
        ctx.fillStyle = '#1C1C1C';
        
        ctx.save();
        ctx.translate(-w * 0.15, h * 0.3);
        ctx.rotate(legSwing);
        ctx.fillRect(-6, 0, 12, h * 0.3);
        ctx.strokeRect(-6, 0, 12, h * 0.3);
        ctx.restore();
        
        ctx.save();
        ctx.translate(w * 0.15, h * 0.3);
        ctx.rotate(-legSwing);
        ctx.fillRect(-6, 0, 12, h * 0.3);
        ctx.strokeRect(-6, 0, 12, h * 0.3);
        ctx.restore();
        
        ctx.restore();
    }
}

// Animated Coin
class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 25;
        this.height = 25;
        this.time = Math.random() * 10;
    }
    
    update() {
        this.time += 0.12;
    }
    
    draw(ctx) {
        const bob = Math.sin(this.time * 3) * 6;
        const spin = Math.cos(this.time * 4);
        const glow = Math.sin(this.time * 5) * 0.5 + 0.5;
        
        ctx.save();
        ctx.translate(this.x, this.y + bob);
        ctx.scale(Math.abs(spin), 1);
        ctx.rotate(this.time * 2);
        
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 15 + glow * 10;
        
        // Coin
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Inner detail
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.stroke();
        
        // Star in center
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const x = Math.cos(angle) * 4;
            const y = Math.sin(angle) * 4;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}

// Particle system
class Particle {
    constructor(x, y, vx, vy, color, type = 'circle') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.type = type;
        this.life = 1;
        this.size = 3 + Math.random() * 4;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.4;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.35;
        this.rotation += this.rotationSpeed;
        this.life -= 0.025;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        if (this.type === 'star') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
                const x = Math.cos(angle) * this.size;
                const y = Math.sin(angle) * this.size;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'square') {
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        } else {
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
            grad.addColorStop(0, this.color);
            grad.addColorStop(1, this.color + '00');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// Start game
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});

