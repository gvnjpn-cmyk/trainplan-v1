# 🏋️ TrainPlan

Workout schedule planner premium dengan fitur lengkap.

## ✨ Fitur
- 📋 **Jadwal Mingguan** — recurring per hari, toggle on/off, live progress ring
- 📅 **Checkpoint** — jadwal per tanggal / rentang tanggal (program 1–30 hari)
- ⏱ **Timer Built-in** — countdown timer dengan ring + suara selesai
- 💾 **localStorage** — data tersimpan permanen
- 🔔 **Notifikasi** — browser push saat jadwal tiba
- 🔥 **Streak Tracker** — hitung hari berturut-turut
- 📤 **Export/Import** — backup & restore data JSON
- 📲 **PWA** — bisa diinstall di HP / desktop

## 🚀 Deploy

### Vercel (recommended)
```bash
npm install
npm install -g vercel
vercel
```

### Netlify Drop
```bash
npm install && npm run build
# Drag & drop folder dist/ ke netlify.com/drop
```

### GitHub Pages
Edit package.json, tambah:
```json
"homepage": "https://USERNAME.github.io/trainplan"
```
```bash
npm install && npm run deploy
```

## 💻 Development
```bash
npm install
npm run dev   # → http://localhost:5173
```
