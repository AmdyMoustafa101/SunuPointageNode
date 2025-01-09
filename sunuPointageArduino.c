#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

// Déclaration du servo
Servo porteServo;

#define RST_PIN 5      // Pin RST pour RC522
#define SS_PIN 53      // Pin SDA pour RC522
#define POINTAGE_BUTTON_PIN 2 // Pin pour le bouton de pointage
#define LOGIN_BUTTON_PIN 3    // Pin pour le bouton de connexion
#define BUZZER_PIN 7   // Pin pour le buzzer


MFRC522 rfid(SS_PIN, RST_PIN); 
LiquidCrystal_I2C lcd(0x27, 16, 2); // Adresse I2C 0x27, écran LCD 16x2

void setup() {
  pinMode(POINTAGE_BUTTON_PIN, INPUT_PULLUP); // Configuration du bouton de pointage
  pinMode(LOGIN_BUTTON_PIN, INPUT_PULLUP);    // Configuration du bouton de connexion
  pinMode(BUZZER_PIN, OUTPUT);

  Serial.begin(9600);  // Communication série avec le serveur Node.js
  SPI.begin();         // Initialisation du bus SPI
  rfid.PCD_Init();     // Initialisation du module RC522

  // Initialisation de l'écran LCD
  lcd.init();
  lcd.backlight();

  lcd.setCursor(0, 0);
  lcd.print("Systeme Pret...");
  lcd.setCursor(0, 1);
  lcd.print("Scan ou Btn");
}

void loop() {
  // Vérification si un message arrive depuis le serveur
  if (Serial.available() > 0) {
    String message = Serial.readStringUntil('\n'); // Lire la ligne complète
    message.trim(); // Supprimer les espaces inutiles
    afficherMessage(message);
  }

  // Vérification du bouton de pointage
  if (digitalRead(POINTAGE_BUTTON_PIN) == LOW) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Mode Pointage");
    lcd.setCursor(0, 1);
    lcd.print("Scan Carte...");
    Serial.println("POINTAGE_BUTTON_PRESSED");
    delay(500); // Anti-rebond
  }

  // Vérification du bouton de connexion
  if (digitalRead(LOGIN_BUTTON_PIN) == LOW) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Mode Connexion");
    lcd.setCursor(0, 1);
    lcd.print("Scan Carte...");
    Serial.println("LOGIN_BUTTON_PRESSED");
    delay(500); // Anti-rebond
  }

  // Vérification d'une nouvelle carte RFID
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Carte détectée
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Carte detectee");

  // Lire et envoyer l'UID avec le préfixe au serveur
  String uid = "UID: ";
  for (byte i = 0; i < rfid.uid.size; i++) {
    uid += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  // Déterminer le mode actif et envoyer les informations
  if (digitalRead(LOGIN_BUTTON_PIN) == LOW) {
    Serial.println("LOGIN_" + uid); // Mode connexion
  } else if (digitalRead(POINTAGE_BUTTON_PIN) == LOW) {
    Serial.println("POINTAGE_" + uid); // Mode pointage
  } else {
    Serial.println(uid); // UID seul si aucun bouton n'est actif
  }

  // Signaler avec le buzzer
  tone(BUZZER_PIN, 1000, 200); // Buzzer pour 200 ms

  // Attente de la réponse du serveur
  delay(1000);

  // Retour à l'état initial
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Systeme Pret...");
  lcd.setCursor(0, 1);
  lcd.print("Scan ou Btn");
}

// Fonction pour afficher les messages sur l'écran LCD
void afficherMessage(String message) {
  lcd.clear();
  lcd.setCursor(0, 0);

  // Si le message est trop long, couper à 16 caractères
  if (message.length() > 16) {
    lcd.print(message.substring(0, 16));
    lcd.setCursor(0, 1);
    lcd.print(message.substring(16, min(message.length(), 32)));
  } else {
    lcd.print(message);
  }

  // Attente avant de revenir à l'écran principal
  delay(3000);  // Laisser le message visible pendant 3 secondes
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Systeme Pret...");
  lcd.setCursor(0, 1);
  lcd.print("Scan ou Btn");
}
