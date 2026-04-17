#include <LiquidCrystal.h>

// RS, E, D4, D5, D6, D7
LiquidCrystal lcd(23, 4, 2, 19, 18, 5);
int contrastPin = 25;

// code pou utiliser un LC classique 16x2 bleu type arduino avec ESP32(4 calbe relié pas de i2c)
//  alimenter en 5v, gestion luminosité via 3v pour pas trop de luminosité et sans passer par résistance
//  contraste des deux fil gerer sans potentiometre avec juste une des deux fil sur 3.3V

void setup()
{
  pinMode(contrastPin, OUTPUT);
  analogWrite(contrastPin, 40); // valeur faible
  lcd.begin(16, 2);
  lcd.print("test esp32 lcd");
}

void loop()
{
}
