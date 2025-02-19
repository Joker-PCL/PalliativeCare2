# Google Apps Script with Clasp

## 📌 ตัวอย่าง

[ดูวิดีโอตัวอย่างบน YouTube](https://youtu.be/iQfs4PM2UYA?si=jEG0KzftEKIMwCaR)

[Google Clasp บน GitHub](https://github.com/google/clasp)

## 🔧 คำสั่งติดตั้ง

```sh
cd project
npm install -g @google/clasp
clasp login
```

### เปิด Google Apps Script API

1. ไปที่ [Google Apps Script API](https://script.google.com/home/usersettings)
2. เปิดใช้งาน API

```sh
npm init
clasp clone ...scriptID...
clasp -v  # ตรวจสอบเวอร์ชัน (ควรมากกว่า v1.15)
npm i -D @types/google-apps-script
```

## 🔄 คำสั่งอัปเดตโค้ด

### อัปโหลดโค้ดจาก VS Code ไปยัง Google Apps Script

```sh
clasp push
```

### ดึงโค้ดจาก Google Apps Script มายัง VS Code

```sh
clasp pull
```

### อัปเดตโค้ดอัตโนมัติแบบเรียลไทม์

```sh
clasp push -w
```

---

📌 **หมายเหตุ**: ตรวจสอบให้แน่ใจว่าได้ล็อกอินและเปิดใช้งาน Google Apps Script API ก่อนใช้งาน Clasp
