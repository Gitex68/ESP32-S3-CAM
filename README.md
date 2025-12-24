# 🌿 Mangeoire Connectée ESP32-S3 - Serveur Web

Système complet de réception et visualisation de photos pour votre mangeoire connectée avec ESP32-S3 + caméra OV5640.

## 📋 Description

Ce projet fournit :
- **Serveur Python Flask** : Reçoit les photos de l'ESP32 via HTTP POST
- **Galerie web responsive** : Affiche les photos par date avec miniatures et agrandissement
- **Live logs** : Suivi en temps réel des événements (uploads, détections, erreurs)
- **Organisation automatique** : Photos classées par dossiers journaliers
- **Accès réseau local** : Accessible depuis n'importe quel appareil sur votre réseau

## 📁 Structure du Projet

```
server/
├── app.py                    # Serveur Flask principal
├── requirements.txt          # Dépendances Python
├── templates/
│   ├── gallery.html         # Page galerie photos
│   └── logs.html            # Page logs temps réel
├── uploads/                 # Dossier photos (créé automatiquement)
│   ├── 2025-12-02/         # Exemple : photos du 2 décembre 2025
│   │   ├── IMG_2025-12-02_08-30-15.jpg
│   │   ├── IMG_2025-12-02_14-22-45.jpg
│   │   └── ...
│   └── ...
└── events.log              # Historique des événements
```

## 🔧 Installation

### 1. Prérequis

- **Python 3.8 ou supérieur**
- **Connexion réseau local** (même réseau que l'ESP32)

### 2. Installation des dépendances

Ouvrez PowerShell dans le dossier `server` et exécutez :

```powershell
# Installer les dépendances Python
pip install -r requirements.txt
```

### 3. Configuration de l'adresse IP

#### A. Trouver l'IP de votre PC

Dans PowerShell, exécutez :
```powershell
ipconfig
```

Cherchez votre adresse IPv4 (ex : `192.168.1.100`)

#### B. Mettre à jour le code ESP32

Dans votre fichier `scriptEsp.ino`, modifiez la ligne :
```cpp
const char* serverUrl = "http://192.168.1.100:5000/upload";
```

Remplacez `192.168.1.100` par l'IP de votre PC.

## 🚀 Lancement du Serveur

### Méthode 1 : Ligne de commande

```powershell
cd c:\Users\mathi\Downloads\Esp32-S3cam\server
python app.py
```

### Méthode 2 : Double-clic sur app.py

Vous pouvez simplement double-cliquer sur `app.py` pour lancer le serveur.

### Vérification du démarrage

Vous devriez voir :

```
============================================================
🌿 SERVEUR MANGEOIRE CONNECTÉE ESP32-S3
============================================================
📡 Serveur lancé sur: http://0.0.0.0:5000
🖼️  Galerie photos: http://localhost:5000
📊 Logs temps réel: http://localhost:5000/logs
📁 Dossier uploads: C:\Users\mathi\Downloads\Esp32-S3cam\server\uploads
============================================================

 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.1.100:5000
```

## 🌐 Accès aux Pages Web

### Sur le PC serveur :
- **Galerie** : http://localhost:5000
- **Logs** : http://localhost:5000/logs

### Depuis un autre appareil (téléphone, tablette) :
- **Galerie** : http://192.168.1.100:5000
- **Logs** : http://192.168.1.100:5000/logs

*(Remplacez par votre IP)*

## 📸 Fonctionnalités de la Galerie

### Interface Galerie
- ✅ **Miniatures** : Aperçu de toutes les photos
- ✅ **Agrandissement** : Clic sur une photo pour l'afficher en plein écran
- ✅ **Tri par date** : Photos organisées par jour
- ✅ **Statistiques** : Nombre total de photos, jours d'activité, espace utilisé
- ✅ **Actualisation auto** : Mise à jour toutes les 30 secondes
- ✅ **Responsive** : S'adapte à tous les écrans (PC, tablette, mobile)

### Interface Logs
- ✅ **Temps réel** : Actualisation toutes les 5 secondes
- ✅ **Filtrage** : Par type d'événement (Upload, Erreur, Serveur)
- ✅ **Détails** : Informations complètes sur chaque événement
- ✅ **Horodatage** : Date et heure précises

## 🔌 Configuration du Pare-feu Windows

Si l'ESP32 ne peut pas envoyer les photos, autorisez Python dans le pare-feu :

### Méthode PowerShell (Administrateur) :

```powershell
# Autoriser Python sur le port 5000
New-NetFirewallRule -DisplayName "Python Flask Server" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

### Méthode GUI :
1. **Panneau de configuration** → **Pare-feu Windows Defender**
2. **Paramètres avancés** → **Règles de trafic entrant** → **Nouvelle règle**
3. Type : **Port** → TCP → Port **5000**
4. Action : **Autoriser la connexion**
5. Profils : Cocher **Privé** et **Public**
6. Nom : `Flask Server Mangeoire ESP32`

## 📡 Test de Connexion

### 1. Vérifier que le serveur est accessible

Depuis un navigateur sur votre PC :
```
http://localhost:5000/health
```

Vous devriez voir :
```json
{
  "status": "ok",
  "timestamp": "2025-12-02T10:30:00"
}
```

### 2. Test depuis un autre appareil

Sur votre téléphone connecté au même réseau :
```
http://192.168.1.100:5000/health
```

### 3. Test d'upload manuel (optionnel)

Avec PowerShell :
```powershell
# Tester l'envoi d'une image
Invoke-WebRequest -Uri "http://localhost:5000/upload" -Method POST -InFile "test.jpg" -ContentType "image/jpeg"
```

## 🔄 Workflow Complet

1. **ESP32 détecte un mouvement** (capteur PIR)
2. **Vérification luminosité** (LDR) → Si jour : continue, sinon : retour en deep sleep
3. **Prise de photo** avec caméra OV5640
4. **Sauvegarde sur SD** avec timestamp
5. **Connexion WiFi** et envoi HTTP POST vers le serveur
6. **Serveur reçoit** → Enregistre dans `uploads/YYYY-MM-DD/`
7. **Log de l'événement** visible dans la page Logs
8. **Actualisation automatique** de la galerie web

## 🛠️ API Endpoints

### POST /upload
Reçoit une photo de l'ESP32
- **Content-Type** : `image/jpeg`
- **Body** : Données binaires de l'image
- **Réponse** : JSON avec détails du fichier

### GET /api/images
Retourne toutes les photos organisées par date
- **Réponse** : JSON `{date: [liste de photos]}`

### GET /api/events
Retourne les derniers événements
- **Paramètre** : `?limit=50` (optionnel)
- **Réponse** : JSON array des événements

### GET /api/stats
Statistiques globales
- **Réponse** : JSON avec nombre d'images, taille totale, etc.

### GET /uploads/<path>
Sert les images uploadées

## ⚙️ Configuration Avancée

### Changer le port du serveur

Dans `app.py`, ligne finale :
```python
app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
```

Remplacez `5000` par le port de votre choix.

### Limiter la taille des logs

Dans `app.py` :
```python
MAX_LOG_ENTRIES = 100  # Modifier ce nombre
```

### Changer le dossier d'upload

Dans `app.py` :
```python
UPLOAD_FOLDER = Path("uploads")  # Modifier le chemin
```

## 🐛 Dépannage

### L'ESP32 ne peut pas se connecter

1. Vérifiez l'IP du serveur dans le code ESP32
2. Vérifiez que le serveur est lancé
3. Testez avec `http://VOTRE_IP:5000/health` depuis un navigateur
4. Désactivez temporairement le pare-feu Windows pour tester
5. Vérifiez que l'ESP32 et le PC sont sur le même réseau WiFi

### Les images n'apparaissent pas

1. Vérifiez le dossier `uploads/` (doit se créer automatiquement)
2. Regardez la console du serveur pour les erreurs
3. Consultez la page `/logs` pour voir les événements
4. Vérifiez les permissions du dossier

### Le serveur ne démarre pas

```powershell
# Vérifier que Python est installé
python --version

# Vérifier que Flask est installé
pip show flask

# Réinstaller les dépendances
pip install -r requirements.txt --force-reinstall
```

### Port 5000 déjà utilisé

Soit changer le port dans `app.py`, soit libérer le port :
```powershell
# Voir quel processus utilise le port 5000
netstat -ano | findstr :5000

# Tuer le processus (remplacer PID)
taskkill /PID <numero_pid> /F
```

## 📱 Accès Mobile Optimisé

L'interface est entièrement responsive. Sur smartphone :
- **Navigation tactile** fluide
- **Miniatures adaptées** à la taille d'écran
- **Modal plein écran** pour agrandir les photos
- **Actualisation automatique** en arrière-plan

## 🔐 Sécurité

⚠️ **Ce serveur est conçu pour un usage en réseau local uniquement.**

Pour un accès depuis Internet :
- Utilisez un VPN
- Ou ajoutez une authentification (non incluse dans cette version)
- Ou utilisez un reverse proxy avec HTTPS (nginx, Apache)

## 📊 Performances

- **Capacité** : Illimitée (dépend de l'espace disque)
- **Vitesse** : Upload instantané (~2-3 secondes pour une photo 5MP)
- **Concurrence** : Support multi-threading (plusieurs ESP32 possibles)

## 🎨 Personnalisation

### Changer les couleurs du thème

**Galerie** (`templates/gallery.html`) :
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

**Logs** (`templates/logs.html`) :
```css
background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
```

## 📝 Logs et Maintenance

### Consulter les logs fichier

```powershell
# Voir les derniers logs
Get-Content events.log -Tail 20

# Vider les logs
Remove-Item events.log
```

### Nettoyer les anciennes photos

```powershell
# Supprimer les photos de plus de 30 jours
Get-ChildItem uploads -Recurse -Directory | Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Recurse -Force
```

## 🚀 Lancement Automatique au Démarrage

### Créer un script de lancement

Créez `start_server.bat` :
```batch
@echo off
cd /d "c:\Users\mathi\Downloads\Esp32-S3cam\server"
python app.py
pause
```

### Ajouter au démarrage Windows

1. Appuyez sur `Win + R`
2. Tapez `shell:startup` et validez
3. Créez un raccourci vers `start_server.bat` dans ce dossier

## 📞 Support

En cas de problème :
1. Vérifiez les logs serveur dans la console
2. Consultez la page `/logs` en temps réel
3. Testez l'endpoint `/health`
4. Vérifiez la connexion réseau de l'ESP32

## 📄 Licence

Projet libre d'utilisation pour usage personnel et éducatif.

---

**Créé pour le projet Mangeoire Connectée ESP32-S3 + OV5640** 🌿📷

