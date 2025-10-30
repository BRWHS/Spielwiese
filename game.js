// ==========================================
// CLIPPER vs LIGHTER - Jump & Run Game
// Komplett neu programmiert für maximalen Spaß!
// ==========================================

const CONFIG = {
    canvas: { width: 1200, height: 600 },
    player: {
        width: 100,
        height: 140,
        speed: 6,
        jumpPower: 16,
        gravity: 0.7,
        maxFallSpeed: 18
    },
    enemy: {
        width: 100,
        height: 140,
        baseSpeed: 3,
        minSpawnTime: 1000,
        maxSpawnTime: 2500
    },
    ground: 480
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.canvas.width;
        this.canvas.height = CONFIG.canvas.height;
        
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
        this.lives = 3;
        this.isRunning = false;
        this.gameSpeed = 1;
        
        this.player = null;
        this.enemies = [];
        this.particles = [];
        this.clouds = [];
        
        this.keys = {};
        this.lastSpawn = 0;
        this.spawnDelay = CONFIG.enemy.maxSpawnTime;
        
        // Effects
        this.shake = 0;
        this.flash = 0;
        
        // Images
        this.images = {
            player: new Image(),
            enemy: new Image()
        };
        
        this.imagesLoaded = 0;
        this.loadImages();
        this.setupControls();
        this.createBackground();
        this.updateUI();
    }
    
    loadImages() {
        const onLoad = () => {
            this.imagesLoaded++;
            if (this.imagesLoaded === 2) {
                console.log('✅ Bilder geladen!');
            }
        };
        
        this.images.player.onload = onLoad;
        this.images.player.onerror = () => {
            console.log('⚠️ Player Bild nicht gefunden - nutze Fallback');
            onLoad();
        };
        this.images.player.src = 'player.png';
        
        this.images.enemy.onload = onLoad;
        this.images.enemy.onerror = () => {
            console.log('⚠️ Enemy Bild nicht gefunden - nutze Fallback');
            onLoad();
        };
        this.images.enemy.src = 'enemy.png';
    }
    
    setupControls() {
        document.getElementById('startButton').onclick = () => this.start();
        document.getElementById('restartButton').onclick = () => this.restart();
        
        window.addEventListener('keydown', e => {
            this.keys[e.key] = true;
            if ([' ', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
            if ((e.key === ' ' || e.key === 'ArrowUp') && this.player) {
                this.player.jump();
            }
        });
        
        window.addEventListener('keyup', e => {
            this.keys[e.key] = false;
        });
    }
    
    createBackground() {
        for (let i = 0; i < 6; i++) {
            this.clouds.push({
                x: Math.random() * CONFIG.canvas.width,
                y: Math.random() * 200 + 50,
                speed: Math.random() * 0.5 + 0.3,
                scale: Math.random() * 0.5 + 0.5
            });
        }
    }
    
    start() {
        document.getElementById('startScreen').classList.add('hidden');
        this.reset();
        this.isRunning = true;
        this.gameLoop();
    }
    
    restart() {
        document.getElementById('gameOverScreen').classList.remove('visible');
        this.start();
    }
    
    reset() {
        this.score = 0;
        this.lives = 3;
        this.gameSpeed = 1;
        this.enemies = [];
        this.particles = [];
        this.player = new Player(this, 150, CONFIG.ground - CONFIG.player.height);
        this.lastSpawn = Date.now();
        this.shake = 0;
        this.flash = 0;
        this.updateUI();
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        this.update();
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update() {
        const now = Date.now();
        
        // Spawn enemies
        if (now - this.lastSpawn > this.spawnDelay) {
            this.spawnEnemy();
            this.lastSpawn = now;
            this.spawnDelay = Math.max(
                CONFIG.enemy.minSpawnTime,
                CONFIG.enemy.maxSpawnTime - this.score * 10
            );
            this.gameSpeed = Math.min(2, 1 + this.score * 0.002);
        }
        
        // Update player
        this.player.update();
        
        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update();
            
            // Collision check
            if (this.checkCollision(this.player, enemy)) {
                this.hitPlayer(enemy);
                this.enemies.splice(i, 1);
                continue;
            }
            
            // Remove off-screen
            if (enemy.x + enemy.width < 0) {
                this.enemies.splice(i, 1);
                this.score += 10;
                this.updateUI();
            }
        }
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.update();
            return p.life > 0;
        });
        
        // Update clouds
        this.clouds.forEach(cloud => {
            cloud.x -= cloud.speed * 0.5;
            if (cloud.x + 100 < 0) {
                cloud.x = CONFIG.canvas.width + 100;
                cloud.y = Math.random() * 200 + 50;
            }
        });
        
        // Update effects
        if (this.shake > 0) this.shake *= 0.85;
        if (this.shake < 0.5) this.shake = 0;
        if (this.flash > 0) this.flash -= 0.05;
    }
    
    render() {
        const shakeX = this.shake * (Math.random() - 0.5) * 2;
        const shakeY = this.shake * (Math.random() - 0.5) * 2;
        
        this.ctx.save();
        this.ctx.translate(shakeX, shakeY);
        
        // Sky gradient
        const sky = this.ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
        sky.addColorStop(0, '#87CEEB');
        sky.addColorStop(0.6, '#B8E6F5');
        sky.addColorStop(1, '#9FD99D');
        this.ctx.fillStyle = sky;
        this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
        
        // Clouds
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.clouds.forEach(cloud => {
            this.ctx.save();
            this.ctx.translate(cloud.x, cloud.y);
            this.ctx.scale(cloud.scale, cloud.scale);
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 25, 0, Math.PI * 2);
            this.ctx.arc(30, -5, 30, 0, Math.PI * 2);
            this.ctx.arc(60, 0, 25, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
        
        // Ground
        const groundGrad = this.ctx.createLinearGradient(0, CONFIG.ground, 0, CONFIG.canvas.height);
        groundGrad.addColorStop(0, '#8B7355');
        groundGrad.addColorStop(1, '#5C4A3C');
        this.ctx.fillStyle = groundGrad;
        this.ctx.fillRect(0, CONFIG.ground, CONFIG.canvas.width, CONFIG.canvas.height - CONFIG.ground);
        
        // Ground line
        this.ctx.fillStyle = '#4A3F35';
        this.ctx.fillRect(0, CONFIG.ground - 3, CONFIG.canvas.width, 3);
        
        // Grass
        this.ctx.fillStyle = '#5A9B4A';
        for (let x = 0; x < CONFIG.canvas.width; x += 15) {
            const h = 5 + Math.random() * 10;
            this.ctx.fillRect(x, CONFIG.ground - h, 3, h);
        }
        
        // Particles
        this.particles.forEach(p => p.draw(this.ctx));
        
        // Player & enemies
        this.player.draw(this.ctx);
        this.enemies.forEach(e => e.draw(this.ctx));
        
        this.ctx.restore();
        
        // Flash effect
        if (this.flash > 0) {
            this.ctx.fillStyle = `rgba(255, 50, 50, ${this.flash * 0.4})`;
            this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
        }
    }
    
    spawnEnemy() {
        this.enemies.push(new Enemy(
            this,
            CONFIG.canvas.width + 50,
            CONFIG.ground - CONFIG.enemy.height
        ));
    }
    
    checkCollision(a, b) {
        return a.x < b.x + b.width * 0.6 &&
               a.x + a.width * 0.6 > b.x &&
               a.y < b.y + b.height * 0.6 &&
               a.y + a.height * 0.6 > b.y;
    }
    
    hitPlayer(enemy) {
        this.lives--;
        this.shake = 20;
        this.flash = 1;
        
        // Explosion
        for (let i = 0; i < 25; i++) {
            const angle = (Math.PI * 2 * i) / 25;
            const speed = 3 + Math.random() * 5;
            this.particles.push(new Particle(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                '#FF3333'
            ));
        }
        
        // Knockback
        this.player.vy = -10;
        this.player.x += (this.player.x < enemy.x) ? -40 : 40;
        
        this.updateUI();
        
        if (this.lives <= 0) {
            this.gameOver();
        }
    }
    
    gameOver() {
        this.isRunning = false;
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore);
        }
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverScreen').classList.add('visible');
        this.updateUI();
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('highscore').textContent = this.highScore;
        document.getElementById('lives').textContent = '❤️'.repeat(this.lives);
    }
}

class Player {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = CONFIG.player.width;
        this.height = CONFIG.player.height;
        this.vy = 0;
        this.onGround = false;
        
        // Animation
        this.rotation = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.bounce = 0;
        this.facing = 1;
        this.time = 0;
    }
    
    update() {
        this.time += 0.1;
        
        const prevX = this.x;
        
        // Movement
        if (this.game.keys['ArrowLeft']) {
            this.x = Math.max(0, this.x - CONFIG.player.speed);
            this.facing = -1;
        }
        if (this.game.keys['ArrowRight']) {
            this.x = Math.min(CONFIG.canvas.width - this.width, this.x + CONFIG.player.speed);
            this.facing = 1;
        }
        
        const isMoving = Math.abs(this.x - prevX) > 0.1;
        
        // Gravity
        this.vy += CONFIG.player.gravity;
        this.vy = Math.min(this.vy, CONFIG.player.maxFallSpeed);
        this.y += this.vy;
        
        // Ground collision
        if (this.y >= CONFIG.ground - this.height) {
            this.y = CONFIG.ground - this.height;
            this.vy = 0;
            this.onGround = true;
            
            // Landing
            if (this.scaleY < 0.9) {
                this.scaleY = 0.75;
                for (let i = 0; i < 5; i++) {
                    this.game.particles.push(new Particle(
                        this.x + this.width / 2,
                        this.y + this.height,
                        (Math.random() - 0.5) * 4,
                        -Math.random() * 3,
                        '#8B7355'
                    ));
                }
            }
        } else {
            this.onGround = false;
        }
        
        // Animation
        if (this.onGround && isMoving) {
            // Running bounce
            this.bounce = Math.sin(this.time * 10) * 5;
            this.rotation = Math.sin(this.time * 10) * 0.05;
            
            // Run particles
            if (Math.random() > 0.7) {
                this.game.particles.push(new Particle(
                    this.x + this.width / 2,
                    this.y + this.height,
                    (Math.random() - 0.5) * 2,
                    -Math.random() * 2,
                    '#D3D3D3'
                ));
            }
        } else if (!this.onGround) {
            // In air
            this.bounce = 0;
            this.rotation = this.vy * 0.02 * this.facing;
            this.scaleY = this.vy < 0 ? 1.15 : 0.85;
            this.scaleX = 1 / this.scaleY;
        } else {
            // Idle
            this.bounce = Math.sin(this.time * 2) * 2;
            this.rotation = 0;
        }
        
        // Smooth squash/stretch
        this.scaleY += (1 - this.scaleY) * 0.2;
        this.scaleX += (1 - this.scaleX) * 0.2;
        
        // Bounds
        this.x = Math.max(0, Math.min(CONFIG.canvas.width - this.width, this.x));
    }
    
    jump() {
        if (this.onGround) {
            this.vy = -CONFIG.player.jumpPower;
            this.onGround = false;
            
            // Jump particles
            for (let i = 0; i < 10; i++) {
                const angle = Math.PI * 0.3 + Math.random() * Math.PI * 0.4;
                const speed = 2 + Math.random() * 4;
                this.game.particles.push(new Particle(
                    this.x + this.width / 2,
                    this.y + this.height,
                    Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
                    -Math.sin(angle) * speed,
                    '#FFD700'
                ));
            }
        }
    }
    
    draw(ctx) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2 + this.bounce;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width / 2,
            CONFIG.ground + 2,
            this.width / 2 * (this.onGround ? 1 : 0.7),
            8,
            0, 0, Math.PI * 2
        );
        ctx.fill();
        
        // Character
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.rotation);
        ctx.scale(this.facing * this.scaleX, this.scaleY);
        
        if (!this.onGround) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 15;
        }
        
        if (this.game.images.player.complete && this.game.images.player.naturalWidth > 0) {
            ctx.drawImage(
                this.game.images.player,
                -this.width / 2,
                -this.height / 2,
                this.width,
                this.height
            );
        } else {
            // Fallback
            ctx.fillStyle = '#E8E8E8';
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 3;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
            ctx.fillStyle = '#333';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('CLIPPER', 0, 0);
        }
        
        ctx.restore();
    }
}

class Enemy {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = CONFIG.enemy.width;
        this.height = CONFIG.enemy.height;
        this.speed = CONFIG.enemy.baseSpeed * this.game.gameSpeed;
        
        // Animation
        this.rotation = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.bounce = 0;
        this.glow = 0;
        this.time = Math.random() * 10;
    }
    
    update() {
        this.time += 0.15;
        this.x -= this.speed;
        
        // Evil animations
        this.bounce = Math.sin(this.time * 5) * 8;
        this.rotation = Math.sin(this.time * 3) * 0.1;
        this.glow = Math.sin(this.time * 4) * 0.5 + 0.5;
        
        // Wobble
        this.scaleX = 1 + Math.sin(this.time * 8) * 0.05;
        this.scaleY = 1 + Math.cos(this.time * 8) * 0.05;
        
        // Evil trail
        if (Math.random() > 0.85) {
            this.game.particles.push(new Particle(
                this.x + this.width / 2,
                this.y + this.height / 2,
                Math.random() * 2 + 1,
                (Math.random() - 0.5) * 2,
                '#FF0000'
            ));
        }
    }
    
    draw(ctx) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2 + this.bounce;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width / 2,
            CONFIG.ground + 2,
            this.width / 2,
            8,
            0, 0, Math.PI * 2
        );
        ctx.fill();
        
        // Character
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.rotation);
        ctx.scale(-this.scaleX, this.scaleY); // Flip horizontal
        
        // Evil glow
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 20 + this.glow * 15;
        
        if (this.game.images.enemy.complete && this.game.images.enemy.naturalWidth > 0) {
            // Glow layer
            ctx.globalAlpha = 0.3 + this.glow * 0.3;
            ctx.drawImage(
                this.game.images.enemy,
                -this.width / 2,
                -this.height / 2,
                this.width,
                this.height
            );
            
            // Main
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 10;
            ctx.drawImage(
                this.game.images.enemy,
                -this.width / 2,
                -this.height / 2,
                this.width,
                this.height
            );
        } else {
            // Fallback
            ctx.fillStyle = '#4A4A4A';
            ctx.strokeStyle = '#1A1A1A';
            ctx.lineWidth = 3;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
            ctx.fillStyle = '#DDD';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('LIGHTER', 0, 0);
        }
        
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = 1;
        this.size = 2 + Math.random() * 4;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.3;
        this.life -= 0.02;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Start game
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
