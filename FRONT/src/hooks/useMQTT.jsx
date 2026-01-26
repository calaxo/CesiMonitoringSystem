import { useEffect, useState, useCallback } from "react";
import { mqttService } from "../services/mqttService";
import { useBuildingStore } from "../store/buildingStore";

export const useMQTT = (config) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const {
    isMqttConnected,
    setMqttConnectionStatus,
    setError: setStoreError,
  } = useBuildingStore();

  const connect = useCallback(async () => {
    if (!config || isMqttConnected) return;

    setIsConnecting(true);
    try {
      await mqttService.connect(config);
      setError(null);

      // Subscribe to sensor topics
      mqttService.subscribe("building/+/+/sensor");
      mqttService.subscribe("building/status");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setError(message);
      setStoreError(message);
    } finally {
      setIsConnecting(false);
    }
  }, [config, isMqttConnected, setStoreError]);

  const disconnect = useCallback(() => {
    mqttService.disconnect();
    setMqttConnectionStatus(false);
  }, [setMqttConnectionStatus]);

  const publish = useCallback(
    (topic, message) => {
      if (!isMqttConnected) {
        setError("Not connected to MQTT broker");
        return;
      }
      mqttService.publish(topic, message);
    },
    [isMqttConnected],
  );

  useEffect(() => {
    if (config && !isMqttConnected) {
      connect();
    }

    return () => {
      // Cleanup on unmount
    };
  }, [config, isMqttConnected, connect]);

  return {
    isConnected: isMqttConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    publish,
  };
};
