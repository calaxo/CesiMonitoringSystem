import mqtt from 'mqtt';
import { useBuildingStore } from '../store/buildingStore';

export class MQTTService {
  client = null;
  messageHandlers = new Map();

  async connect(config) {
    return new Promise((resolve, reject) => {
      try {

        const options = {
          clientId: config.clientId || `mqtt-client-${Date.now()}`,
          username: config.username,
          password: config.password,
          reconnectPeriod: 1000,
          connectTimeout: 30 * 1000,
          protocol: 'wss', // Use WebSocket Secure
        };

        const brokerUrl = config.brokerUrl.startsWith('ws')
          ? config.brokerUrl
          : `wss://${config.brokerUrl}:${config.port || 8883}/mqtt`;

        this.client = mqtt.connect(brokerUrl, options);

        this.client.on('connect', () => {
          console.log('MQTT Connected');
          useBuildingStore.getState().setConnectionStatus(true);
          useBuildingStore.getState().setError(null);
          resolve();
        });

        this.client.on('message', (topic, message) => {
          try {
            const payload = JSON.parse(message.toString());
            this.handleMessage(topic, payload);
          } catch (error) {
            console.error('Error parsing MQTT message:', error);
          }
        });

        this.client.on('error', (error) => {
          console.error('MQTT Error:', error);
          useBuildingStore.getState().setError(`MQTT Error: ${error.message}`);
          reject(error);
        });

        this.client.on('disconnect', () => {
          console.log('MQTT Disconnected');
          useBuildingStore.getState().setConnectionStatus(false);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }

  subscribe(topic, callback) {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }

    if (callback) {
      this.messageHandlers.set(topic, callback);
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${topic}:`, err);
      } else {
        console.log(`Subscribed to ${topic}`);
      }
    });
  }

  unsubscribe(topic) {
    if (!this.client) return;

    this.messageHandlers.delete(topic);
    this.client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to unsubscribe from ${topic}:`, err);
      }
    });
  }

  publish(topic, message) {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }

    this.client.publish(topic, JSON.stringify(message), { qos: 1 }, (err) => {
      if (err) {
        console.error(`Failed to publish to ${topic}:`, err);
      }
    });
  }

  handleMessage(topic, payload) {
    // Handle sensor data messages
    if (topic.includes('sensor')) {
      this.handleSensorData(topic, payload);
    }

    // Call any registered handlers for this topic
    const handler = this.messageHandlers.get(topic);
    if (handler) {
      handler(payload);
    }
  }

  handleSensorData(topic, payload) {
    // Extract room ID from topic (e.g., "building/floor1/room1/sensor")
    const parts = topic.split('/');
    const roomId = parts[2] || 'unknown';

    const sensorData = {
      roomId,
      occupied: payload.occupied !== undefined ? payload.occupied : false,
      temperature: payload.temperature || 0,
      humidity: payload.humidity,
      timestamp: payload.timestamp || Date.now(),
    };

    useBuildingStore.getState().updateSensorData(roomId, sensorData);
  }

  isConnected() {
    return this.client?.connected || false;
  }

  getClient() {
    return this.client;
  }
}

export const mqttService = new MQTTService();
