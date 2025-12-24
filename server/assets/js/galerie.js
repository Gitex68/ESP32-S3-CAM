/**
 * Galerie Photos - Mangeoire Connectée
 * Gestion de l'affichage, filtrage, lightbox et suppression multiple
 */

const Gallery = {
    images: {},
    filteredImages: [],
    currentFilter: 'all',
    currentSort: 'newest',
    currentDate: null,
    currentIndex: 0,
    
    // Mode sélection multiple
    selectionMode: false,
    selectedImages: new Set(),
    
    // Image en cours de suppression (lightbox)
    pendingDeletePath: null,
    
    // ==========================================================================
    // INITIALISATION
    // ==========================================================================
    
    async init() {
        this.bindEvents();
        await this.loadImages();
        this.startAutoRefresh();
    },
    
    bindEvents() {
        // Filtres période
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.currentDate = null;
                document.getElementById('dateFilter').value = '';
                this.applyFilters();
            });
        });
        
        // Filtre date
        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                if (e.target.value) {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    this.currentDate = e.target.value;
                    this.currentFilter = 'custom';
                    this.applyFilters();
                }
            });
        }
        
        // Tri
        const sortOrder = document.getElementById('sortOrder');
        if (sortOrder) {
            sortOrder.addEventListener('change', (e) => {
                this.currentSort = e.target.value;
                this.applyFilters();
            });
        }
        
        // Bouton actualiser
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadImages());
        }
        
        // Bouton mode sélection
        const selectModeBtn = document.getElementById('selectModeBtn');
        if (selectModeBtn) {
            selectModeBtn.addEventListener('click', () => this.toggleSelectionMode());
        }
        
        // Bouton supprimer sélection
        const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', () => this.showDeleteMultipleModal());
        }
        
        // Bouton annuler sélection
        const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');
        if (cancelSelectionBtn) {
            cancelSelectionBtn.addEventListener('click', () => this.toggleSelectionMode());
        }
        
        // Bouton tout sélectionner
        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAll());
        }
        
        // Lightbox
        this.bindLightboxEvents();
        
        // Modal suppression
        this.bindDeleteModalEvents();
    },
    
    bindLightboxEvents() {
        const lightbox = document.getElementById('lightbox');
        const closeBtn = document.getElementById('lightboxClose');
        const prevBtn = document.getElementById('lightboxPrev');
        const nextBtn = document.getElementById('lightboxNext');
        const deleteBtn = document.getElementById('lightboxDelete');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeLightbox());
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigateLightbox(-1));
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigateLightbox(1));
        }
        
        if (deleteBtn) {
            // Suppression directe sans confirmation
            deleteBtn.addEventListener('click', () => this.deleteFromLightbox());
        }
        
        if (lightbox) {
            lightbox.addEventListener('click', (e) => {
                if (e.target === lightbox) this.closeLightbox();
            });
        }
        
        // Raccourcis clavier
        document.addEventListener('keydown', (e) => {
            if (!lightbox?.classList.contains('active')) return;
            
            switch(e.key) {
                case 'Escape': this.closeLightbox(); break;
                case 'ArrowLeft': this.navigateLightbox(-1); break;
                case 'ArrowRight': this.navigateLightbox(1); break;
                case 'Delete': this.deleteFromLightbox(); break;
            }
        });
    },
    
    bindDeleteModalEvents() {
        const modal = document.getElementById('deleteModal');
        const cancelBtn = document.getElementById('cancelDelete');
        const confirmBtn = document.getElementById('confirmDelete');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeDeleteModal());
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmDelete());
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeDeleteModal();
            });
        }
        
        // Échap pour fermer le modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal?.classList.contains('active')) {
                this.closeDeleteModal();
            }
        });
    },
    
    // ==========================================================================
    // CHARGEMENT DES IMAGES
    // ==========================================================================
    
    async loadImages() {
        this.showLoading(true);
        
        try {
            this.images = await window.App.API.getImages();
            this.applyFilters();
            window.App.Toast.success('Galerie actualisée');
        } catch (error) {
            console.error('Erreur chargement images:', error);
            window.App.Toast.error('Erreur de chargement');
            this.showEmpty(true);
        } finally {
            this.showLoading(false);
        }
    },
    
    // ==========================================================================
    // FILTRAGE ET TRI
    // ==========================================================================
    
    applyFilters() {
        let allImages = [];
        
        // Convertir l'objet en tableau plat
        Object.entries(this.images).forEach(([date, imgs]) => {
            imgs.forEach(img => {
                allImages.push({ ...img, date });
            });
        });
        
        // Appliquer le filtre de période
        const today = new Date().toISOString().split('T')[0];
        
        switch(this.currentFilter) {
            case 'today':
                allImages = allImages.filter(img => img.date === today);
                break;
            case 'week':
                const weekAgo = window.App.Utils.getDaysAgo(7);
                allImages = allImages.filter(img => img.date >= weekAgo);
                break;
            case 'month':
                const monthAgo = window.App.Utils.getDaysAgo(30);
                allImages = allImages.filter(img => img.date >= monthAgo);
                break;
            case 'custom':
                if (this.currentDate) {
                    allImages = allImages.filter(img => img.date === this.currentDate);
                }
                break;
        }
        
        // Appliquer le tri
        allImages.sort((a, b) => {
            const dateA = `${a.date}_${a.time || '00:00:00'}`;
            const dateB = `${b.date}_${b.time || '00:00:00'}`;
            return this.currentSort === 'newest' 
                ? dateB.localeCompare(dateA) 
                : dateA.localeCompare(dateB);
        });
        
        this.filteredImages = allImages;
        
        // Nettoyer les sélections invalides
        this.cleanupSelection();
        
        this.render();
        this.updateInfo();
    },
    
    // ==========================================================================
    // MODE SÉLECTION MULTIPLE
    // ==========================================================================
    
    toggleSelectionMode() {
        this.selectionMode = !this.selectionMode;
        this.selectedImages.clear();
        
        const selectModeBtn = document.getElementById('selectModeBtn');
        const selectionToolbar = document.getElementById('selectionToolbar');
        const galleryGrid = document.getElementById('galleryGrid');
        
        if (this.selectionMode) {
            selectModeBtn?.classList.add('active');
            selectionToolbar?.classList.add('active');
            galleryGrid?.classList.add('selection-mode');
        } else {
            selectModeBtn?.classList.remove('active');
            selectionToolbar?.classList.remove('active');
            galleryGrid?.classList.remove('selection-mode');
        }
        
        this.updateSelectionUI();
        this.render();
    },
    
    toggleImageSelection(path) {
        if (this.selectedImages.has(path)) {
            this.selectedImages.delete(path);
        } else {
            this.selectedImages.add(path);
        }
        this.updateSelectionUI();
        this.updateItemSelectionState(path);
    },
    
    selectAll() {
        if (this.selectedImages.size === this.filteredImages.length) {
            // Tout désélectionner
            this.selectedImages.clear();
        } else {
            // Tout sélectionner
            this.filteredImages.forEach(img => {
                this.selectedImages.add(img.path);
            });
        }
        this.updateSelectionUI();
        this.render();
    },
    
    cleanupSelection() {
        // Retirer les chemins qui ne sont plus dans les images filtrées
        const validPaths = new Set(this.filteredImages.map(img => img.path));
        this.selectedImages.forEach(path => {
            if (!validPaths.has(path)) {
                this.selectedImages.delete(path);
            }
        });
    },
    
    updateSelectionUI() {
        const count = this.selectedImages.size;
        const countEl = document.getElementById('selectionCount');
        const deleteBtn = document.getElementById('deleteSelectedBtn');
        const selectAllBtn = document.getElementById('selectAllBtn');
        
        if (countEl) {
            countEl.textContent = `${count} sélectionnée${count > 1 ? 's' : ''}`;
        }
        
        if (deleteBtn) {
            deleteBtn.disabled = count === 0;
        }
        
        if (selectAllBtn) {
            selectAllBtn.textContent = this.selectedImages.size === this.filteredImages.length 
                ? 'Tout désélectionner' 
                : 'Tout sélectionner';
        }
    },
    
    updateItemSelectionState(path) {
        const item = document.querySelector(`.gallery-item[data-path="${path}"]`);
        if (item) {
            if (this.selectedImages.has(path)) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        }
    },
    
    // ==========================================================================
    // RENDU
    // ==========================================================================
    
    render() {
        const grid = document.getElementById('galleryGrid');
        if (!grid) return;
        
        if (this.filteredImages.length === 0) {
            grid.innerHTML = '';
            this.showEmpty(true);
            return;
        }
        
        this.showEmpty(false);
        
        grid.innerHTML = this.filteredImages.map((img, index) => {
            const isSelected = this.selectedImages.has(img.path);
            return `
                <div class="gallery-item ${isSelected ? 'selected' : ''}" 
                     data-index="${index}" 
                     data-path="${img.path}">
                    ${this.selectionMode ? `
                        <div class="selection-checkbox ${isSelected ? 'checked' : ''}">
                            <span>✓</span>
                        </div>
                    ` : ''}
                    <img src="/uploads/${img.path}" alt="${img.filename}" loading="lazy">
                    <div class="gallery-item-overlay">
                        <span class="gallery-item-date">${window.App.Utils.formatDateShort(img.date)}</span>
                        <span class="gallery-item-time">${window.App.Utils.formatTime(img.time)}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        // Ajouter les événements de clic
        grid.querySelectorAll('.gallery-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const path = item.dataset.path;
                const index = parseInt(item.dataset.index);
                
                if (this.selectionMode) {
                    e.preventDefault();
                    this.toggleImageSelection(path);
                } else {
                    this.openLightbox(index);
                }
            });
        });
    },
    
    updateInfo() {
        const countEl = document.getElementById('photoCount');
        const rangeEl = document.getElementById('dateRange');
        
        if (countEl) {
            const count = this.filteredImages.length;
            countEl.textContent = `${count} photo${count > 1 ? 's' : ''}`;
        }
        
        if (rangeEl && this.filteredImages.length > 0) {
            const dates = this.filteredImages.map(img => img.date);
            const minDate = dates.reduce((a, b) => a < b ? a : b);
            const maxDate = dates.reduce((a, b) => a > b ? a : b);
            
            if (minDate === maxDate) {
                rangeEl.textContent = window.App.Utils.formatDateShort(minDate);
            } else {
                rangeEl.textContent = `${window.App.Utils.formatDateShort(minDate)} - ${window.App.Utils.formatDateShort(maxDate)}`;
            }
        } else if (rangeEl) {
            rangeEl.textContent = '--';
        }
    },
    
    showLoading(show) {
        const loading = document.getElementById('galleryLoading');
        const grid = document.getElementById('galleryGrid');
        
        if (loading) loading.style.display = show ? 'block' : 'none';
        if (grid && show) grid.innerHTML = '';
    },
    
    showEmpty(show) {
        const empty = document.getElementById('galleryEmpty');
        if (empty) empty.style.display = show ? 'block' : 'none';
    },
    
    // ==========================================================================
    // LIGHTBOX
    // ==========================================================================
    
    openLightbox(index) {
        if (this.selectionMode) return;
        
        this.currentIndex = index;
        const lightbox = document.getElementById('lightbox');
        
        if (lightbox) {
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
            this.updateLightboxContent();
        }
    },
    
    closeLightbox() {
        const lightbox = document.getElementById('lightbox');
        if (lightbox) {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
        }
    },
    
    navigateLightbox(direction) {
        this.currentIndex += direction;
        
        if (this.currentIndex < 0) {
            this.currentIndex = this.filteredImages.length - 1;
        } else if (this.currentIndex >= this.filteredImages.length) {
            this.currentIndex = 0;
        }
        
        this.updateLightboxContent();
    },
    
    updateLightboxContent() {
        const img = this.filteredImages[this.currentIndex];
        if (!img) return;
        
        const lightboxImg = document.getElementById('lightboxImage');
        const lightboxTitle = document.getElementById('lightboxTitle');
        const lightboxDate = document.getElementById('lightboxDate');
        const lightboxDownload = document.getElementById('lightboxDownload');
        
        if (lightboxImg) {
            lightboxImg.src = `/uploads/${img.path}`;
            lightboxImg.alt = img.filename;
        }
        
        if (lightboxTitle) {
            lightboxTitle.textContent = img.filename;
        }
        
        if (lightboxDate) {
            lightboxDate.textContent = `${window.App.Utils.formatDate(img.date)} à ${window.App.Utils.formatTime(img.time)}`;
        }
        
        if (lightboxDownload) {
            lightboxDownload.href = `/uploads/${img.path}`;
            lightboxDownload.download = img.filename;
        }
    },
    
    // ==========================================================================
    // SUPPRESSION SIMPLE (depuis lightbox)
    // ==========================================================================
    
    showDeleteModal() {
        const img = this.filteredImages[this.currentIndex];
        if (!img) return;
        
        this.pendingDeletePath = img.path;
        
        const modal = document.getElementById('deleteModal');
        const filename = document.getElementById('deleteFilename');
        const countInfo = document.getElementById('deleteCountInfo');
        const title = document.getElementById('deleteModalTitle');
        
        if (title) title.textContent = 'Supprimer cette photo ?';
        if (filename) {
            filename.textContent = img.filename;
            filename.style.display = 'block';
        }
        if (countInfo) countInfo.style.display = 'none';
        
        if (modal) modal.classList.add('active');
    },
    
    // ==========================================================================
    // SUPPRESSION DIRECTE DEPUIS LIGHTBOX (sans confirmation)
    // ==========================================================================
    
    async deleteFromLightbox() {
        const img = this.filteredImages[this.currentIndex];
        if (!img) return;
        
        const deleteBtn = document.getElementById('lightboxDelete');
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.textContent = '⏳ Suppression...';
        }
        
        try {
            await window.App.API.deleteImage(img.path);
            window.App.Toast.success('Photo supprimée');
            
            // Si c'était la dernière image, fermer la lightbox
            if (this.filteredImages.length <= 1) {
                this.closeLightbox();
            } else {
                // Sinon, passer à l'image suivante ou précédente
                if (this.currentIndex >= this.filteredImages.length - 1) {
                    this.currentIndex = Math.max(0, this.currentIndex - 1);
                }
            }
            
            // Recharger les images
            await this.loadImages();
            
            // Mettre à jour le contenu de la lightbox si elle est encore ouverte
            const lightbox = document.getElementById('lightbox');
            if (lightbox?.classList.contains('active') && this.filteredImages.length > 0) {
                this.updateLightboxContent();
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            window.App.Toast.error('Erreur lors de la suppression');
        } finally {
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.textContent = '🗑️ Supprimer';
            }
        }
    },

    // ==========================================================================
    // SUPPRESSION MULTIPLE
    // ==========================================================================
    
    showDeleteMultipleModal() {
        const count = this.selectedImages.size;
        if (count === 0) return;
        
        this.pendingDeletePath = null; // Indique suppression multiple
        
        const modal = document.getElementById('deleteModal');
        const filename = document.getElementById('deleteFilename');
        const countInfo = document.getElementById('deleteCountInfo');
        const title = document.getElementById('deleteModalTitle');
        
        if (title) title.textContent = 'Supprimer les photos sélectionnées ?';
        if (filename) filename.style.display = 'none';
        if (countInfo) {
            countInfo.textContent = `${count} photo${count > 1 ? 's' : ''} sélectionnée${count > 1 ? 's' : ''}`;
            countInfo.style.display = 'block';
        }
        
        if (modal) modal.classList.add('active');
    },
    
    closeDeleteModal() {
        const modal = document.getElementById('deleteModal');
        if (modal) modal.classList.remove('active');
        this.pendingDeletePath = null;
    },
    
    async confirmDelete() {
        const confirmBtn = document.getElementById('confirmDelete');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Suppression...';
        }
        
        try {
            if (this.pendingDeletePath) {
                // Suppression simple
                await this.deleteSingleImage(this.pendingDeletePath);
            } else {
                // Suppression multiple
                await this.deleteMultipleImages();
            }
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Supprimer';
            }
        }
    },
    
    async deleteSingleImage(path) {
        try {
            await window.App.API.deleteImage(path);
            window.App.Toast.success('Photo supprimée');
            
            this.closeDeleteModal();
            this.closeLightbox();
            
            // Recharger les images
            await this.loadImages();
        } catch (error) {
            console.error('Erreur suppression:', error);
            window.App.Toast.error('Erreur lors de la suppression');
        }
    },
    
    async deleteMultipleImages() {
        const paths = Array.from(this.selectedImages);
        
        try {
            const response = await fetch('/api/delete-multiple', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paths })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const count = result.deleted_count;
                window.App.Toast.success(`${count} photo${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''}`);
                
                if (result.error_count > 0) {
                    window.App.Toast.warning(`${result.error_count} erreur(s)`);
                }
                
                // Réinitialiser la sélection
                this.selectedImages.clear();
                this.toggleSelectionMode();
                
                this.closeDeleteModal();
                
                // Recharger les images
                await this.loadImages();
            } else {
                throw new Error(result.error || 'Erreur inconnue');
            }
        } catch (error) {
            console.error('Erreur suppression multiple:', error);
            window.App.Toast.error('Erreur lors de la suppression');
        }
    },
    
    // ==========================================================================
    // AUTO-REFRESH
    // ==========================================================================
    
    startAutoRefresh() {
        setInterval(() => {
            // Ne pas rafraîchir pendant le mode sélection
            if (!this.selectionMode) {
                this.loadImages();
            }
        }, window.App.CONFIG.REFRESH_INTERVAL);
    }
};

// =============================================================================
// INITIALISATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    Gallery.init();
});

window.Gallery = Gallery;
