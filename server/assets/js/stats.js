/**
 * Statistiques - Mangeoire Connectée
 * Graphiques et analyses avec Chart.js
 */

const Stats = {
    charts: {},
    images: {},
    
    // ==========================================================================
    // INITIALISATION
    // ==========================================================================
    
    async init() {
        await this.loadData();
        this.bindEvents();
    },
    
    bindEvents() {
        // Sélecteur période graphique quotidien
        const dailyPeriod = document.getElementById('dailyChartPeriod');
        if (dailyPeriod) {
            dailyPeriod.addEventListener('change', () => {
                this.updateDailyChart(parseInt(dailyPeriod.value));
            });
        }
        
        // Bouton nettoyage
        const cleanupBtn = document.getElementById('cleanupBtn');
        if (cleanupBtn) {
            cleanupBtn.addEventListener('click', () => this.performCleanup());
        }
    },
    
    // ==========================================================================
    // CHARGEMENT DES DONNÉES
    // ==========================================================================
    
    async loadData() {
        try {
            const [stats, images, events] = await Promise.all([
                window.App.API.getStats(),
                window.App.API.getImages(),
                window.App.API.getEvents(100)
            ]);
            
            this.images = images;
            this.updateStatsCards(stats);
            this.createCharts();
            this.updatePeakInfo();
            this.renderRecentActivity(events);
        } catch (error) {
            console.error('Erreur chargement stats:', error);
            window.App.Toast.error('Erreur de chargement des statistiques');
        }
    },
    
    // ==========================================================================
    // CARTES STATISTIQUES
    // ==========================================================================
    
    updateStatsCards(stats) {
        const elements = {
            totalPhotos: document.getElementById('statTotalPhotos'),
            totalDays: document.getElementById('statTotalDays'),
            totalSize: document.getElementById('statTotalSize'),
            avgDaily: document.getElementById('statAvgDaily')
        };
        
        if (elements.totalPhotos) {
            elements.totalPhotos.textContent = stats.total_images || 0;
        }
        
        if (elements.totalDays) {
            elements.totalDays.textContent = stats.total_days || 0;
        }
        
        if (elements.totalSize) {
            const sizeMB = stats.total_size_mb || 0;
            elements.totalSize.textContent = sizeMB >= 1000 
                ? `${(sizeMB / 1024).toFixed(1)} GB` 
                : `${sizeMB.toFixed(1)} MB`;
        }
        
        if (elements.avgDaily) {
            const avg = stats.total_days > 0 
                ? (stats.total_images / stats.total_days).toFixed(1) 
                : 0;
            elements.avgDaily.textContent = avg;
        }
    },
    
    // ==========================================================================
    // GRAPHIQUES
    // ==========================================================================
    
    createCharts() {
        this.createDailyChart(30);
        this.createHourlyChart();
        this.createWeeklyChart();
    },
    
    createDailyChart(days) {
        const ctx = document.getElementById('dailyChart');
        if (!ctx) return;
        
        // Détruire le graphique existant
        if (this.charts.daily) {
            this.charts.daily.destroy();
        }
        
        const data = this.getDailyData(days);
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        this.charts.daily = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Photos',
                    data: data.values,
                    backgroundColor: 'rgba(76, 175, 80, 0.7)',
                    borderColor: '#4CAF50',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: isDark ? '#B0B0B0' : '#636E72'
                        },
                        grid: {
                            color: isDark ? '#2D3748' : '#E0E0E0'
                        }
                    },
                    x: {
                        ticks: {
                            color: isDark ? '#B0B0B0' : '#636E72',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    },
    
    updateDailyChart(days) {
        this.createDailyChart(days);
    },
    
    getDailyData(days) {
        const labels = [];
        const values = [];
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            labels.push(date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
            values.push(this.images[dateStr]?.length || 0);
        }
        
        return { labels, values };
    },
    
    createHourlyChart() {
        const ctx = document.getElementById('hourlyChart');
        if (!ctx) return;
        
        if (this.charts.hourly) {
            this.charts.hourly.destroy();
        }
        
        const data = this.getHourlyData();
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        this.charts.hourly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Photos',
                    data: data.values,
                    borderColor: '#FF9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#FF9800'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: isDark ? '#B0B0B0' : '#636E72'
                        },
                        grid: {
                            color: isDark ? '#2D3748' : '#E0E0E0'
                        }
                    },
                    x: {
                        ticks: {
                            color: isDark ? '#B0B0B0' : '#636E72'
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    },
    
    getHourlyData() {
        const hourCounts = Array(24).fill(0);
        
        Object.values(this.images).forEach(dayImages => {
            dayImages.forEach(img => {
                if (img.time) {
                    const hour = parseInt(img.time.split(':')[0] || img.time.split('-')[0]);
                    if (hour >= 0 && hour < 24) {
                        hourCounts[hour]++;
                    }
                }
            });
        });
        
        return {
            labels: Array.from({ length: 24 }, (_, i) => `${i}h`),
            values: hourCounts
        };
    },
    
    createWeeklyChart() {
        const ctx = document.getElementById('weeklyChart');
        if (!ctx) return;
        
        if (this.charts.weekly) {
            this.charts.weekly.destroy();
        }
        
        const data = this.getWeeklyData();
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        this.charts.weekly = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: [
                        '#F44336',  // Dimanche - Rouge
                        '#FF9800',  // Lundi - Orange
                        '#FFC107',  // Mardi - Jaune/Ambre
                        '#4CAF50',  // Mercredi - Vert
                        '#2196F3',  // Jeudi - Bleu
                        '#9C27B0',  // Vendredi - Violet
                        '#795548',  // Samedi - Marron
                    ],
                    borderWidth: 2,
                    borderColor: isDark ? '#1F2940' : '#FFFFFF'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: isDark ? '#B0B0B0' : '#636E72',
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    }
                }
            }
        });
    },
    
    getWeeklyData() {
        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const dayCounts = Array(7).fill(0);
        
        Object.keys(this.images).forEach(dateStr => {
            const date = new Date(dateStr);
            const dayIndex = date.getDay();
            dayCounts[dayIndex] += this.images[dateStr].length;
        });
        
        return {
            labels: dayNames,
            values: dayCounts
        };
    },
    
    // ==========================================================================
    // INFORMATIONS PICS
    // ==========================================================================
    
    updatePeakInfo() {
        const peakDay = document.getElementById('peakDay');
        const peakHour = document.getElementById('peakHour');
        const peakCount = document.getElementById('peakCount');
        const firstCapture = document.getElementById('firstCapture');
        
        // Jour le plus actif
        let maxDay = { date: '--', count: 0 };
        Object.entries(this.images).forEach(([date, imgs]) => {
            if (imgs.length > maxDay.count) {
                maxDay = { date, count: imgs.length };
            }
        });
        
        if (peakDay) {
            peakDay.textContent = maxDay.date !== '--' 
                ? window.App.Utils.formatDateShort(maxDay.date)
                : '--';
        }
        
        if (peakCount) {
            peakCount.textContent = maxDay.count > 0 ? `${maxDay.count} photos` : '-- photos';
        }
        
        // Heure la plus active
        const hourlyData = this.getHourlyData();
        const maxHourIndex = hourlyData.values.indexOf(Math.max(...hourlyData.values));
        
        if (peakHour) {
            const maxHourValue = hourlyData.values[maxHourIndex];
            peakHour.textContent = maxHourValue > 0 ? `${maxHourIndex}h - ${maxHourIndex + 1}h` : '--';
        }
        
        // Première capture
        const dates = Object.keys(this.images).sort();
        if (firstCapture) {
            firstCapture.textContent = dates.length > 0 
                ? window.App.Utils.formatDateShort(dates[0])
                : '--';
        }
    },
    
    // ==========================================================================
    // ACTIVITÉ RÉCENTE
    // ==========================================================================
    
    renderRecentActivity(events) {
        const list = document.getElementById('activityList');
        if (!list) return;
        
        // Filtrer uniquement les uploads
        const uploads = events.filter(e => e.type === 'UPLOAD').slice(0, 10);
        
        if (uploads.length === 0) {
            list.innerHTML = `
                <div class="activity-empty">
                    <p>Aucune activité récente</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = uploads.map(event => {
            const details = event.details || {};
            const imagePath = details.path || '';
            const time = window.App.Utils.getRelativeTime(event.timestamp);
            
            return `
                <div class="activity-item">
                    <div class="activity-icon">
                        ${imagePath ? `<img src="/uploads/${imagePath}" alt="Photo">` : '📷'}
                    </div>
                    <div class="activity-details">
                        <h4>${event.message || 'Photo reçue'}</h4>
                        <p>${details.size_kb ? `${details.size_kb} KB` : ''}</p>
                    </div>
                    <div class="activity-time">${time}</div>
                </div>
            `;
        }).join('');
    },
    
    // ==========================================================================
    // NETTOYAGE
    // ==========================================================================
    
    async performCleanup() {
        const select = document.getElementById('cleanupDays');
        const days = parseInt(select?.value || 30);
        
        if (!confirm(`Êtes-vous sûr de vouloir supprimer les photos de plus de ${days} jours ?`)) {
            return;
        }
        
        try {
            const result = await window.App.API.cleanup(days);
            window.App.Toast.success(`${result.deleted_count} photo(s) supprimée(s)`);
            
            // Recharger les données
            await this.loadData();
        } catch (error) {
            console.error('Erreur nettoyage:', error);
            window.App.Toast.error('Erreur lors du nettoyage');
        }
    }
};

// =============================================================================
// INITIALISATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    Stats.init();
});

// Mettre à jour les graphiques lors du changement de thème
const originalToggle = window.App?.ThemeManager?.toggle;
if (originalToggle) {
    window.App.ThemeManager.toggle = function() {
        originalToggle.call(this);
        setTimeout(() => Stats.createCharts(), 100);
    };
}

window.Stats = Stats;
