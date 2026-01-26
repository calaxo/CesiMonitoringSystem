import mqtt from 'mqtt';
import { useBuildingStore } from '../store/buildingStore';

export class MQTTService {
  client = null;
  messageHandlers = new Map();
  connectionAttempts = 0;
  maxConnectionAttempts = 5;

  async connect(config) {
    return new Promise((resolve, reject) => {
      try {

        const options = {
          clientId: config.clientId || `mqtt-client-${Date.now()}`,
          username: config.username,
          password: config.password,
          reconnectPeriod: this.connectionAttempts >= this.maxConnectionAttempts ? 0 : 1000,
          connectTimeout: 30 * 1000,
        };

        // Determine the protocol and format the URL
        let brokerUrl = config.brokerUrl;
        
        if (!brokerUrl.startsWith('mqtt://') && !brokerUrl.startsWith('mqtts://') && 
            !brokerUrl.startsWith('ws://') && !brokerUrl.startsWith('wss://')) {
          // URL without protocol - add it based on config
          const protocol = config.protocol || 'mqtt'; // mqtt, mqtts, ws, wss
          const port = config.port || (protocol === 'mqtts' ? 8883 : protocol.includes('ws') ? 8080 : 1883);
          
          if (protocol === 'ws' || protocol === 'wss') {
            brokerUrl = `${protocol}://${config.brokerUrl}:${port}/mqtt`;
          } else {
            brokerUrl = `${protocol}://${config.brokerUrl}:${port}`;
          }
        }

        console.log('Connecting to MQTT broker:', brokerUrl);
        this.client = mqtt.connect(brokerUrl, options);

        // Set a timeout for connection attempt
        const connectionTimeout = setTimeout(() => {
          if (this.client && !this.client.connected) {
            console.error('MQTT Connection timeout');
            this.connectionAttempts++;
            this.client.end();
            this.client = null;
            
            const errorMessage = this.connectionAttempts >= this.maxConnectionAttempts
              ? `Connection failed after ${this.maxConnectionAttempts} attempts. Please check your broker settings.`
              : `Connection timeout - unable to reach broker (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`;
            
            const error = new Error(errorMessage);
            useBuildingStore.getState().setError(`MQTT Error: ${errorMessage}`);
            useBuildingStore.getState().setConnectionStatus(false);
            
            if (this.connectionAttempts >= this.maxConnectionAttempts) {
              this.connectionAttempts = 0; // Reset for next user attempt
            }
            reject(error);
          }
        }, 35000); // Slightly more than connectTimeout

        this.client.on('connect', () => {
          clearTimeout(connectionTimeout);
          this.connectionAttempts = 0; // Reset on successful connection
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
          clearTimeout(connectionTimeout);
          this.connectionAttempts++;
          console.error('MQTT Error:', error);
          
          // Disable reconnect after max attempts
          if (this.connectionAttempts >= this.maxConnectionAttempts) {
            this.client.end();
            this.client = null;
            const errorMessage = `Connection failed after ${this.maxConnectionAttempts} attempts. Please check your broker settings.`;
            useBuildingStore.getState().setError(`MQTT Error: ${errorMessage}`);
            useBuildingStore.getState().setConnectionStatus(false);
            this.connectionAttempts = 0; // Reset for next user attempt
            reject(new Error(errorMessage));
          } else {
            const errorMessage = error.message || 'Unknown connection error';
            useBuildingStore.getState().setError(`MQTT Error: ${errorMessage} (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`);
            useBuildingStore.getState().setConnectionStatus(false);
          }
        });

        this.client.on('disconnect', () => {
          console.log('MQTT Disconnected');
          useBuildingStore.getState().setConnectionStatus(false);
        });
      } catch (error) {
        this.connectionAttempts++;
        console.error('MQTT Connection error:', error);
        useBuildingStore.getState().setError(`MQTT Error: ${error.message}`);
        useBuildingStore.getState().setConnectionStatus(false);
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
