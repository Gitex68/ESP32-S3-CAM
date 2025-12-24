/**
 * Application principale - Mangeoire Connectée
 * Fonctionnalités communes à toutes les pages
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    API_BASE: '',
    REFRESH_INTERVAL: 30000,
    TOAST_DURATION: 4000,
    THEME_KEY: 'mangeoire-theme'
};

// =============================================================================
// GESTION DU THÈME
// =============================================================================

const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem(CONFIG.THEME_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme) {
            this.setTheme(savedTheme);
        } else if (prefersDark) {
            this.setTheme('dark');
        }
        
        this.bindEvents();
    },
    
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(CONFIG.THEME_KEY, theme);
        this.updateToggleIcon(theme);
    },
    
    toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    },
    
    updateToggleIcon(theme) {
        const icon = document.querySelector('.theme-icon');
        if (icon) {
            icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    },
    
    bindEvents() {
        const toggle = document.getElementById('themeToggle');
        if (toggle) {
            toggle.addEventListener('click', () => this.toggle());
        }
    }
};

// =============================================================================
// NAVIGATION MOBILE
// =============================================================================

const Navigation = {
    init() {
        const toggle = document.getElementById('navToggle');
        const menu = document.querySelector('.nav-menu');
        
        if (toggle && menu) {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                menu.classList.toggle('active');
            });
            
            menu.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    toggle.classList.remove('active');
                    menu.classList.remove('active');
                });
            });
            
            document.addEventListener('click', (e) => {
                if (!toggle.contains(e.target) && !menu.contains(e.target)) {
                    toggle.classList.remove('active');
                    menu.classList.remove('active');
                }
            });
        }
    }
};

// =============================================================================
// VÉRIFICATION DU SERVEUR
// =============================================================================

const ServerStatus = {
    async check() {
        const dot = document.getElementById('serverStatus');
        const text = document.getElementById('serverStatusText');
        
        if (!dot || !text) return;
        
        try {
            const response = await fetch('/health');
            const data = await response.json();
            
            if (data.status === 'ok') {
                dot.classList.add('online');
                dot.classList.remove('offline');
                text.textContent = 'Serveur en ligne';
            } else {
                throw new Error('Status not ok');
            }
        } catch (error) {
            dot.classList.add('offline');
            dot.classList.remove('online');
            text.textContent = 'Serveur hors ligne';
        }
    },
    
    startMonitoring() {
        this.check();
        setInterval(() => this.check(), CONFIG.REFRESH_INTERVAL);
    }
};

// =============================================================================
// STATISTIQUES ACCUEIL
// =============================================================================

const HomeStats = {
    async load() {
        const elements = {
            totalPhotos: document.getElementById('totalPhotos'),
            totalDays: document.getElementById('totalDays'),
            todayPhotos: document.getElementById('todayPhotos'),
            lastCapture: document.getElementById('lastCapture')
        };
        
        if (!elements.totalPhotos) return;
        
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            
            if (elements.totalPhotos) {
                elements.totalPhotos.textContent = stats.total_images || 0;
            }
            
            if (elements.totalDays) {
                elements.totalDays.textContent = stats.total_days || 0;
            }
            
            const today = new Date().toISOString().split('T')[0];
            const imagesResponse = await fetch('/api/images');
            const images = await imagesResponse.json();
            
            const todayImages = images[today] || [];
            if (elements.todayPhotos) {
                elements.todayPhotos.textContent = todayImages.length;
            }
            
            if (elements.lastCapture) {
                if (todayImages.length > 0) {
                    const lastTime = todayImages[0].time || '--:--';
                    elements.lastCapture.textContent = lastTime;
                } else {
                    elements.lastCapture.textContent = '--:--';
                }
            }
        } catch (error) {
            console.error('Erreur chargement stats:', error);
        }
    }
};

// =============================================================================
// SYSTÈME DE TOAST
// =============================================================================

const Toast = {
    container: null,
    
    init() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    },
    
    show(message, type = 'info') {
        if (!this.container) this.init();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">×</button>
        `;
        
        this.container.appendChild(toast);
        
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.remove(toast);
        });
        
        setTimeout(() => this.remove(toast), CONFIG.TOAST_DURATION);
    },
    
    remove(toast) {
        if (!toast || !toast.parentNode) return;
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    },
    
    success(message) { this.show(message, 'success'); },
    error(message) { this.show(message, 'error'); },
    info(message) { this.show(message, 'info'); },
    warning(message) { this.show(message, 'warning'); }
};

// =============================================================================
// UTILITAIRES
// =============================================================================

const Utils = {
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },
    
    formatDateShort(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },
    
    formatTime(timeStr) {
        if (!timeStr) return '--:--';
        return timeStr.replace(/-/g, ':');
    },
    
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    },
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    getRelativeTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return "À l'instant";
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        if (diffDays < 7) return `Il y a ${diffDays}j`;
        return Utils.formatDateShort(dateStr);
    },
    
    getDaysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString().split('T')[0];
    },
    
    isToday(dateStr) {
        const today = new Date().toISOString().split('T')[0];
        return dateStr === today;
    }
};

// =============================================================================
// API CLIENT
// =============================================================================

const API = {
    async get(endpoint) {
        try {
            const response = await fetch(CONFIG.API_BASE + endpoint);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`API GET ${endpoint}:`, error);
            throw error;
        }
    },
    
    async post(endpoint, data = {}) {
        try {
            const response = await fetch(CONFIG.API_BASE + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`API POST ${endpoint}:`, error);
            throw error;
        }
    },
    
    async delete(endpoint) {
        try {
            const response = await fetch(CONFIG.API_BASE + endpoint, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`API DELETE ${endpoint}:`, error);
            throw error;
        }
    },
    
    getImages() { return this.get('/api/images'); },
    getStats() { return this.get('/api/stats'); },
    getEvents(limit = 50) { return this.get(`/api/events?limit=${limit}`); },
    deleteImage(path) { return this.delete(`/api/delete/${path}`); },
    cleanup(days) { return this.post('/api/cleanup', { days }); }
};

// =============================================================================
// INITIALISATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    Navigation.init();
    ServerStatus.startMonitoring();
    Toast.init();
    HomeStats.load();
});

// Export pour utilisation dans d'autres fichiers
window.App = {
    CONFIG,
    ThemeManager,
    Navigation,
    ServerStatus,
    HomeStats,
    Toast,
    Utils,
    API
};
