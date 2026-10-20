// Ρυθμίσεις του site. Αυτό είναι το μόνο αρχείο που χρειάζεται να αλλάξει κανείς.
window.BTN_CONFIG = {
  // Link CSV από το Google Sheet: Αρχείο → Κοινοποίηση → Δημοσίευση στον ιστό → φύλλο «Εγχειρήματα» → CSV.
  // Όσο είναι κενό, το site δείχνει τα φανταστικά παραδείγματα από το example.csv.
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSfDHU1OgujxuwsuJ1C7oQKwDd3NmFQeghFVJuC1m94NFB5jHGqPyELS-BGVx-RDg5anuOhQU0g_g-D/pub?gid=153597941&single=true&output=csv",

  // Στο site εμφανίζονται ΜΟΝΟ οι γραμμές με αυτή την τιμή στη στήλη consent.
  CONSENT_VALUE: "ΝΑΙ",

  // Κέντρο και ζουμ του χάρτη
  MAP_CENTER: [37.982, 23.733],
  MAP_ZOOM: 13,

  // Μετά από πόσους μήνες ένα profile σημειώνεται «χρειάζεται επανέλεγχο»
  STALE_MONTHS: 6,

  // Email για διορθώσεις (εμφανίζεται ως κείμενο)
  CONTACT_EMAIL: "xristosrs13@gmail.com"
};
