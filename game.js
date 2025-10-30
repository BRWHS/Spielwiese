// Game Configuration
const CONFIG = {
    canvas: {
        width: 1200,
        height: 600
    },
    player: {
        width: 80,
        height: 120,
        speed: 5,
        jumpForce: 15,
        gravity: 0.6,
        maxFallSpeed: 20
    },
    enemy: {
        width: 80,
        height: 120,
        speed: 2,
        spawnInterval: 2000,
        minSpawnInterval: 800
    },
    platform: {
        height: 100,
        groundLevel: 500
    }
};

// Polyfill for roundRect (not available in all browsers)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
    };
}

// Game State
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
        this.lives = 3;
        this.isRunning = false;
        this.isPaused = false;
        this.gameSpeed = 1;
        
        this.player = null;
        this.enemies = [];
        this.platforms = [];
        this.particles = [];
        this.clouds = [];
        
        this.keys = {};
        this.lastEnemySpawn = 0;
        this.spawnInterval = CONFIG.enemy.spawnInterval;
        
        // Visual effects
        this.screenShake = 0;
        this.flashEffect = 0;
        
        this.imagesLoaded = false;
        this.loadImages();
        this.setupEventListeners();
        this.createClouds();
        this.updateUI();
    }

    setupCanvas() {
        this.canvas.width = CONFIG.canvas.width;
        this.canvas.height = CONFIG.canvas.height;
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    loadImages() {
        this.images = {
            player: new Image(),
            enemy: new Image()
        };

        let loadedCount = 0;
        let errorCount = 0;
        const totalImages = Object.keys(this.images).length;

        const checkAllLoaded = (success = true) => {
            loadedCount++;
            if (!success) errorCount++;
            
            if (loadedCount === totalImages) {
                this.imagesLoaded = (errorCount === 0);
                if (errorCount > 0) {
                    console.log('⚠️ Some images failed to load. Using styled fallback graphics.');
                } else {
                    console.log('✅ All images loaded successfully!');
                }
            }
        };

        // Load player image (Spielfigur.png)
        this.images.player.onload = () => checkAllLoaded(true);
        this.images.player.onerror = () => {
            console.warn('⚠️ Player image not found. Using fallback graphics.');
            checkAllLoaded(false);
        };
        // Try different possible paths
        this.images.player.src = 'Spielfigur.png';

        // Load enemy image (enemie.png)
        this.images.enemy.onload = () => checkAllLoaded(true);
        this.images.enemy.onerror = () => {
            console.warn('⚠️ Enemy image not found. Using fallback graphics.');
            checkAllLoaded(false);
        };
        this.images.enemy.src = 'enemie.png';

        // Set timeout to continue even if images don't load
        setTimeout(() => {
            if (loadedCount < totalImages) {
                console.log('⏱️ Image loading timeout. Using fallback graphics.');
                while (loadedCount < totalImages) {
                    checkAllLoaded(false);
                }
            }
        }, 3000);
    }

    setupEventListeners() {
        document.getElementById('startButton').addEventListener('click', () => this.start());
        document.getElementById('restartButton').addEventListener('click', () => this.restart());
        
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === ' ' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.isRunning && this.player) {
                    this.player.jump();
                }
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
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
        this.spawnInterval = CONFIG.enemy.spawnInterval;
        this.enemies = [];
        this.particles = [];
        this.screenShake = 0;
        this.flashEffect = 0;
        this.player = new Player(this, 150, CONFIG.platform.groundLevel - CONFIG.player.height);
        this.lastEnemySpawn = Date.now();
        this.updateUI();
    }

    gameLoop() {
        if (!this.isRunning) return;

        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        if (this.isPaused) return;

        // Update player
        this.player.update();

        // Spawn enemies
        const now = Date.now();
        if (now - this.lastEnemySpawn > this.spawnInterval) {
            this.spawnEnemy();
            this.lastEnemySpawn = now;
            
            // Increase difficulty over time
            this.spawnInterval = Math.max(
                CONFIG.enemy.minSpawnInterval,
                this.spawnInterval - 20
            );
            this.gameSpeed = Math.min(2, this.gameSpeed + 0.005);
        }

        // Update enemies
        this.enemies.forEach((enemy, index) => {
            enemy.update();
            
            // Check collision with player
            if (this.checkCollision(this.player, enemy)) {
                this.handlePlayerHit(enemy);
                this.enemies.splice(index, 1);
            }
            
            // Remove off-screen enemies
            if (enemy.x + enemy.width < 0) {
                this.enemies.splice(index, 1);
                this.score += 10;
                this.updateUI();
            }
        });

        // Update particles
        this.particles = this.particles.filter(particle => {
            particle.update();
            return particle.life > 0;
        });

        // Update clouds
        this.clouds.forEach(cloud => cloud.update());
    }

    render() {
        // Apply screen shake
        let shakeX = 0;
        let shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake;
            shakeY = (Math.random() - 0.5) * this.screenShake;
            this.screenShake *= 0.9;
            if (this.screenShake < 0.5) this.screenShake = 0;
        }
        
        this.ctx.save();
        this.ctx.translate(shakeX, shakeY);
        
        // Clear canvas with gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, CONFIG.canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.5, '#98D8E8');
        gradient.addColorStop(1, '#8FBC8F');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

        // Draw clouds
        this.clouds.forEach(cloud => cloud.draw(this.ctx));

        // Draw ground with texture
        this.drawGround();

        // Draw particles
        this.particles.forEach(particle => particle.draw(this.ctx));

        // Draw player
        this.player.draw(this.ctx);

        // Draw enemies
        this.enemies.forEach(enemy => enemy.draw(this.ctx));

        // Draw pixelated grass on ground
        this.drawGrass();
        
        this.ctx.restore();
        
        // Flash effect (not affected by shake)
        if (this.flashEffect > 0) {
            this.ctx.fillStyle = `rgba(255, 0, 0, ${this.flashEffect * 0.3})`;
            this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);
            this.flashEffect -= 0.05;
            if (this.flashEffect < 0) this.flashEffect = 0;
        }
    }

    drawGround() {
        const groundY = CONFIG.platform.groundLevel;
        
        // Main ground
        const groundGradient = this.ctx.createLinearGradient(0, groundY, 0, CONFIG.canvas.height);
        groundGradient.addColorStop(0, '#8B7355');
        groundGradient.addColorStop(0.3, '#6B5644');
        groundGradient.addColorStop(1, '#4A3F35');
        this.ctx.fillStyle = groundGradient;
        this.ctx.fillRect(0, groundY, CONFIG.canvas.width, CONFIG.canvas.height - groundY);

        // Ground line
        this.ctx.fillStyle = '#4A3F35';
        this.ctx.fillRect(0, groundY - 2, CONFIG.canvas.width, 2);
    }

    drawGrass() {
        const groundY = CONFIG.platform.groundLevel;
        const pixelSize = 8;
        
        // Draw pixelated grass pattern
        for (let x = 0; x < CONFIG.canvas.width; x += pixelSize) {
            const variation = Math.floor(Math.random() * 3);
            const colors = ['#2F6B2F', '#3A7D3A', '#256B25'];
            
            // Grass blades
            for (let i = 0; i < 3; i++) {
                const offsetX = Math.random() * pixelSize;
                const height = pixelSize + Math.random() * pixelSize;
                this.ctx.fillStyle = colors[variation];
                this.ctx.fillRect(x + offsetX, groundY - height, pixelSize / 2, height);
            }
        }
    }

    createClouds() {
        for (let i = 0; i < 5; i++) {
            this.clouds.push(new Cloud(
                Math.random() * CONFIG.canvas.width,
                Math.random() * 200 + 50,
                Math.random() * 0.3 + 0.2
            ));
        }
    }

    spawnEnemy() {
        const enemy = new Enemy(
            this,
            CONFIG.canvas.width,
            CONFIG.platform.groundLevel - CONFIG.enemy.height
        );
        this.enemies.push(enemy);
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    handlePlayerHit(enemy) {
        this.lives--;
        this.updateUI();
        
        // Screen shake
        this.screenShake = 15;
        
        // Create massive explosion particles
        this.createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
        
        // Flash effect
        this.flashEffect = 1;
        
        // Player knockback
        this.player.velocityY = -8;
        this.player.x += (this.player.x < enemy.x) ? -30 : 30;
        this.player.x = Math.max(0, Math.min(CONFIG.canvas.width - this.player.width, this.player.x));
        
        if (this.lives <= 0) {
            this.gameOver();
        }
    }

    createExplosion(x, y) {
        // Main explosion particles
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            const speed = Math.random() * 8 + 4;
            const particle = new Particle(x, y, '#FF0000');
            particle.velocityX = Math.cos(angle) * speed;
            particle.velocityY = Math.sin(angle) * speed;
            this.particles.push(particle);
        }
        
        // Secondary particles
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(x, y, '#FFD700'));
        }
    }

    gameOver() {
        this.isRunning = false;
        
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('highScore', this.highScore);
            this.updateUI();
        }
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverScreen').classList.add('visible');
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('highscore').textContent = this.highScore;
        document.getElementById('lives').textContent = this.lives;
    }
}

// Player Class with SKELETAL ANIMATION (Rigging)
class Player {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = CONFIG.player.width;
        this.height = CONFIG.player.height;
        this.velocityY = 0;
        this.isJumping = false;
        this.isOnGround = true;
        
        // Animation properties
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 0.15;
        this.bounceOffset = 0;
        this.bounceSpeed = 0.2;
        this.rotation = 0;
        this.scale = 1;
        this.squashStretch = 1;
        
        // Visual effects
        this.runParticles = [];
        this.facingRight = true;
        
        // SKELETAL ANIMATION - Body parts
        this.skeleton = {
            body: { angle: 0, targetAngle: 0 },
            head: { angle: 0, targetAngle: 0, bobOffset: 0 },
            leftArm: { angle: -0.3, targetAngle: -0.3, swing: 0 },
            rightArm: { angle: 0.3, targetAngle: 0.3, swing: 0 },
            leftLeg: { angle: 0, targetAngle: 0, kick: 0 },
            rightLeg: { angle: 0, targetAngle: 0, kick: 0 },
            leftFoot: { angle: 0 },
            rightFoot: { angle: 0 }
        };
    }

    update() {
        // Store previous position
        const prevX = this.x;
        
        // Horizontal movement
        if (this.game.keys['ArrowLeft']) {
            this.x = Math.max(0, this.x - CONFIG.player.speed);
            this.facingRight = false;
            
            // Add run particles
            if (this.isOnGround && Math.random() > 0.7) {
                this.runParticles.push(new RunParticle(
                    this.x + this.width / 2,
                    CONFIG.platform.groundLevel,
                    '#D3D3D3'
                ));
            }
        }
        if (this.game.keys['ArrowRight']) {
            this.x = Math.min(CONFIG.canvas.width - this.width, this.x + CONFIG.player.speed);
            this.facingRight = true;
            
            // Add run particles
            if (this.isOnGround && Math.random() > 0.7) {
                this.runParticles.push(new RunParticle(
                    this.x + this.width / 2,
                    CONFIG.platform.groundLevel,
                    '#D3D3D3'
                ));
            }
        }
        
        // Update SKELETAL animation based on state
        const isMoving = Math.abs(this.x - prevX) > 0.1;
        
        if (isMoving && this.isOnGround) {
            // RUNNING ANIMATION - Arms and legs move
            this.animationTimer += this.animationSpeed * 2;
            
            const walkCycle = Math.sin(this.animationTimer * Math.PI * 2);
            const walkCycleCos = Math.cos(this.animationTimer * Math.PI * 2);
            
            // Arms swing opposite to legs
            this.skeleton.leftArm.swing = walkCycle * 0.8;
            this.skeleton.rightArm.swing = -walkCycle * 0.8;
            
            // Legs kick forward and back
            this.skeleton.leftLeg.kick = walkCycleCos * 0.6;
            this.skeleton.rightLeg.kick = -walkCycleCos * 0.6;
            
            // Feet angle based on leg position
            this.skeleton.leftFoot.angle = Math.max(0, this.skeleton.leftLeg.kick * 0.5);
            this.skeleton.rightFoot.angle = Math.max(0, -this.skeleton.rightLeg.kick * 0.5);
            
            // Body bounces slightly
            this.bounceOffset = Math.abs(Math.sin(this.animationTimer * Math.PI * 2)) * 4;
            
            // Head bobs
            this.skeleton.head.bobOffset = Math.sin(this.animationTimer * Math.PI * 4) * 2;
            
        } else if (!this.isOnGround) {
            // JUMPING ANIMATION - Arms up, legs tucked
            this.skeleton.leftArm.swing = -1.2;
            this.skeleton.rightArm.swing = -1.2;
            this.skeleton.leftLeg.kick = this.velocityY > 0 ? 0.3 : -0.2;
            this.skeleton.rightLeg.kick = this.velocityY > 0 ? 0.3 : -0.2;
            this.skeleton.head.bobOffset = -3;
            
        } else {
            // IDLE ANIMATION - Breathing
            this.animationTimer += 0.02;
            this.skeleton.leftArm.swing = Math.sin(this.animationTimer) * 0.1;
            this.skeleton.rightArm.swing = Math.sin(this.animationTimer + Math.PI) * 0.1;
            this.skeleton.head.bobOffset = Math.sin(this.animationTimer * 0.5) * 1;
            this.skeleton.leftLeg.kick = 0;
            this.skeleton.rightLeg.kick = 0;
            this.bounceOffset = 0;
        }

        // Apply gravity
        this.velocityY += CONFIG.player.gravity;
        this.velocityY = Math.min(this.velocityY, CONFIG.player.maxFallSpeed);
        this.y += this.velocityY;

        // Squash and stretch effect
        if (!this.isOnGround) {
            this.squashStretch = this.velocityY < 0 ? 1.15 : 0.85;
            this.rotation = this.velocityY * 0.015;
        } else {
            this.squashStretch += (1 - this.squashStretch) * 0.3;
            this.rotation = 0;
        }

        // Ground collision
        const groundY = CONFIG.platform.groundLevel - this.height;
        if (this.y >= groundY) {
            this.y = groundY;
            this.velocityY = 0;
            this.isJumping = false;
            this.isOnGround = true;
            
            if (this.squashStretch < 0.95) {
                this.squashStretch = 0.7;
                for (let i = 0; i < 5; i++) {
                    this.game.particles.push(new Particle(
                        this.x + this.width / 2,
                        this.y + this.height,
                        '#8B7355'
                    ));
                }
            }
        } else {
            this.isOnGround = false;
        }
        
        // Update run particles
        this.runParticles = this.runParticles.filter(p => {
            p.update();
            return p.life > 0;
        });
    }

    jump() {
        if (this.isOnGround) {
            this.velocityY = -CONFIG.player.jumpForce;
            this.isJumping = true;
            this.isOnGround = false;
            
            for (let i = 0; i < 8; i++) {
                this.game.particles.push(new Particle(
                    this.x + this.width / 2,
                    this.y + this.height,
                    '#FFD700'
                ));
            }
        }
    }

    draw(ctx) {
        ctx.save();
        
        // Draw run particles
        this.runParticles.forEach(p => p.draw(ctx));
        
        const drawX = this.x;
        const drawY = this.y + this.bounceOffset;
        const centerX = drawX + this.width / 2;
        const centerY = drawY + this.height / 2;
        
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width / 2,
            CONFIG.platform.groundLevel + 5,
            this.width / 2 * (this.isOnGround ? 1 : 0.7),
            10,
            0, 0, Math.PI * 2
        );
        ctx.fill();

        // Draw with skeletal animation
        if (this.game.imagesLoaded && this.game.images.player.complete && this.game.images.player.naturalWidth > 0) {
            this.drawSkeletalAnimation(ctx, centerX, centerY);
        } else {
            ctx.translate(centerX, centerY);
            ctx.rotate(this.rotation);
            if (!this.facingRight) ctx.scale(-1, 1);
            ctx.scale(1, this.squashStretch);
            this.drawClipperFallback(ctx);
        }
        
        ctx.restore();
    }

    drawSkeletalAnimation(ctx, centerX, centerY) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.rotation);
        if (!this.facingRight) ctx.scale(-1, 1);
        ctx.scale(1, this.squashStretch);
        
        const img = this.game.images.player;
        const w = this.width;
        const h = this.height;
        
        // Body part dimensions (proportions of the lighter character)
        const bodyW = w * 0.7;
        const bodyH = h * 0.5;
        const headH = h * 0.35;
        const armW = w * 0.15;
        const armH = h * 0.3;
        const legW = w * 0.2;
        const legH = h * 0.35;
        const footW = w * 0.25;
        const footH = h * 0.12;
        
        // Draw back arm first (layer order)
        this.drawArm(ctx, img, -bodyW/2, -bodyH/2 + 10, armW, armH, 
                     this.facingRight ? this.skeleton.rightArm.swing : this.skeleton.leftArm.swing, true);
        
        // Draw back leg
        this.drawLeg(ctx, img, this.facingRight ? bodyW/4 : -bodyW/4, bodyH/2, legW, legH,
                    this.facingRight ? this.skeleton.rightLeg.kick : this.skeleton.leftLeg.kick,
                    footW, footH, true);
        
        // Draw body (main torso)
        ctx.save();
        ctx.translate(0, 0);
        ctx.drawImage(img, 
            img.width * 0.2, img.height * 0.35,  // Source crop
            img.width * 0.6, img.height * 0.4,
            -bodyW/2, -bodyH/2, bodyW, bodyH);
        ctx.restore();
        
        // Draw head (with bob)
        ctx.save();
        ctx.translate(0, -bodyH/2 - headH/2 + this.skeleton.head.bobOffset);
        
        // Add glow when jumping
        if (!this.isOnGround) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 15;
        }
        
        ctx.drawImage(img,
            img.width * 0.15, 0,  // Source crop from top of image
            img.width * 0.7, img.height * 0.35,
            -bodyW/2, -headH, bodyW, headH);
        ctx.restore();
        
        // Draw front leg
        this.drawLeg(ctx, img, this.facingRight ? -bodyW/4 : bodyW/4, bodyH/2, legW, legH,
                    this.facingRight ? this.skeleton.leftLeg.kick : this.skeleton.rightLeg.kick,
                    footW, footH, false);
        
        // Draw front arm
        this.drawArm(ctx, img, bodyW/2, -bodyH/2 + 10, armW, armH,
                    this.facingRight ? this.skeleton.leftArm.swing : this.skeleton.rightArm.swing, false);
        
        ctx.restore();
    }

    drawArm(ctx, img, x, y, w, h, angle, isBack) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        // Draw arm from bottom part of sprite
        const sourceX = isBack ? img.width * 0.1 : img.width * 0.8;
        ctx.drawImage(img,
            sourceX, img.height * 0.5,
            img.width * 0.15, img.height * 0.3,
            -w/2, 0, w, h);
        
        // Hand
        ctx.save();
        ctx.translate(0, h);
        ctx.beginPath();
        ctx.arc(0, 0, w * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = '#E8E8E8';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        
        ctx.restore();
    }

    drawLeg(ctx, img, x, y, w, h, angle, footW, footH, isBack) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        // Draw leg
        const sourceX = isBack ? img.width * 0.2 : img.width * 0.7;
        ctx.drawImage(img,
            sourceX, img.height * 0.75,
            img.width * 0.2, img.height * 0.25,
            -w/2, 0, w, h);
        
        // Foot
        ctx.save();
        ctx.translate(0, h);
        ctx.rotate(isBack ? this.skeleton.rightFoot.angle : this.skeleton.leftFoot.angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, footW/2, footH/2, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#E8E8E8';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        
        ctx.restore();
    }

    drawClipperFallback(ctx) {
        const w = this.width;
        const h = this.height;
        const wobble = Math.sin(this.animationTimer * Math.PI * 2) * 2;
        
        // Main body with gradient
        const bodyGradient = ctx.createLinearGradient(0, -h/2, 0, h/2);
        bodyGradient.addColorStop(0, '#D3D3D3');
        bodyGradient.addColorStop(0.5, '#E8E8E8');
        bodyGradient.addColorStop(1, '#A8A8A8');
        
        ctx.fillStyle = bodyGradient;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-w/2 + 10, -h/2 + 20, w - 20, h - 30, 8);
        ctx.fill();
        ctx.stroke();

        // Top cap
        ctx.fillStyle = '#A8A8A8';
        ctx.fillRect(-w/2 + 10, -h/2 + 10, w - 20, 15);
        ctx.strokeRect(-w/2 + 10, -h/2 + 10, w - 20, 15);

        // Wheel
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(-w/2 + 20, -h/2 + 15, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = '#FFF';
        ctx.fillRect(-w/2 + 15, -h/2 + 45, w - 30, 20);
        ctx.strokeRect(-w/2 + 15, -h/2 + 45, w - 30, 20);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CLIPPER', 0, -h/2 + 58);

        // Animated eyes
        const blinkPhase = Math.sin(Date.now() * 0.005);
        const eyeHeight = blinkPhase > 0.95 ? 3 : 6;
        
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.ellipse(-w/2 + 25, -h/2 + 75, 6, eyeHeight, 0, 0, Math.PI * 2);
        ctx.ellipse(-w/2 + 55, -h/2 + 75, 6, eyeHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye highlights
        if (eyeHeight > 3) {
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(-w/2 + 27, -h/2 + 73, 2, 0, Math.PI * 2);
            ctx.arc(-w/2 + 57, -h/2 + 73, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Animated smile
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const smileWidth = 15 + wobble;
        ctx.arc(0, -h/2 + 80, smileWidth, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // Animated arms
        const armAngle = this.animationFrame * 0.3;
        
        // Left arm
        ctx.fillStyle = '#333';
        ctx.save();
        ctx.translate(-w/2 + 5, -h/2 + 60);
        ctx.rotate(-0.3 + Math.sin(armAngle) * 0.3);
        ctx.ellipse(0, 0, 8, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        ctx.fillStyle = '#E8E8E8';
        ctx.beginPath();
        ctx.arc(-w/2, -h/2 + 70, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.stroke();

        // Right arm
        ctx.fillStyle = '#333';
        ctx.save();
        ctx.translate(w/2 - 5, -h/2 + 60);
        ctx.rotate(0.3 + Math.sin(armAngle + Math.PI) * 0.3);
        ctx.ellipse(0, 0, 8, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        ctx.fillStyle = '#E8E8E8';
        ctx.beginPath();
        ctx.arc(w/2, -h/2 + 70, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.stroke();

        // Legs with walk animation
        const legOffset = this.isOnGround ? Math.sin(this.animationFrame) * 5 : 0;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(-w/2 + 15 + legOffset, h/2 - 15, 15, 10);
        ctx.fillRect(w/2 - 30 - legOffset, h/2 - 15, 15, 10);

        // Feet
        ctx.fillStyle = '#E8E8E8';
        ctx.beginPath();
        ctx.ellipse(-w/2 + 22 + legOffset, h/2 - 5, 15, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(w/2 - 22 - legOffset, h/2 - 5, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// Enemy Class with SKELETAL ANIMATION
class Enemy {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = CONFIG.enemy.width;
        this.height = CONFIG.enemy.height;
        this.speed = CONFIG.enemy.speed * this.game.gameSpeed;
        
        // Animation properties
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 0.25;
        this.bounceOffset = 0;
        this.rotation = 0;
        this.scale = 1;
        
        // Visual effects
        this.trailParticles = [];
        this.glowIntensity = 0;
        
        // SKELETAL ANIMATION for evil movement
        this.skeleton = {
            body: { angle: 0, wobble: 0 },
            head: { angle: 0, tilt: 0 },
            leftArm: { angle: -0.5, menace: 0 },
            rightArm: { angle: 0.8, menace: 0 },  // Raised threatening
            leftLeg: { angle: 0, stomp: 0 },
            rightLeg: { angle: 0, stomp: 0 }
        };
    }

    update() {
        this.x -= this.speed;
        
        // Evil STOMPING animation
        this.animationTimer += this.animationSpeed;
        
        const stompCycle = Math.sin(this.animationTimer * Math.PI * 2);
        const stompCycleCos = Math.cos(this.animationTimer * Math.PI * 2);
        
        // Aggressive stomping legs
        this.skeleton.leftLeg.stomp = stompCycleCos * 0.7;
        this.skeleton.rightLeg.stomp = -stompCycleCos * 0.7;
        
        // Menacing arm movements
        this.skeleton.leftArm.menace = Math.sin(this.animationTimer * Math.PI) * 0.4;
        this.skeleton.rightArm.menace = Math.cos(this.animationTimer * Math.PI * 1.5) * 0.3;
        
        // Body wobble (threatening)
        this.skeleton.body.wobble = Math.sin(this.animationTimer * Math.PI * 2) * 0.08;
        
        // Head tilt (evil)
        this.skeleton.head.tilt = Math.sin(this.animationTimer * Math.PI) * 0.1;
        
        // Bounce effect (stomping)
        this.bounceOffset = Math.abs(Math.sin(this.animationTimer * Math.PI * 2)) * 6;
        
        // Pulsing glow
        this.glowIntensity = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
        
        // Add evil trail particles
        if (Math.random() > 0.8) {
            this.trailParticles.push(new EnemyTrailParticle(
                this.x + this.width / 2,
                this.y + this.height / 2
            ));
        }
        
        // Update trail particles
        this.trailParticles = this.trailParticles.filter(p => {
            p.update();
            return p.life > 0;
        });
    }

    draw(ctx) {
        ctx.save();
        
        // Draw trail
        this.trailParticles.forEach(p => p.draw(ctx));
        
        // Calculate draw position
        const drawX = this.x;
        const drawY = this.y + this.bounceOffset;
        const centerX = drawX + this.width / 2;
        const centerY = drawY + this.height / 2;
        
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width / 2,
            CONFIG.platform.groundLevel + 5,
            this.width / 2,
            10,
            0, 0, Math.PI * 2
        );
        ctx.fill();

        // Draw with skeletal animation
        if (this.game.imagesLoaded && this.game.images.enemy.complete && this.game.images.enemy.naturalWidth > 0) {
            this.drawSkeletalAnimation(ctx, centerX, centerY);
        } else {
            ctx.translate(centerX, centerY);
            ctx.rotate(this.skeleton.body.wobble);
            this.drawLighterFallback(ctx);
        }
        
        ctx.restore();
    }

    drawSkeletalAnimation(ctx, centerX, centerY) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.skeleton.body.wobble);
        
        const img = this.game.images.enemy;
        const w = this.width;
        const h = this.height;
        
        // Body part dimensions
        const bodyW = w * 0.7;
        const bodyH = h * 0.5;
        const headH = h * 0.35;
        const armW = w * 0.15;
        const armH = h * 0.3;
        const legW = w * 0.22;
        const legH = h * 0.35;
        const footW = w * 0.28;
        const footH = h * 0.13;
        
        // Evil red aura
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 25 + this.glowIntensity * 20;
        
        // Draw back arm (menacing)
        this.drawEvilArm(ctx, img, -bodyW/2 - 5, -bodyH/2 + 5, armW, armH,
                        -0.5 + this.skeleton.leftArm.menace, true);
        
        // Draw back leg (stomping)
        this.drawEvilLeg(ctx, img, bodyW/4, bodyH/2, legW, legH,
                        this.skeleton.rightLeg.stomp, footW, footH, true);
        
        // Draw body (main torso) with evil glow
        ctx.save();
        ctx.translate(0, 0);
        ctx.shadowBlur = 15 + this.glowIntensity * 10;
        ctx.drawImage(img,
            img.width * 0.2, img.height * 0.35,
            img.width * 0.6, img.height * 0.4,
            -bodyW/2, -bodyH/2, bodyW, bodyH);
        ctx.restore();
        
        // Draw head (with menacing tilt and GLOWING EYES)
        ctx.save();
        ctx.translate(0, -bodyH/2 - headH/2);
        ctx.rotate(this.skeleton.head.tilt);
        
        // Intense red glow for head
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 30 + this.glowIntensity * 25;
        
        ctx.drawImage(img,
            img.width * 0.15, 0,
            img.width * 0.7, img.height * 0.35,
            -bodyW/2, -headH, bodyW, headH);
            
        // Extra glow layer for the eyes
        ctx.globalAlpha = 0.3 + this.glowIntensity * 0.3;
        ctx.drawImage(img,
            img.width * 0.15, 0,
            img.width * 0.7, img.height * 0.35,
            -bodyW/2, -headH, bodyW, headH);
        ctx.globalAlpha = 1;
        
        ctx.restore();
        
        // Draw front leg (stomping)
        this.drawEvilLeg(ctx, img, -bodyW/4, bodyH/2, legW, legH,
                        this.skeleton.leftLeg.stomp, footW, footH, false);
        
        // Draw front arm (raised menacingly)
        this.drawEvilArm(ctx, img, bodyW/2 + 5, -bodyH/2 - 5, armW, armH * 1.1,
                        0.8 + this.skeleton.rightArm.menace, false);
        
        ctx.restore();
    }

    drawEvilArm(ctx, img, x, y, w, h, angle, isBack) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        // Draw arm with dark tone
        const sourceX = isBack ? img.width * 0.05 : img.width * 0.85;
        ctx.shadowColor = '#8B0000';
        ctx.shadowBlur = 10;
        ctx.drawImage(img,
            sourceX, img.height * 0.5,
            img.width * 0.15, img.height * 0.3,
            -w/2, 0, w, h);
        
        // Clenched fist (darker)
        ctx.save();
        ctx.translate(0, h);
        ctx.beginPath();
        ctx.arc(0, 0, w * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#3A3A3A';
        ctx.fill();
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
        
        ctx.restore();
    }

    drawEvilLeg(ctx, img, x, y, w, h, angle, footW, footH, isBack) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        // Draw leg with dark tone
        const sourceX = isBack ? img.width * 0.15 : img.width * 0.75;
        ctx.shadowColor = '#8B0000';
        ctx.shadowBlur = 8;
        ctx.drawImage(img,
            sourceX, img.height * 0.75,
            img.width * 0.2, img.height * 0.25,
            -w/2, 0, w, h);
        
        // Heavy foot (stomping)
        ctx.save();
        ctx.translate(0, h);
        ctx.beginPath();
        ctx.ellipse(0, 0, footW/2, footH/2, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#4A4A4A';
        ctx.fill();
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Add stomp effect when leg is down
        if (Math.abs(angle) < 0.2) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#8B0000';
            ctx.beginPath();
            ctx.arc(0, 0, footW/2 + 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
        ctx.restore();
    }

    drawLighterFallback(ctx) {
        const w = this.width;
        const h = this.height;
        
        // Evil aura
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 20 + this.glowIntensity * 15;
        
        // Main body
        const bodyGradient = ctx.createLinearGradient(0, -h/2, 0, h/2);
        bodyGradient.addColorStop(0, '#4A4A4A');
        bodyGradient.addColorStop(0.5, '#5A5A5A');
        bodyGradient.addColorStop(1, '#2A2A2A');
        
        ctx.fillStyle = bodyGradient;
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(-w/2 + 10, -h/2 + 20, w - 20, h - 30, 8);
        ctx.fill();
        ctx.stroke();

        // Top cap
        ctx.fillStyle = '#5A5A5A';
        ctx.fillRect(-w/2 + 10, -h/2 + 10, w - 20, 15);
        ctx.strokeRect(-w/2 + 10, -h/2 + 10, w - 20, 15);

        // Wheel
        ctx.fillStyle = '#3A3A3A';
        ctx.beginPath();
        ctx.arc(-w/2 + 20, -h/2 + 15, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#6A6A6A';
        ctx.fillRect(-w/2 + 15, -h/2 + 45, w - 30, 20);
        ctx.strokeRect(-w/2 + 15, -h/2 + 45, w - 30, 20);
        ctx.fillStyle = '#DDD';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LIGHTER', 0, -h/2 + 58);

        // Evil glowing eyes
        ctx.fillStyle = '#FF3333';
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 15 * this.glowIntensity;
        ctx.beginPath();
        const eyeGlow = 8 + this.glowIntensity * 3;
        ctx.arc(-w/2 + 25, -h/2 + 75, eyeGlow, 0, Math.PI * 2);
        ctx.arc(-w/2 + 55, -h/2 + 75, eyeGlow, 0, Math.PI * 2);
        ctx.fill();

        // Inner pupils
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.arc(-w/2 + 25, -h/2 + 75, 4, 0, Math.PI * 2);
        ctx.arc(-w/2 + 55, -h/2 + 75, 4, 0, Math.PI * 2);
        ctx.fill();

        // Evil grin
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.arc(0, -h/2 + 90, 18, 0, Math.PI);
        ctx.fill();

        // Teeth
        ctx.fillStyle = '#FFF';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(-w/2 + 24 + i * 8, -h/2 + 90, 6, 8);
        }

        // Animated menacing arms
        const armWave = Math.sin(this.animationTimer * Math.PI * 2) * 0.3;
        
        // Left arm (clenched fist)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1A1A1A';
        ctx.save();
        ctx.translate(-w/2 + 5, -h/2 + 60);
        ctx.rotate(-0.5 + armWave);
        ctx.ellipse(0, 0, 8, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.arc(-w/2 - 2, -h/2 + 70, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Right arm (raised, threatening)
        ctx.fillStyle = '#1A1A1A';
        ctx.save();
        ctx.translate(w/2 - 5, -h/2 + 50);
        ctx.rotate(0.5 - armWave);
        ctx.ellipse(0, 0, 8, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.arc(w/2 + 2, -h/2 + 60, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1A1A1A';
        ctx.stroke();

        // Stomping legs
        const legStomp = Math.sin(this.animationFrame) * 3;
        
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(-w/2 + 15, h/2 - 15 + legStomp, 15, 10);
        ctx.fillRect(w/2 - 30, h/2 - 15 - legStomp, 15, 10);

        // Feet
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.ellipse(-w/2 + 22, h/2 - 5, 15, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(w/2 - 22, h/2 - 5, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// Particle Class for effects
class Particle {
    constructor(x, y, color = null) {
        this.x = x;
        this.y = y;
        this.velocityX = (Math.random() - 0.5) * 8;
        this.velocityY = (Math.random() - 0.5) * 8 - 2;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.01;
        this.size = Math.random() * 6 + 2;
        this.color = color || this.randomColor();
    }

    randomColor() {
        const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9D4EDD'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.velocityY += 0.3; // gravity
        this.life -= this.decay;
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

// Run Particle for player movement
class RunParticle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.velocityX = (Math.random() - 0.5) * 2;
        this.velocityY = -Math.random() * 3 - 1;
        this.life = 1;
        this.decay = 0.05;
        this.size = Math.random() * 4 + 2;
        this.color = color;
    }

    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.velocityY += 0.2;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life * 0.5;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Enemy Trail Particle
class EnemyTrailParticle {
    constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 30;
        this.y = y + (Math.random() - 0.5) * 40;
        this.velocityX = Math.random() * 2 + 1;
        this.velocityY = (Math.random() - 0.5) * 2;
        this.life = 1;
        this.decay = 0.02;
        this.size = Math.random() * 6 + 3;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
    }

    update() {
        this.x += this.velocityX;
        this.y += this.velocityY;
        this.rotation += this.rotationSpeed;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life * 0.6;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Draw evil flame/smoke shape
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        gradient.addColorStop(0, '#FF0000');
        gradient.addColorStop(0.5, '#8B0000');
        gradient.addColorStop(1, 'rgba(139, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

// Cloud Class for background
class Cloud {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.width = Math.random() * 100 + 80;
        this.height = 40;
    }

    update() {
        this.x -= this.speed;
        if (this.x + this.width < 0) {
            this.x = CONFIG.canvas.width;
            this.y = Math.random() * 200 + 50;
        }
    }

    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        
        // Draw cloud with multiple circles
        ctx.beginPath();
        ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
        ctx.arc(this.x + 30, this.y - 10, 25, 0, Math.PI * 2);
        ctx.arc(this.x + 60, this.y, 20, 0, Math.PI * 2);
        ctx.arc(this.x + 30, this.y + 10, 20, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Initialize game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});
