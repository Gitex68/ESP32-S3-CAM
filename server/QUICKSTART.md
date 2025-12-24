# Guide de Démarrage Rapide 🚀

## 🎯 Installation en 3 étapes

### 1️⃣ Installer les dépendances Python
```powershell
pip install -r requirements.txt
```

### 2️⃣ Trouver l'IP de votre PC
```powershell
ipconfig
```
Notez votre adresse IPv4 (ex: `192.168.1.100`)

### 3️⃣ Modifier le code ESP32
Dans `scriptEsp.ino`, ligne 22 :
```cpp
const char* serverUrl = "http://VOTRE_IP:5000/upload";
```

## ▶️ Lancer le serveur

### Option A : Script automatique
Double-cliquez sur `start_server.bat`

### Option B : Ligne de commande
```powershell
python app.py
```

## 🌐 Accéder au site

- **Galerie** : http://localhost:5000
- **Logs** : http://localhost:5000/logs
- **Depuis mobile** : http://VOTRE_IP:5000

## ✅ Vérifier que ça fonctionne

1. Ouvrez http://localhost:5000/health
2. Vous devriez voir : `{"status": "ok", ...}`
3. Uploadez une photo avec l'ESP32
4. Elle apparaît dans la galerie !

## 🆘 Problème ?

Consultez le fichier `README.md` complet pour le dépannage.

---

**Bon visionnage de vos visiteurs à plumes ! 🐦📷**
