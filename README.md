# Noctua Panic Web App (V1)

Mobile-first web application για άμεση ειδοποίηση σε πραγματικά περιστατικά εισβολής.  
Σχεδιασμένο για εταιρείες security, static guards και περιμετρική φύλαξη ακινήτων.  
Με ένα πάτημα ενεργοποιεί αυτόματα κλήσεις και SMS, εμφανίζει live status και δημιουργεί AI incident report.

---

## 🚨 Τι κάνει
- Με ένα πάτημα ενεργοποιεί **3 τηλεφωνικές κλήσεις + 3 SMS**.
- Εμφανίζει **ζωντανή ενημέρωση** στον φύλακα (calls, SMS, timing).
- Καταγράφει αυτόματα όλα τα δεδομένα συμβάντος.
- Δημιουργεί **AI-powered incident reports** και παρέχει analytics στο Admin Panel.

---

## 🧩 Χαρακτηριστικά (V1)
- Mobile-first σχεδιασμός (web app χωρίς εγκατάσταση)
- Μεγάλο **ALERT button** με confirm modal & countdown
- Live status card για κλήσεις και SMS
- Logging στο backend (χρόνοι, guard, site)
- AI Incident Reporting μέσω OpenAI API
- Δυνατότητα προβολής και ανάλυσης στο Noctua Core™ Admin Panel

---

## 🧠 AI Reporting & Analytics
Το σύστημα περιλαμβάνει AI Assistant που:
- λαμβάνει δεδομένα από το backend  
- συνδυάζει input από τον φύλακα  
- δημιουργεί **δομημένη αναφορά συμβάντος**  
- αναλύει:
  - χρόνο απόκρισης  
  - επιτυχία τηλεφωνικών κλήσεων  
  - παράδοση SMS  
  - μοτίβα, βάρδιες και patterns  
- δημοσιεύει την αναφορά στο Admin Panel

---

## 🏗 Τεχνολογίες
- **HTML5 / CSS3 / JavaScript**
- **Twilio API** (Calls + SMS)
- **Node.js / Express** backend
- **Supabase ή Firestore** για logging
- **OpenAI Responses API** για AI reporting
- **Noctua Core™ Admin Panel** για διαχείριση & analytics

---

## 🔄 Ροή Χρήσης (User Flow)
1. Ο φύλακας ανοίγει το web app → βλέπει το μεγάλο κουμπί **ALERT**.
2. Πατάει → εμφανίζεται modal επιβεβαίωσης με countdown.
3. Επιβεβαιώνει → το σύστημα:
   - καλεί 3 προκαθορισμένα τηλέφωνα  
   - στέλνει 3 SMS  
   - ξεκινά logging & live status  
4. Εμφανίζεται ζωντανή ενημέρωση στην οθόνη.
5. Το backend στέλνει δεδομένα στον AI Assistant → δημιουργείται report.
6. Ο διαχειριστής βλέπει το περιστατικό στο Admin Panel.

---

## 📡 Αρχιτεκτονική

```plaintext
Guard → Noctua Panic Web App → Backend API → Twilio (Calls/SMS)
                                        ↓
                                   Logging DB
                                        ↓
                           AI Assistant (Incident Reporting)
                                        ↓
                           Noctua Core™ Admin Panel (Analytics)
```



