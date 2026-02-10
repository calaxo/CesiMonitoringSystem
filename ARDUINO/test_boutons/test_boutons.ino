/*
 * ===============================
 * TEST BOUTONS GROVE - ESP32
 * ===============================
 * 
 * Code minimal pour tester les boutons sur GPIO 32, 33, 34, 35
 * 
 * Câblage module Grove bouton:
 *   - VCC -> 3.3V
 *   - GND -> GND  
 *   - SIG -> GPIO (32, 33, 34 ou 35)
 */

// Pins boutons
#define BTN1_PIN 32
#define BTN2_PIN 33
#define BTN3_PIN 34
#define BTN4_PIN 35

void setup()
{
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n========================================");
    Serial.println("       TEST BOUTONS GROVE ESP32");
    Serial.println("========================================\n");
    
    // Configuration des pins
    // Note: GPIO 34 et 35 sont INPUT ONLY (pas de pull-up/down interne)
    pinMode(BTN1_PIN, INPUT_PULLDOWN);
    pinMode(BTN2_PIN, INPUT_PULLDOWN);
    pinMode(BTN3_PIN, INPUT);  // GPIO34 - input only
    pinMode(BTN4_PIN, INPUT);  // GPIO35 - input only
    
    Serial.println("[CONFIG] Pins configures:");
    Serial.println("  GPIO32: INPUT_PULLDOWN");
    Serial.println("  GPIO33: INPUT_PULLDOWN");
    Serial.println("  GPIO34: INPUT (input-only, pas de pull)");
    Serial.println("  GPIO35: INPUT (input-only, pas de pull)");
    Serial.println();
    
    // Test immediat
    Serial.println("[TEST] Lecture initiale des pins:");
    Serial.printf("  BTN1 (GPIO32) = %d\n", digitalRead(BTN1_PIN));
    Serial.printf("  BTN2 (GPIO33) = %d\n", digitalRead(BTN2_PIN));
    Serial.printf("  BTN3 (GPIO34) = %d\n", digitalRead(BTN3_PIN));
    Serial.printf("  BTN4 (GPIO35) = %d\n", digitalRead(BTN4_PIN));
    Serial.println();
    
    Serial.println("========================================");
    Serial.println("Appuie sur les boutons pour tester...");
    Serial.println("Les valeurs s'affichent toutes les 200ms");
    Serial.println("========================================\n");
}

// Variables pour detection de changement
int lastBtn1 = -1, lastBtn2 = -1, lastBtn3 = -1, lastBtn4 = -1;

void loop()
{
    // Lecture des boutons
    int btn1 = digitalRead(BTN1_PIN);
    int btn2 = digitalRead(BTN2_PIN);
    int btn3 = digitalRead(BTN3_PIN);
    int btn4 = digitalRead(BTN4_PIN);
    
    // Afficher si changement detecte
    bool changed = false;
    
    if (btn1 != lastBtn1) {
        Serial.printf("[BTN1] GPIO32: %d -> %d  %s\n", lastBtn1, btn1, btn1 ? "HAUT" : "BAS");
        lastBtn1 = btn1;
        changed = true;
    }
    
    if (btn2 != lastBtn2) {
        Serial.printf("[BTN2] GPIO33: %d -> %d  %s\n", lastBtn2, btn2, btn2 ? "HAUT" : "BAS");
        lastBtn2 = btn2;
        changed = true;
    }
    
    if (btn3 != lastBtn3) {
        Serial.printf("[BTN3] GPIO34: %d -> %d  %s\n", lastBtn3, btn3, btn3 ? "HAUT" : "BAS");
        lastBtn3 = btn3;
        changed = true;
    }
    
    if (btn4 != lastBtn4) {
        Serial.printf("[BTN4] GPIO35: %d -> %d  %s\n", lastBtn4, btn4, btn4 ? "HAUT" : "BAS");
        lastBtn4 = btn4;
        changed = true;
    }
    
    // Affichage periodique (toutes les 2 secondes)
    static unsigned long lastPrint = 0;
    if (millis() - lastPrint > 2000) {
        lastPrint = millis();
        Serial.printf("ETAT: B1=%d  B2=%d  B3=%d  B4=%d\n", btn1, btn2, btn3, btn4);
    }
    
    delay(50);  // 50ms pour debounce basique
}
