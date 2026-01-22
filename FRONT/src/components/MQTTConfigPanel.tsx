import React, { useState } from 'react';
import type { MQTTConfig } from '../types';
import '../styles/MQTTConfig.css';

interface MQTTConfigProps {
  onConnect: (config: MQTTConfig) => void;
  isConnecting: boolean;
  error?: string | null;
}

export const MQTTConfigPanel: React.FC<MQTTConfigProps> = ({
  onConnect,
  isConnecting,
  error,
}) => {
  const [brokerUrl, setBrokerUrl] = useState(
    'broker.hivemq.com'
  );
  const [clientId, setClientId] = useState(
    `mqtt-client-${Math.random().toString(36).substr(2, 9)}`
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [port, setPort] = useState(8883);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();

    const config: MQTTConfig = {
      brokerUrl,
      clientId,
      username: username || undefined,
      password: password || undefined,
      port,
    };

    onConnect(config);
  };

  return (
    <div className="mqtt-config-panel">
      <h3>MQTT Configuration</h3>
      <form onSubmit={handleConnect}>
        <div className="form-group">
          <label>Broker URL:</label>
          <input
            type="text"
            value={brokerUrl}
            onChange={(e) => setBrokerUrl(e.target.value)}
            placeholder="e.g., broker.hivemq.com"
          />
        </div>

        <div className="form-group">
          <label>Port:</label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Client ID:</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Username (optional):</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Leave empty if not required"
          />
        </div>

        <div className="form-group">
          <label>Password (optional):</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty if not required"
          />
        </div>

        <button type="submit" disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>

        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
};
