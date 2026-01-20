# 🏢 Building Monitoring System

Une application web React avec Vite pour visualiser et monitorer un plan de bâtiment en temps réel, affichant la présence de personnes et la température de chaque salle via MQTT.

## 🎯 Fonctionnalités

- **Visualisation du plan de bâtiment** : Affichage interactif des étages et salles
- **Détection de présence** : Indicateur visuel de la présence/absence de personnes
- **Température en temps réel** : Affichage de la température avec code couleur
- **Indicateur MQTT** : État de connexion au broker MQTT
- **Sélection d'étages** : Navigation entre les différents étages du bâtiment
- **Détails des salles** : Liste détaillée des informations de chaque salle
- **Interface réactive** : Design moderne et responsif

## 📋 Prérequis

- Node.js 16+ et npm
- Un broker MQTT accessible (ex: HiveMQ Cloud, Mosquitto, etc.)

## 🚀 Installation et démarrage

### 1. Installation des dépendances

```bash
npm install
```

### 2. Lancer le serveur de développement

```bash
npm run dev
```

L'application s'ouvrira sur `http://localhost:5173/`

### 3. Build pour la production

```bash
npm run build
```

## 🔧 Configuration MQTT

### Connexion au broker MQTT

1. Ouvrez l'application dans votre navigateur
2. Remplissez les paramètres de connexion MQTT :
   - **Broker URL** : Adresse du broker MQTT (ex: `broker.hivemq.com`)
   - **Port** : Port du broker (défaut: 8883 pour WSS)
   - **Client ID** : Identifiant unique du client (généré automatiquement)
   - **Username** (optionnel) : Nom d'utilisateur
   - **Password** (optionnel) : Mot de passe
3. Cliquez sur "Connect"

### Format des messages MQTT

L'application s'attend à recevoir des messages JSON sur les topics MQTT structurés comme suit :

```
Building/[floor]/[room]/sensor
```

**Format du payload :**
```json
{
  "occupied": true,
  "temperature": 22.5,
  "humidity": 45,
  "timestamp": 1673280000000
}
```

**Exemple de topics :**
- `building/floor1/room1/sensor`
- `building/floor1/room2/sensor`
- `building/floor2/room1/sensor`

### Exemple avec MQTT.js (Node.js)

```javascript
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://broker.hivemq.com');

client.on('connect', () => {
  // Publier des données de capteur
  client.publish('building/floor1/room1/sensor', JSON.stringify({
    occupied: true,
    temperature: 22.5,
    humidity: 45,
    timestamp: Date.now()
  }));
});
```

## 📁 Structure du projet

```
src/
├── components/
│   ├── BuildingFloorPlan.tsx    # Visualisation du plan d'étage
│   ├── ConnectionStatus.tsx     # Indicateur de connexion MQTT
│   ├── FloorSelector.tsx        # Sélecteur d'étages
│   ├── MQTTConfigPanel.tsx      # Configuration MQTT
│   └── RoomDetails.tsx          # Détails des salles
├── hooks/
│   └── useMQTT.ts              # Hook personnalisé pour MQTT
├── services/
│   └── mqttService.ts          # Service MQTT
├── store/
│   └── buildingStore.ts        # État global Zustand
├── styles/
│   ├── App.css                 # Styles principaux
│   ├── BuildingFloorPlan.css   # Styles du plan
│   ├── ConnectionStatus.css    # Styles connexion
│   ├── FloorSelector.css       # Styles sélecteur
│   ├── MQTTConfig.css          # Styles configuration
│   └── RoomDetails.css         # Styles détails
├── types/
│   └── index.ts                # Définitions TypeScript
├── App.tsx                     # Composant principal
├── main.tsx                    # Point d'entrée
└── index.css                   # Styles globaux
```

## 🎨 Indicateurs visuels

### Code couleur de température
- 🔵 **Bleu** : < 15°C (Froid)
- 🟢 **Vert** : 15-18°C (Cool)
- 🟠 **Orange** : 18-22°C (Normal)
- 🔴 **Rouge** : 22-25°C (Chaud)
- 🟣 **Rouge foncé** : > 25°C (Très chaud)

### Indicateurs de présence
- ✅ Bordure rouge autour de la salle si occupée
- ⭕ Animation pulsar autour du centre de la salle
- ❌ Salle grisée si vide

## 🏗️ Technologies utilisées

- **React 18** : Framework UI
- **TypeScript** : Langage de programmation typé
- **Vite** : Build tool ultra-rapide
- **MQTT.js** : Client MQTT pour WebSocket
- **Zustand** : Gestion d'état minimaliste
- **CSS3** : Styles modernes avec Flexbox et Grid

## 🔌 Intégration avec des capteurs IoT

Pour connecter des capteurs IoT réels :

### Arduino/ESP32 avec capteurs

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

#define DHT_PIN 4
DHT dht(DHT_PIN, DHT22);
WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  WiFi.begin(ssid, password);
  client.setServer(mqtt_server, 8883);
  dht.begin();
}

void publishSensorData() {
  float temp = dht.readTemperature();
  float humidity = dht.readHumidity();
  bool occupied = digitalRead(PIR_PIN);

  String payload = "{\"occupied\":" + String(occupied) + 
                   ",\"temperature\":" + String(temp) + 
                   ",\"humidity\":" + String(humidity) + 
                   ",\"timestamp\":" + String(millis()) + "}";

  client.publish("building/floor1/room1/sensor", payload.c_str());
}
```

## 📱 Interface utilisateur

### Vue principale
- **Header** : Titre de l'application et état de connexion
- **Sidebar** : Configuration MQTT, sélecteur d'étages, détails des salles
- **Contenu principal** : Visualisation du plan d'étage
- **Footer** : Dernière mise à jour

## 🐛 Dépannage

### Impossible de se connecter au broker MQTT
- Vérifiez l'URL du broker
- Vérifiez le port (8883 pour WSS)
- Assurez-vous que le broker supporte WebSocket
- Vérifiez les pare-feu et les règles de réseau

### Les données de capteur ne s'affichent pas
- Vérifiez le format des messages MQTT
- Vérifiez que les topics respectent le format : `building/floor/room/sensor`
- Vérifiez la console du navigateur pour les erreurs

### Performance lente
- Réduisez la fréquence de publication des capteurs
- Utilisez la compression MQTT
- Vérifiez la latence réseau

## 📄 Licence

MIT

## 👨‍💻 Développement

### Scripts disponibles

```bash
npm run dev      # Démarrer le serveur de développement
npm run build    # Build pour la production
npm run preview  # Prévisualiser la build de production
npm run lint     # Vérifier le linting
```

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à soumettre des pull requests.

## 📞 Support

Pour toute question ou problème, veuillez ouvrir une issue dans le repository.

---

**Créé avec ❤️ pour la surveillance de bâtiments IoT**

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
