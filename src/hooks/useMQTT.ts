import { useEffect, useState, useCallback } from 'react';
import { mqttService } from '../services/mqttService';
import type { MQTTConfig } from '../types';
import { useBuildingStore } from '../store/buildingStore';

export const useMQTT = (config: MQTTConfig | null) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, setConnectionStatus, setError: setStoreError } =
    useBuildingStore();

  const connect = useCallback(async () => {
    if (!config || isConnected) return;

    setIsConnecting(true);
    try {
      await mqttService.connect(config);
      setError(null);

      // Subscribe to sensor topics
      mqttService.subscribe('building/+/+/sensor');
      mqttService.subscribe('building/status');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
      setStoreError(message);
    } finally {
      setIsConnecting(false);
    }
  }, [config, isConnected, setStoreError]);

  const disconnect = useCallback(() => {
    mqttService.disconnect();
    setConnectionStatus(false);
  }, [setConnectionStatus]);

  const publish = useCallback(
    (topic: string, message: any) => {
      if (!isConnected) {
        setError('Not connected to MQTT broker');
        return;
      }
      mqttService.publish(topic, message);
    },
    [isConnected]
  );

  useEffect(() => {
    if (config && !isConnected) {
      connect();
    }

    return () => {
      // Cleanup on unmount
    };
  }, [config, isConnected, connect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    publish,
  };
};
