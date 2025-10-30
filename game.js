// ==========================================
// CLIPPER vs LIGHTER - Modern 2D Platformer
// Rayman-Style mit Parallax & echten Plattformen!
// ==========================================

const CONFIG = {
    canvas: { width: 1200, height: 600 },
    player: {
        width: 80,
        height: 120,
        speed: 5,
        runSpeed: 7,
        jumpPower: 14,
        doubleJumpPower: 12,
        gravity: 0.6,
        maxFallSpeed: 18,
        acceleration: 0.8,
        friction: 0.85
    },
    camera: {
        followSpeed: 0.1,
        deadZone: 300,
        offsetY: 100
    }
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
        
        this.player = null;
        this.enemies = [];
        this.platforms = [];
        this.collectibles = [];
        this.particles = [];
        
        // Parallax layers
        this.background = {
            sky: { x: 0, speed: 0 },
            mountains: { x: 0, speed: 0.1 },
            hills: { x: 0, speed: 0.3 },
            trees: { x: 0, speed: 0.5 }
        };
        
        this.camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
        this.keys = {};
        
        // Effects
        this.shake = 0;
        this.flash = 0;
        this.time = 0;
        
        // Images
        this.images = {
            player: new Image(),
            enemy: new Image()
        };
        
        this.imagesLoaded = 0;
        this.loadImages();
        this.setupControls();
        this.updateUI();
    }
    
    loadImages() {
        const onLoad = () => {
            this.imagesLoaded++;
            if (this.imagesLoaded === 2) console.log('✅ Assets loaded!');
        };
        
        this.images.player.onload = onLoad;
        this.images.player.onerror = onLoad;
        this.images.player.src = 'player.png';
        
        this.images.enemy.onload = onLoad;
        this.images.enemy.onerror = onLoad;
        this.images.enemy.src = 'enemy.png';
    }
    
    setupControls() {
        document.getElementById('startButton').onclick = () => this.start();
        document.getElementById('restartButton').onclick = () => this.restart();
        
        window.addEventListener('keydown', e => {
            this.keys[e.key] = true;
            if ([' ', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
            
            if ((e.key === ' ' || e.key === 'ArrowUp') && this.player) {
                this.player.jump();
            }
            
            // Run modifier
            if (e.key === 'Shift') {
                this.player.isRunning = true;
            }
        });
        
        window.addEventListener('keyup', e => {
            this.keys[e.key] = false;
            if (e.key === 'Shift' && this.player) {
                this.player.isRunning = false;
            }
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
        this.lives = 3;
        this.enemies = [];
        this.platforms = [];
        this.collectibles = [];
        this.particles = [];
        this.camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
        this.player = new Player(this, 200, 100);
        this.shake = 0;
        this.flash = 0;
        this.time = 0;
        this.updateUI();
    }
    
    createLevel() {
        const platforms = [
            // Ground platforms
            { x: 0, y: 500, width: 400, height: 40 },
            { x: 500, y: 500, width: 300, height: 40 },
            { x: 900, y: 500, width: 400, height: 40 },
            { x: 1400, y: 500, width: 400, height: 40 },
            { x: 1900, y: 500, width: 500, height: 40 },
            
            // Floating platforms
            { x: 600, y: 380, width: 150, height: 20 },
            { x: 850, y: 320, width: 150, height: 20 },
            { x: 1100, y: 280, width: 150, height: 20 },
            { x: 1350, y: 350, width: 150, height: 20 },
            { x: 1600, y: 400, width: 200, height: 20 },
            { x: 1900, y: 350, width: 150, height: 20 },
            { x: 2150, y: 300, width: 150, height: 20 },
            
            // Higher platforms
            { x: 750, y: 200, width: 120, height: 20 },
            { x: 1200, y: 150, width: 120, height: 20 },
            { x: 1700, y: 180, width: 120, height: 20 },
        ];
        
        platforms.forEach(p => {
            this.platforms.push(new Platform(p.x, p.y, p.width, p.height));
        });
        
        // Spawn enemies on platforms
        this.spawnEnemy(700, 340);
        this.spawnEnemy(1150, 240);
        this.spawnEnemy(1450, 310);
        this.spawnEnemy(2000, 310);
        
        // Add collectibles
        for (let i = 0; i < 20; i++) {
            const platform = platforms[Math.floor(Math.random() * platforms.length)];
            this.collectibles.push(new Collectible(
                platform.x + Math.random() * platform.width,
                platform.y - 60
            ));
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
        // Update player
        this.player.update();
        
        // Update camera
        this.updateCamera();
        
        // Update parallax
        this.updateParallax();
        
        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update();
            
            // Collision with player
            if (this.checkCollision(this.player, enemy)) {
                if (this.player.vy > 0 && this.player.y < enemy.y - 20) {
                    // Player jumped on enemy!
                    this.killEnemy(enemy, i);
                    this.player.vy = -10;
                } else {
                    this.hitPlayer();
                }
            }
        }
        
        // Update collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const coin = this.collectibles[i];
            coin.update();
            
            if (this.checkCollision(this.player, coin)) {
                this.collectibles.splice(i, 1);
                this.score += 50;
                this.updateUI();
                
                // Coin particles
                for (let j = 0; j < 10; j++) {
                    this.particles.push(new Particle(
                        coin.x, coin.y,
                        (Math.random() - 0.5) * 5,
                        -Math.random() * 5,
                        '#FFD700'
                    ));
                }
            }
        }
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.update();
            return p.life > 0;
        });
        
        // Update effects
        if (this.shake > 0) this.shake *= 0.9;
        if (this.shake < 0.3) this.shake = 0;
        if (this.flash > 0) this.flash -= 0.05;
    }
    
    updateCamera() {
        // Follow player
        this.camera.targetX = this.player.x - CONFIG.canvas.width / 2 + this.player.width / 2;
        this.camera.targetY = this.player.y - CONFIG.canvas.height / 2 + CONFIG.camera.offsetY;
        
        // Smooth follow
        this.camera.x += (this.camera.targetX - this.camera.x) * CONFIG.camera.followSpeed;
        this.camera.y += (this.camera.targetY - this.camera.y) * CONFIG.camera.followSpeed;
        
        // Clamp camera
        this.camera.y = Math.max(0, Math.min(this.camera.y, 200));
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
        
        // Sky gradient
        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        const sky = this.ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
        sky.addColorStop(0, '#87CEEB');
        sky.addColorStop(0.4, '#B8D8F0');
        sky.addColorStop(1, '#E6F3FF');
        this.ctx.fillStyle = sky;
        this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
        this.ctx.restore();
        
        // Parallax layers
        this.drawParallaxLayer(this.background.mountains.x, '#8B9DC3', [
            { x: 0, y: 400, w: 300, h: 200 },
            { x: 250, y: 380, w: 350, h: 220 },
            { x: 550, y: 420, w: 280, h: 180 },
            { x: 800, y: 390, w: 320, h: 210 },
        ]);
        
        this.drawParallaxLayer(this.background.hills.x, '#9FCD9F', [
            { x: 0, y: 450, w: 400, h: 150 },
            { x: 350, y: 470, w: 300, h: 130 },
            { x: 600, y: 460, w: 350, h: 140 },
            { x: 900, y: 480, w: 280, h: 120 },
        ]);
        
        // Trees/Bushes layer
        this.drawTreeLayer(this.background.trees.x);
        
        // Game objects
        this.platforms.forEach(p => p.draw(this.ctx));
        this.collectibles.forEach(c => c.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.player.draw(this.ctx);
        
        this.ctx.restore();
        
        // Flash effect
        if (this.flash > 0) {
            this.ctx.fillStyle = `rgba(255, 50, 50, ${this.flash * 0.4})`;
            this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
        }
    }
    
    drawParallaxLayer(offsetX, color, shapes) {
        this.ctx.fillStyle = color;
        shapes.forEach(shape => {
            const x = shape.x + offsetX;
            const repeats = Math.ceil(CONFIG.canvas.width * 3 / 1200);
            
            for (let i = -1; i < repeats; i++) {
                this.ctx.beginPath();
                this.ctx.moveTo(x + i * 1200, shape.y + this.camera.y);
                this.ctx.quadraticCurveTo(
                    x + shape.w / 2 + i * 1200, 
                    shape.y - shape.h * 0.3 + this.camera.y,
                    x + shape.w + i * 1200, 
                    shape.y + this.camera.y
                );
                this.ctx.lineTo(x + shape.w + i * 1200, CONFIG.canvas.height + this.camera.y);
                this.ctx.lineTo(x + i * 1200, CONFIG.canvas.height + this.camera.y);
                this.ctx.fill();
            }
        });
    }
    
    drawTreeLayer(offsetX) {
        const trees = [100, 250, 450, 650, 850, 1050, 1250, 1450];
        this.ctx.fillStyle = '#6B8E3E';
        
        trees.forEach(baseX => {
            const repeats = 3;
            for (let i = 0; i < repeats; i++) {
                const x = baseX + offsetX + i * 1600;
                const y = 480 + this.camera.y;
                
                // Tree trunk
                this.ctx.fillStyle = '#5C4A3C';
                this.ctx.fillRect(x - 5, y, 10, 60);
                
                // Tree foliage
                this.ctx.fillStyle = '#6B8E3E';
                this.ctx.beginPath();
                this.ctx.arc(x, y - 10, 25, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(x - 15, y, 20, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(x + 15, y, 20, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
    }
    
    checkCollision(a, b) {
        return a.x < b.x + b.width * 0.7 &&
               a.x + a.width * 0.7 > b.x &&
               a.y < b.y + b.height * 0.7 &&
               a.y + a.height * 0.7 > b.y;
    }
    
    killEnemy(enemy, index) {
        this.enemies.splice(index, 1);
        this.score += 100;
        this.updateUI();
        
        // Explosion
        for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20;
            const speed = 2 + Math.random() * 4;
            this.particles.push(new Particle(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                '#FF6B6B'
            ));
        }
    }
    
    hitPlayer() {
        this.lives--;
        this.shake = 15;
        this.flash = 1;
        this.player.invincible = 60;
        this.updateUI();
        
        // Knockback
        this.player.vy = -12;
        this.player.vx = -this.player.facing * 8;
        
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
        document.getElementById('lives').textContent = '❤️'.repeat(Math.max(0, this.lives));
    }
}

// Platform class
class Platform {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    
    draw(ctx) {
        // Platform top (grass)
        const grassGrad = ctx.createLinearGradient(0, this.y - 5, 0, this.y);
        grassGrad.addColorStop(0, '#7CB342');
        grassGrad.addColorStop(1, '#689F38');
        ctx.fillStyle = grassGrad;
        ctx.fillRect(this.x, this.y - 5, this.width, 5);
        
        // Platform body
        const bodyGrad = ctx.createLinearGradient(0, this.y, 0, this.y + this.height);
        bodyGrad.addColorStop(0, '#8B7355');
        bodyGrad.addColorStop(1, '#6B5644');
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Platform details
        ctx.strokeStyle = '#5C4A3C';
        ctx.lineWidth = 2;
        for (let i = 0; i < this.width; i += 40) {
            ctx.strokeRect(this.x + i, this.y, 40, this.height);
        }
    }
}

// Player class will continue...

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
        this.time = 0;
        this.rotation = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.squash = 1;
    }
    
    update() {
        this.time += 0.1;
        if (this.invincible > 0) this.invincible--;
        
        // Horizontal movement
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
        
        // Apply movement
        this.x += this.vx;
        
        // Gravity
        this.vy += CONFIG.player.gravity;
        this.vy = Math.min(this.vy, CONFIG.player.maxFallSpeed);
        this.y += this.vy;
        
        // Platform collision
        this.onGround = false;
        
        this.game.platforms.forEach(platform => {
            if (this.vx > 0) {
                // Moving right
                if (this.x + this.width > platform.x &&
                    this.x + this.width < platform.x + 10 &&
                    this.y + this.height > platform.y + 5 &&
                    this.y < platform.y + platform.height) {
                    this.x = platform.x - this.width;
                    this.vx = 0;
                }
            } else if (this.vx < 0) {
                // Moving left
                if (this.x < platform.x + platform.width &&
                    this.x > platform.x + platform.width - 10 &&
                    this.y + this.height > platform.y + 5 &&
                    this.y < platform.y + platform.height) {
                    this.x = platform.x + platform.width;
                    this.vx = 0;
                }
            }
            
            // Vertical collision
            if (this.x + this.width * 0.3 < platform.x + platform.width &&
                this.x + this.width * 0.7 > platform.x) {
                
                // Landing on platform
                if (this.vy > 0 &&
                    this.y + this.height >= platform.y &&
                    this.y + this.height <= platform.y + 20) {
                    this.y = platform.y - this.height;
                    this.vy = 0;
                    this.onGround = true;
                    this.canDoubleJump = true;
                    this.hasDoubleJumped = false;
                    
                    if (this.squash < 0.9) {
                        // Landing particles
                        for (let i = 0; i < 5; i++) {
                            this.game.particles.push(new Particle(
                                this.x + this.width / 2,
                                this.y + this.height,
                                (Math.random() - 0.5) * 4,
                                -Math.random() * 3,
                                '#A0826D'
                            ));
                        }
                    }
                }
                
                // Hitting platform from below
                if (this.vy < 0 &&
                    this.y <= platform.y + platform.height &&
                    this.y > platform.y) {
                    this.y = platform.y + platform.height;
                    this.vy = 0;
                }
            }
        });
        
        // Death plane
        if (this.y > 700) {
            this.game.hitPlayer();
            this.x = 200;
            this.y = 100;
            this.vx = 0;
            this.vy = 0;
        }
        
        // Animation
        if (this.onGround) {
            if (Math.abs(this.vx) > 0.5) {
                // Running animation
                this.rotation = Math.sin(this.time * 15) * 0.05;
                this.squash = 1 + Math.sin(this.time * 15) * 0.05;
                
                // Run particles
                if (Math.random() > 0.8) {
                    this.game.particles.push(new Particle(
                        this.x + this.width / 2,
                        this.y + this.height,
                        (Math.random() - 0.5) * 2,
                        -Math.random() * 2,
                        '#D4C4B0'
                    ));
                }
            } else {
                // Idle animation
                this.rotation = 0;
                this.squash = 1 + Math.sin(this.time * 3) * 0.02;
            }
        } else {
            // In air
            this.rotation = this.vx * 0.05 * this.facing;
            this.squash = this.vy < 0 ? 1.1 : 0.9;
        }
        
        // Smooth squash
        this.scaleY += (this.squash - this.scaleY) * 0.3;
        this.scaleX = 2 - this.scaleY;
    }
    
    jump() {
        if (this.onGround) {
            // First jump
            this.vy = -CONFIG.player.jumpPower;
            this.onGround = false;
            
            // Jump particles
            for (let i = 0; i < 8; i++) {
                const angle = Math.PI * 0.4 + Math.random() * Math.PI * 0.2;
                const speed = 2 + Math.random() * 3;
                this.game.particles.push(new Particle(
                    this.x + this.width / 2,
                    this.y + this.height,
                    Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
                    -Math.sin(angle) * speed,
                    '#FFD700'
                ));
            }
        } else if (this.canDoubleJump && !this.hasDoubleJumped) {
            // Double jump!
            this.vy = -CONFIG.player.doubleJumpPower;
            this.hasDoubleJumped = true;
            
            // Double jump particles (more dramatic!)
            for (let i = 0; i < 15; i++) {
                const angle = (Math.PI * 2 * i) / 15;
                const speed = 3 + Math.random() * 2;
                this.game.particles.push(new Particle(
                    this.x + this.width / 2,
                    this.y + this.height / 2,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    '#00D4FF'
                ));
            }
        }
    }
    
    draw(ctx) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        
        // Shadow
        if (!this.invincible || this.invincible % 6 < 3) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.beginPath();
            ctx.ellipse(
                cx, 
                this.y + this.height + 5,
                this.width / 2, 
                8,
                0, 0, Math.PI * 2
            );
            ctx.fill();
        }
        
        // Character (with invincibility flicker)
        if (!this.invincible || this.invincible % 4 < 2) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(this.rotation);
            ctx.scale(this.facing * this.scaleX, this.scaleY);
            
            // Glow when in air
            if (!this.onGround) {
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 12;
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
            }
            
            ctx.restore();
        }
    }
}

class Enemy {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = CONFIG.player.width;
        this.height = CONFIG.player.height;
        this.vx = -2;
        this.vy = 0;
        this.onGround = false;
        this.time = Math.random() * 10;
        this.patrolStart = x - 100;
        this.patrolEnd = x + 100;
    }
    
    update() {
        this.time += 0.15;
        
        // Patrol movement
        this.x += this.vx;
        
        if (this.x < this.patrolStart) {
            this.x = this.patrolStart;
            this.vx = 2;
        } else if (this.x > this.patrolEnd) {
            this.x = this.patrolEnd;
            this.vx = -2;
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
                this.y + this.height <= platform.y + 20) {
                this.y = platform.y - this.height;
                this.vy = 0;
                this.onGround = true;
            }
        });
        
        // Trail particles
        if (Math.random() > 0.9) {
            this.game.particles.push(new Particle(
                this.x + this.width / 2,
                this.y + this.height / 2,
                this.vx * 0.5 + (Math.random() - 0.5),
                (Math.random() - 0.5) * 2,
                '#FF4444'
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
        ctx.ellipse(cx, this.y + this.height + 5, this.width / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Character
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(this.vx > 0 ? 1 : -1, 1 + Math.sin(this.time * 5) * 0.05);
        
        // Evil glow
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 15 + glow * 10;
        
        if (this.game.images.enemy.complete && this.game.images.enemy.naturalWidth > 0) {
            // Glow layer
            ctx.globalAlpha = 0.4 + glow * 0.3;
            ctx.drawImage(
                this.game.images.enemy,
                -this.width / 2,
                -this.height / 2,
                this.width,
                this.height
            );
            
            // Main
            ctx.globalAlpha = 1;
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
        }
        
        ctx.restore();
    }
}

class Collectible {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.time = Math.random() * 10;
        this.collected = false;
    }
    
    update() {
        this.time += 0.1;
    }
    
    draw(ctx) {
        const bob = Math.sin(this.time * 3) * 5;
        const scale = 1 + Math.sin(this.time * 4) * 0.1;
        const glow = Math.sin(this.time * 5) * 0.5 + 0.5;
        
        ctx.save();
        ctx.translate(this.x, this.y + bob);
        ctx.scale(scale, scale);
        ctx.rotate(this.time * 2);
        
        // Glow
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
        
        // Inner circle
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        
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
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.3;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.3;
        this.rotation += this.rotationSpeed;
        this.life -= 0.02;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Gradient particle
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        grad.addColorStop(0, this.color);
        grad.addColorStop(1, this.color + '00');
        
        ctx.fillStyle = grad;
        ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
        
        ctx.restore();
    }
}

// Start game
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});

