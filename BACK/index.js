require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { setupWebRoutes, setup404Handler } = require("./web");
const { setupApiRoutes } = require("./api");
const { initDatabase, closeDatabase } = require("./db");
const { initMQTT, closeMQTT } = require("./mqtt");

const app = express();

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration des routes
setupApiRoutes(app);    // Routes API (/api/...)
setupWebRoutes(app);    // Routes web statiques
setup404Handler(app);   // Handler 404 (doit être en dernier)

/**
 * Démarre le serveur
 */
async function startServer() {
  try {
    // Initialiser la base de données
    console.log("Démarrage du serveur...");
    await initDatabase();

    // Initialiser MQTT (optionnel - continue même en cas d'échec)
    try {
      await initMQTT();
    } catch (err) {
      console.warn("MQTT non disponible:", err.message);
      console.warn("Le serveur continue sans MQTT");
    }

    // Démarrer le serveur HTTP
    const PORT = process.env.PORT || 5500;
    const server = app.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT}`);
      console.log(`- Web: http://localhost:${PORT}`);
      console.log(`- API: http://localhost:${PORT}/api`);
    });

    // Gestion de l'arrêt propre
    const shutdown = async (signal) => {
      console.log(`\nSignal ${signal} reçu. Arrêt en cours...`);
      
      server.close(async () => {
        await closeMQTT();
        await closeDatabase();
        console.log("Serveur arrêté proprement");
        process.exit(0);
      });

      // Force exit après 10 secondes
      setTimeout(() => {
        console.error("Arrêt forcé après timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (err) {
    console.error("Erreur fatale au démarrage:", err);
    process.exit(1);
  }
}

// Démarrer le serveur
startServer();