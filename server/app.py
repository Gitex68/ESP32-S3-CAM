#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serveur Flask pour Mangeoire Connectée ESP32-S3
Sécurisé pour réseau local uniquement
"""

from flask import Flask, request, render_template, jsonify, send_from_directory, abort
from datetime import datetime, timedelta
from pathlib import Path
from functools import wraps
import logging
import json
import ipaddress
import socket
import time
import os

app = Flask(__name__, static_folder='assets', static_url_path='/assets')

# =============================================================================
# CONFIGURATION
# =============================================================================
UPLOAD_FOLDER = Path("uploads")
UPLOAD_FOLDER.mkdir(exist_ok=True)

LOG_FILE = Path("events.log")
MAX_LOG_ENTRIES = 100

# Sécurité
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB max
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg'}
RATE_LIMIT_REQUESTS = 1000  # Requêtes max par minute
RATE_LIMIT_WINDOW = 60  # Fenêtre en secondes

# =============================================================================
# LOGGING
# =============================================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# =============================================================================
# STOCKAGE EN MÉMOIRE
# =============================================================================
events = []
rate_limit_store = {}  # {ip: [(timestamp, count)]}

# =============================================================================
# FONCTIONS DE SÉCURITÉ
# =============================================================================

def get_local_ip():
    """Récupère l'IP locale du serveur"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def get_local_network():
    """Récupère le réseau local (assume /24)"""
    local_ip = get_local_ip()
    try:
        # Assume un masque /24 pour le réseau local
        network = ipaddress.ip_network(f"{local_ip}/24", strict=False)
        return network
    except Exception:
        return None

def is_private_ip(ip_str):
    """Vérifie si l'IP est une IP privée (LAN)"""
    try:
        ip = ipaddress.ip_address(ip_str)
        return ip.is_private or ip.is_loopback
    except ValueError:
        return False

def is_on_local_network(ip_str):
    """Vérifie si l'IP est sur le même réseau local"""
    try:
        ip = ipaddress.ip_address(ip_str)
        
        # Toujours autoriser localhost
        if ip.is_loopback:
            return True
        
        # Vérifier si c'est une IP privée
        if not ip.is_private:
            return False
        
        # Vérifier si sur le même sous-réseau
        local_network = get_local_network()
        if local_network and ip in local_network:
            return True
        
        # Accepter les plages privées courantes si on ne peut pas déterminer le réseau
        private_ranges = [
            ipaddress.ip_network("192.168.0.0/16"),
            ipaddress.ip_network("10.0.0.0/8"),
            ipaddress.ip_network("172.16.0.0/12"),
        ]
        
        return any(ip in network for network in private_ranges)
    except ValueError:
        return False

def get_client_ip():
    """Récupère l'IP du client de manière sécurisée"""
    # Vérifier les headers de proxy (uniquement si proxy de confiance)
    if request.headers.get('X-Forwarded-For'):
        # Prendre la première IP (client original)
        ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        ip = request.headers.get('X-Real-IP')
    else:
        ip = request.remote_addr
    return ip

def check_rate_limit(ip):
    """Vérifie le rate limiting pour une IP"""
    now = time.time()
    
    # Nettoyer les anciennes entrées
    if ip in rate_limit_store:
        rate_limit_store[ip] = [
            (ts, count) for ts, count in rate_limit_store[ip]
            if now - ts < RATE_LIMIT_WINDOW
        ]
    
    # Compter les requêtes récentes
    if ip not in rate_limit_store:
        rate_limit_store[ip] = []
    
    total_requests = sum(count for _, count in rate_limit_store[ip])
    
    if total_requests >= RATE_LIMIT_REQUESTS:
        return False
    
    # Ajouter la requête actuelle
    rate_limit_store[ip].append((now, 1))
    return True

def log_event(event_type, message, details=None):
    """Enregistre un événement avec horodatage"""
    event = {
        "timestamp": datetime.now().isoformat(),
        "type": event_type,
        "message": message,
        "details": details or {}
    }
    events.insert(0, event)
    
    if len(events) > MAX_LOG_ENTRIES:
        events.pop()
    
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(json.dumps(event) + '\n')
    except Exception as e:
        logging.error(f"Erreur écriture log: {e}")
    
    logging.info(f"[{event_type}] {message}")
    return event

def validate_filename(filename):
    """Valide et nettoie un nom de fichier"""
    if not filename:
        return None
    
    # Supprimer les caractères dangereux
    safe_chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
    cleaned = ''.join(c for c in filename if c in safe_chars)
    
    # Vérifier l'extension
    ext = Path(cleaned).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return None
    
    return cleaned

# =============================================================================
# DÉCORATEUR DE SÉCURITÉ
# =============================================================================

def require_local_network(f):
    """Décorateur pour restreindre l'accès au réseau local"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_ip = get_client_ip()
        
        # Vérifier si l'IP est sur le réseau local
        if not is_on_local_network(client_ip):
            log_event(
                "SECURITY",
                f"Accès refusé - IP hors réseau local: {client_ip}",
                {"ip": client_ip, "endpoint": request.endpoint}
            )
            abort(403, description="Accès refusé - Réseau local uniquement")
        
        # Vérifier le rate limiting
        if not check_rate_limit(client_ip):
            log_event(
                "SECURITY",
                f"Rate limit dépassé pour: {client_ip}",
                {"ip": client_ip}
            )
            abort(429, description="Trop de requêtes - Réessayez plus tard")
        
        return f(*args, **kwargs)
    return decorated_function

# =============================================================================
# GESTIONNAIRES D'ERREURS
# =============================================================================

@app.errorhandler(403)
def forbidden(e):
    return jsonify({
        "error": "Accès refusé",
        "message": str(e.description),
        "code": 403
    }), 403

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "error": "Non trouvé",
        "message": "Ressource introuvable",
        "code": 404
    }), 404

@app.errorhandler(429)
def too_many_requests(e):
    return jsonify({
        "error": "Trop de requêtes",
        "message": str(e.description),
        "code": 429
    }), 429

@app.errorhandler(500)
def internal_error(e):
    return jsonify({
        "error": "Erreur serveur",
        "message": "Une erreur interne s'est produite",
        "code": 500
    }), 500

# =============================================================================
# ROUTES
# =============================================================================

@app.route('/')
@require_local_network
def index():
    """Page d'accueil"""
    return render_template('index.html')


@app.route('/galerie')
@require_local_network
def galerie():
    """Page galerie photos"""
    return render_template('galerie.html')


@app.route('/stats')
@require_local_network
def stats_page():
    """Page statistiques"""
    return render_template('stats.html')


@app.route('/about')
@require_local_network
def about():
    """Page à propos"""
    return render_template('about.html')


@app.route('/logs')
@require_local_network
def logs_page():
    """Page des logs en temps réel"""
    return render_template('logs.html')


@app.route('/upload', methods=['POST'])
@require_local_network
def upload_image():
    """
    Endpoint pour recevoir les photos de l'ESP32
    Sécurisé avec validation des données
    """
    client_ip = get_client_ip()
    
    try:
        # Vérifier la taille avant de lire
        content_length = request.content_length
        if content_length and content_length > MAX_UPLOAD_SIZE:
            log_event("ERROR", f"Upload trop volumineux: {content_length} bytes", {"ip": client_ip})
            return jsonify({"error": "Fichier trop volumineux"}), 413
        
        # Récupérer l'image
        image_data = request.get_data(cache=False)
        
        if not image_data:
            log_event("ERROR", "Aucune donnée d'image reçue", {"ip": client_ip})
            return jsonify({"error": "No image data"}), 400
        
        # Vérifier la taille réelle
        if len(image_data) > MAX_UPLOAD_SIZE:
            log_event("ERROR", f"Upload trop volumineux: {len(image_data)} bytes", {"ip": client_ip})
            return jsonify({"error": "Fichier trop volumineux"}), 413
        
        # Vérifier le magic number JPEG (FFD8FF)
        if len(image_data) < 3 or image_data[:2] != b'\xff\xd8':
            log_event("ERROR", "Format d'image invalide (non-JPEG)", {"ip": client_ip})
            return jsonify({"error": "Format invalide - JPEG requis"}), 400
        
        # Créer le timestamp et le dossier
        now = datetime.now()
        date_folder = UPLOAD_FOLDER / now.strftime("%Y-%m-%d")
        date_folder.mkdir(exist_ok=True)
        
        # Nom du fichier sécurisé
        filename = f"IMG_{now.strftime('%Y-%m-%d_%H-%M-%S')}.jpg"
        filepath = date_folder / filename
        
        # Éviter l'écrasement
        counter = 1
        while filepath.exists():
            filename = f"IMG_{now.strftime('%Y-%m-%d_%H-%M-%S')}_{counter}.jpg"
            filepath = date_folder / filename
            counter += 1
        
        # Sauvegarder l'image
        with open(filepath, 'wb') as f:
            f.write(image_data)
        
        file_size = len(image_data) / 1024
        
        log_event(
            "UPLOAD",
            f"Photo reçue: {filename}",
            {
                "filename": filename,
                "date": now.strftime("%Y-%m-%d"),
                "time": now.strftime("%H:%M:%S"),
                "size_kb": round(file_size, 2),
                "path": str(filepath.relative_to(UPLOAD_FOLDER)),
                "source_ip": client_ip
            }
        )
        
        return jsonify({
            "success": True,
            "filename": filename,
            "path": str(filepath.relative_to(UPLOAD_FOLDER)),
            "size_kb": round(file_size, 2)
        }), 200
        
    except Exception as e:
        error_msg = f"Erreur lors de la sauvegarde: {str(e)}"
        log_event("ERROR", error_msg, {"ip": client_ip})
        logging.error(error_msg, exc_info=True)
        return jsonify({"error": "Erreur serveur"}), 500


@app.route('/api/images')
@require_local_network
def get_images():
    """Retourne la liste des images organisées par date"""
    images_by_date = {}
    
    try:
        for date_folder in sorted(UPLOAD_FOLDER.iterdir(), reverse=True):
            if date_folder.is_dir() and not date_folder.name.startswith('.'):
                date_str = date_folder.name
                images = []
                
                for img_file in sorted(date_folder.glob("*.jpg"), reverse=True):
                    try:
                        # Extraire l'heure du nom de fichier
                        parts = img_file.stem.split('_')
                        time_str = parts[-1].replace('-', ':') if len(parts) >= 2 else "00:00:00"
                        
                        images.append({
                            "filename": img_file.name,
                            "path": f"{date_str}/{img_file.name}",
                            "size": img_file.stat().st_size,
                            "date": date_str,
                            "time": time_str
                        })
                    except Exception:
                        continue
                
                if images:
                    images_by_date[date_str] = images
    except Exception as e:
        logging.error(f"Erreur lecture galerie: {e}")
    
    return jsonify(images_by_date)


@app.route('/api/events')
@require_local_network
def get_events():
    """Retourne les derniers événements"""
    limit = min(request.args.get('limit', 50, type=int), MAX_LOG_ENTRIES)
    return jsonify(events[:limit])


@app.route('/uploads/<path:filename>')
@require_local_network
def serve_image(filename):
    """Sert les images uploadées de manière sécurisée"""
    # Empêcher la traversée de répertoire
    try:
        safe_path = Path(filename)
        if '..' in safe_path.parts or safe_path.is_absolute():
            abort(403)
        
        full_path = UPLOAD_FOLDER / safe_path
        if not full_path.resolve().is_relative_to(UPLOAD_FOLDER.resolve()):
            abort(403)
        
        if not full_path.exists():
            abort(404)
            
        return send_from_directory(UPLOAD_FOLDER, filename)
    except Exception:
        abort(404)


@app.route('/api/stats')
@require_local_network
def get_stats():
    """Statistiques globales"""
    total_images = 0
    total_size = 0
    dates = []
    
    try:
        for date_folder in UPLOAD_FOLDER.iterdir():
            if date_folder.is_dir() and not date_folder.name.startswith('.'):
                images = list(date_folder.glob("*.jpg"))
                if images:
                    dates.append(date_folder.name)
                    total_images += len(images)
                    total_size += sum(img.stat().st_size for img in images)
    except Exception as e:
        logging.error(f"Erreur calcul stats: {e}")
    
    return jsonify({
        "total_images": total_images,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "total_days": len(dates),
        "first_date": min(dates) if dates else None,
        "last_date": max(dates) if dates else None
    })


@app.route('/api/delete/<path:filename>', methods=['DELETE'])
@require_local_network
def delete_image(filename):
    """Supprime une image de manière sécurisée"""
    client_ip = get_client_ip()
    
    try:
        safe_path = Path(filename)
        if '..' in safe_path.parts or safe_path.is_absolute():
            abort(403)
        
        full_path = UPLOAD_FOLDER / safe_path
        if not full_path.resolve().is_relative_to(UPLOAD_FOLDER.resolve()):
            abort(403)
        
        if not full_path.exists():
            return jsonify({"error": "Fichier non trouvé"}), 404
        
        full_path.unlink()
        
        # Supprimer le dossier parent s'il est vide
        parent_folder = full_path.parent
        if parent_folder != UPLOAD_FOLDER and not any(parent_folder.iterdir()):
            parent_folder.rmdir()
        
        log_event(
            "DELETE",
            f"Image supprimée: {filename}",
            {"filename": filename, "ip": client_ip}
        )
        
        return jsonify({"success": True, "deleted": filename})
    except Exception as e:
        logging.error(f"Erreur suppression: {e}")
        return jsonify({"error": "Erreur lors de la suppression"}), 500


@app.route('/api/delete-multiple', methods=['POST'])
@require_local_network
def delete_multiple_images():
    """Supprime plusieurs images en une seule requête"""
    client_ip = get_client_ip()
    
    try:
        if not request.is_json:
            return jsonify({"error": "JSON requis"}), 400
        
        paths = request.json.get('paths', [])
        
        if not paths or not isinstance(paths, list):
            return jsonify({"error": "Liste de chemins requise"}), 400
        
        if len(paths) > 100:
            return jsonify({"error": "Maximum 100 images à la fois"}), 400
        
        deleted = []
        errors = []
        folders_to_check = set()
        
        for filename in paths:
            try:
                safe_path = Path(filename)
                if '..' in safe_path.parts or safe_path.is_absolute():
                    errors.append({"path": filename, "error": "Chemin invalide"})
                    continue
                
                full_path = UPLOAD_FOLDER / safe_path
                if not full_path.resolve().is_relative_to(UPLOAD_FOLDER.resolve()):
                    errors.append({"path": filename, "error": "Chemin non autorisé"})
                    continue
                
                if not full_path.exists():
                    errors.append({"path": filename, "error": "Fichier non trouvé"})
                    continue
                
                # Mémoriser le dossier parent pour vérification ultérieure
                folders_to_check.add(full_path.parent)
                
                full_path.unlink()
                deleted.append(filename)
                
            except Exception as e:
                errors.append({"path": filename, "error": str(e)})
        
        # Supprimer les dossiers vides
        for folder in folders_to_check:
            try:
                if folder != UPLOAD_FOLDER and folder.exists() and not any(folder.iterdir()):
                    folder.rmdir()
            except Exception:
                pass
        
        log_event(
            "DELETE_MULTIPLE",
            f"{len(deleted)} image(s) supprimée(s)",
            {"deleted_count": len(deleted), "error_count": len(errors), "ip": client_ip}
        )
        
        return jsonify({
            "success": True,
            "deleted": deleted,
            "deleted_count": len(deleted),
            "errors": errors,
            "error_count": len(errors)
        })
        
    except Exception as e:
        logging.error(f"Erreur suppression multiple: {e}")
        return jsonify({"error": "Erreur lors de la suppression"}), 500


@app.route('/health')
def health():
    """Endpoint de santé (accessible sans restriction pour monitoring)"""
    client_ip = get_client_ip()
    is_local = is_on_local_network(client_ip)
    
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "local_access": is_local,
        "server_ip": get_local_ip()
    })


@app.route('/api/cleanup', methods=['POST'])
@require_local_network
def cleanup_old_images():
    """Supprime les images de plus de X jours"""
    try:
        days = request.json.get('days', 7) if request.is_json else 7
        days = max(1, min(days, 365))  # Entre 1 et 365 jours
        
        cutoff_date = datetime.now() - timedelta(days=days)
        deleted_count = 0
        
        for date_folder in UPLOAD_FOLDER.iterdir():
            if date_folder.is_dir():
                try:
                    folder_date = datetime.strptime(date_folder.name, "%Y-%m-%d")
                    if folder_date < cutoff_date:
                        for img in date_folder.glob("*.jpg"):
                            img.unlink()
                            deleted_count += 1
                        
                        # Supprimer le dossier s'il est vide
                        if not any(date_folder.iterdir()):
                            date_folder.rmdir()
                except ValueError:
                    continue
        
        log_event(
            "CLEANUP",
            f"Nettoyage effectué: {deleted_count} images supprimées (>{days} jours)",
            {"deleted_count": deleted_count, "days": days}
        )
        
        return jsonify({
            "success": True,
            "deleted_count": deleted_count,
            "days_threshold": days
        })
    except Exception as e:
        logging.error(f"Erreur cleanup: {e}")
        return jsonify({"error": "Erreur lors du nettoyage"}), 500


# =============================================================================
# DÉMARRAGE
# =============================================================================

if __name__ == '__main__':
    # Charger les événements existants
    if LOG_FILE.exists():
        try:
            with open(LOG_FILE, 'r', encoding='utf-8') as f:
                for line in f.readlines()[-MAX_LOG_ENTRIES:]:
                    try:
                        event = json.loads(line.strip())
                        events.append(event)
                    except:
                        pass
            events.reverse()
        except Exception as e:
            logging.warning(f"Impossible de charger les logs existants: {e}")
    
    server_ip = get_local_ip()
    local_network = get_local_network()
    
    log_event("SERVER", "Serveur démarré (sécurisé LAN)", {
        "port": 5000,
        "server_ip": server_ip,
        "network": str(local_network) if local_network else "inconnu"
    })
    
    print("\n" + "="*60)
    print("🌿 SERVEUR MANGEOIRE CONNECTÉE ESP32-S3")
    print("🔒 MODE SÉCURISÉ - RÉSEAU LOCAL UNIQUEMENT")
    print("="*60)
    print(f"📡 IP du serveur: {server_ip}")
    print(f"🌐 Réseau autorisé: {local_network if local_network else 'IPs privées'}")
    print(f"🖼️  Galerie photos: http://{server_ip}:5000")
    print(f"📊 Logs temps réel: http://{server_ip}:5000/logs")
    print(f"📁 Dossier uploads: {UPLOAD_FOLDER.absolute()}")
    print("="*60)
    print("⚠️  Seules les connexions du réseau local sont autorisées")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
