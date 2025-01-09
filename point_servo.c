#include <SPI.h>
#include <MFRC522.h>
#include <Servo.h>

#define RST_PIN 5
#define SS_PIN 53
#define SERVO_PIN 9 // Broche pour le signal du servo moteur

MFRC522 rfid(SS_PIN, RST_PIN);
Servo porteServo;

void setup() {
    Serial.begin(9600);
    SPI.begin();
    rfid.PCD_Init();

    // Initialisation du servo
    porteServo.attach(SERVO_PIN);
    porteServo.write(0); // Porte fermée (angle 0°)
}

void loop() {
    // Vérifier si une nouvelle carte est détectée
    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

    // Lire l'UID de la carte
    String uid = "UID: ";
    for (byte i = 0; i < rfid.uid.size; i++) {
        uid += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "") + String(rfid.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();

    // Afficher l'UID sur le port série
    Serial.println(uid);

    // Ouvrir la "porte" (servo à 90°)
    porteServo.write(90);
    Serial.println("Porte ouverte");
    
    delay(5000); // Attendre 5 secondes (porte ouverte)

    // Fermer la "porte" (servo à 0°)
    porteServo.write(0);
    Serial.println("Porte fermée");
    
    delay(1000); // Pause pour éviter des lectures multiples de la même carte
}

