import mqtt from 'mqtt';
import type { MQTTConfig, SensorData } from '../types';
import { useBuildingStore } from '../store/buildingStore';

export class MQTTService {
  private client: mqtt.MqttClient | null = null;
  private messageHandlers: Map<string, (message: any) => void> = new Map();

  async connect(config: MQTTConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {

        const options = {
          clientId: config.clientId || `mqtt-client-${Date.now()}`,
          username: config.username,
          password: config.password,
          reconnectPeriod: 1000,
          connectTimeout: 30 * 1000,
          protocol: 'wss' as const, // Use WebSocket Secure
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

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }

  subscribe(topic: string, callback?: (message: any) => void): void {
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

  unsubscribe(topic: string): void {
    if (!this.client) return;

    this.messageHandlers.delete(topic);
    this.client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to unsubscribe from ${topic}:`, err);
      }
    });
  }

  publish(topic: string, message: any): void {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }

    this.client.publish(topic, JSON.stringify(message), { qos: 1 }, (err) => {
      if (err) {
        console.error(`Failed to publish to ${topic}:`, err);
      }
    });
  }

  private handleMessage(topic: string, payload: any): void {
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

  private handleSensorData(topic: string, payload: any): void {
    // Extract room ID from topic (e.g., "building/floor1/room1/sensor")
    const parts = topic.split('/');
    const roomId = parts[2] || 'unknown';

    const sensorData: SensorData = {
      roomId,
      occupied: payload.occupied !== undefined ? payload.occupied : false,
      temperature: payload.temperature || 0,
      humidity: payload.humidity,
      timestamp: payload.timestamp || Date.now(),
    };

    useBuildingStore.getState().updateSensorData(roomId, sensorData);
  }

  isConnected(): boolean {
    return this.client?.connected || false;
  }

  getClient(): mqtt.MqttClient | null {
    return this.client;
  }
}

export const mqttService = new MQTTService();
