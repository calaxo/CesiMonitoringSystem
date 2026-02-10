#include <LiquidCrystal.h>

// RS, E, D4, D5, D6, D7
LiquidCrystal lcd(23, 4, 2, 19, 18, 5);
int contrastPin = 25;


void setup() {
  pinMode(contrastPin, OUTPUT);
  analogWrite(contrastPin, 40); // valeur faible
  lcd.begin(16, 2);
  lcd.print("Hello ESP32");
}

void loop() {
}
