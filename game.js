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
        
        // Create explosion particles
        this.createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
        
        if (this.lives <= 0) {
            this.gameOver();
        }
    }

    createExplosion(x, y) {
        for (let i = 0; i < 20; i++) {
            this.particles.push(new Particle(x, y));
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

// Player Class
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
    }

    update() {
        // Horizontal movement
        if (this.game.keys['ArrowLeft']) {
            this.x = Math.max(0, this.x - CONFIG.player.speed);
        }
        if (this.game.keys['ArrowRight']) {
            this.x = Math.min(CONFIG.canvas.width - this.width, this.x + CONFIG.player.speed);
        }

        // Apply gravity
        this.velocityY += CONFIG.player.gravity;
        this.velocityY = Math.min(this.velocityY, CONFIG.player.maxFallSpeed);
        this.y += this.velocityY;

        // Ground collision
        const groundY = CONFIG.platform.groundLevel - this.height;
        if (this.y >= groundY) {
            this.y = groundY;
            this.velocityY = 0;
            this.isJumping = false;
            this.isOnGround = true;
        } else {
            this.isOnGround = false;
        }
    }

    jump() {
        if (this.isOnGround) {
            this.velocityY = -CONFIG.player.jumpForce;
            this.isJumping = true;
            this.isOnGround = false;
        }
    }

    draw(ctx) {
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width / 2,
            CONFIG.platform.groundLevel + 5,
            this.width / 2,
            10,
            0, 0, Math.PI * 2
        );
        ctx.fill();

        if (this.game.imagesLoaded && this.game.images.player.complete && this.game.images.player.naturalWidth > 0) {
            // Draw player image with smooth rendering
            ctx.drawImage(
                this.game.images.player,
                this.x,
                this.y,
                this.width,
                this.height
            );
        } else {
            // Draw stylized Clipper character
            this.drawClipperFallback(ctx);
        }
    }

    drawClipperFallback(ctx) {
        // Main body (lighter case)
        const bodyGradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        bodyGradient.addColorStop(0, '#D3D3D3');
        bodyGradient.addColorStop(0.3, '#E8E8E8');
        bodyGradient.addColorStop(0.7, '#C0C0C0');
        bodyGradient.addColorStop(1, '#A8A8A8');
        
        ctx.fillStyle = bodyGradient;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(this.x + 10, this.y + 20, this.width - 20, this.height - 30, 8);
        ctx.fill();
        ctx.stroke();

        // Top (metal cap)
        ctx.fillStyle = '#A8A8A8';
        ctx.fillRect(this.x + 10, this.y + 10, this.width - 20, 15);
        ctx.strokeRect(this.x + 10, this.y + 10, this.width - 20, 15);

        // Wheel mechanism
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(this.x + 20, this.y + 15, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Brand label
        ctx.fillStyle = '#FFF';
        ctx.fillRect(this.x + 15, this.y + 45, this.width - 30, 20);
        ctx.strokeRect(this.x + 15, this.y + 45, this.width - 30, 20);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CLIPPER', this.x + this.width / 2, this.y + 58);

        // Face
        // Eyes
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(this.x + 25, this.y + 75, 6, 0, Math.PI * 2);
        ctx.arc(this.x + 55, this.y + 75, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(this.x + 27, this.y + 73, 2, 0, Math.PI * 2);
        ctx.arc(this.x + 57, this.y + 73, 2, 0, Math.PI * 2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + 80, 15, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // Arms
        ctx.fillStyle = '#333';
        // Left arm
        ctx.beginPath();
        ctx.ellipse(this.x + 5, this.y + 60, 8, 15, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E8E8E8';
        ctx.beginPath();
        ctx.arc(this.x, this.y + 70, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.stroke();

        // Right arm
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width - 5, this.y + 60, 8, 15, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E8E8E8';
        ctx.beginPath();
        ctx.arc(this.x + this.width, this.y + 70, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.stroke();

        // Legs
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x + 15, this.y + this.height - 15, 15, 10);
        ctx.fillRect(this.x + this.width - 30, this.y + this.height - 15, 15, 10);

        // Feet
        ctx.fillStyle = '#E8E8E8';
        ctx.beginPath();
        ctx.ellipse(this.x + 22, this.y + this.height - 5, 15, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(this.x + this.width - 22, this.y + this.height - 5, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// Enemy Class
class Enemy {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.width = CONFIG.enemy.width;
        this.height = CONFIG.enemy.height;
        this.speed = CONFIG.enemy.speed * this.game.gameSpeed;
    }

    update() {
        this.x -= this.speed;
    }

    draw(ctx) {
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(
            this.x + this.width / 2,
            CONFIG.platform.groundLevel + 5,
            this.width / 2,
            10,
            0, 0, Math.PI * 2
        );
        ctx.fill();

        if (this.game.imagesLoaded && this.game.images.enemy.complete && this.game.images.enemy.naturalWidth > 0) {
            // Draw enemy image with smooth rendering
            ctx.drawImage(
                this.game.images.enemy,
                this.x,
                this.y,
                this.width,
                this.height
            );
        } else {
            // Draw stylized evil Lighter character
            this.drawLighterFallback(ctx);
        }
    }

    drawLighterFallback(ctx) {
        // Main body (darker lighter)
        const bodyGradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        bodyGradient.addColorStop(0, '#4A4A4A');
        bodyGradient.addColorStop(0.3, '#5A5A5A');
        bodyGradient.addColorStop(0.7, '#3A3A3A');
        bodyGradient.addColorStop(1, '#2A2A2A');
        
        ctx.fillStyle = bodyGradient;
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(this.x + 10, this.y + 20, this.width - 20, this.height - 30, 8);
        ctx.fill();
        ctx.stroke();

        // Top (metal cap)
        ctx.fillStyle = '#5A5A5A';
        ctx.fillRect(this.x + 10, this.y + 10, this.width - 20, 15);
        ctx.strokeRect(this.x + 10, this.y + 10, this.width - 20, 15);

        // Wheel mechanism
        ctx.fillStyle = '#3A3A3A';
        ctx.beginPath();
        ctx.arc(this.x + 20, this.y + 15, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Brand label
        ctx.fillStyle = '#6A6A6A';
        ctx.fillRect(this.x + 15, this.y + 45, this.width - 30, 20);
        ctx.strokeRect(this.x + 15, this.y + 45, this.width - 30, 20);
        ctx.fillStyle = '#DDD';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('LIGHTER', this.x + this.width / 2, this.y + 58);

        // Evil Face
        // Angry eyes (red glow)
        ctx.fillStyle = '#FF3333';
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x + 25, this.y + 75, 8, 0, Math.PI * 2);
        ctx.arc(this.x + 55, this.y + 75, 8, 0, Math.PI * 2);
        ctx.fill();

        // Inner pupils
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.arc(this.x + 25, this.y + 75, 4, 0, Math.PI * 2);
        ctx.arc(this.x + 55, this.y + 75, 4, 0, Math.PI * 2);
        ctx.fill();

        // Evil grin (showing teeth)
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + 90, 18, 0, Math.PI);
        ctx.fill();

        // Teeth
        ctx.fillStyle = '#FFF';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(this.x + 24 + i * 8, this.y + 90, 6, 8);
        }

        // Arms (clenched fists)
        ctx.fillStyle = '#1A1A1A';
        // Left arm
        ctx.beginPath();
        ctx.ellipse(this.x + 5, this.y + 60, 8, 15, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.arc(this.x - 2, this.y + 70, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Right arm (raised, threatening)
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width - 5, this.y + 50, 8, 15, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.arc(this.x + this.width + 2, this.y + 60, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1A1A1A';
        ctx.stroke();

        // Legs
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(this.x + 15, this.y + this.height - 15, 15, 10);
        ctx.fillRect(this.x + this.width - 30, this.y + this.height - 15, 15, 10);

        // Feet
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.ellipse(this.x + 22, this.y + this.height - 5, 15, 8, 0, 0, Math.PI * 2);
        ctx.ellipse(this.x + this.width - 22, this.y + this.height - 5, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// Particle Class for effects
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.velocityX = (Math.random() - 0.5) * 8;
        this.velocityY = (Math.random() - 0.5) * 8 - 2;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.01;
        this.size = Math.random() * 6 + 2;
        this.color = this.randomColor();
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
