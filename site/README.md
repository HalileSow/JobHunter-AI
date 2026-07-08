# Site local

Lancement :

```bash
cd /home/kali/JobHunter-AI/site
npm start
```

Le site écoute sur `0.0.0.0:4173`, ce qui permet d'y accéder depuis l'iPhone sur le même réseau Wi-Fi avec l'adresse IP de l'ordinateur.

Exemple :

```text
http://192.168.1.20:4173
```

La photo de profil se charge depuis le bouton `Importer une photo` et reste enregistrée dans le navigateur via `localStorage`.

Pour récupérer l'adresse IP de l'ordinateur, exécute :

```bash
ip a
```

Puis cherche l'adresse de ta carte Wi-Fi ou Ethernet.
