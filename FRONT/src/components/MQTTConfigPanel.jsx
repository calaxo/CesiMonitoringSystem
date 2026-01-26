import { useState } from 'react';
import '../styles/MQTTConfig.css';

export const MQTTConfigPanel = ({
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

  const handleConnect = (e) => {
    e.preventDefault();

    const config = {
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
      <h3>Configuration MQTT</h3>
      <form onSubmit={handleConnect}>
        <div className="form-group">
          <label>URL du Broker:</label>
          <input
            type="text"
            value={brokerUrl}
            onChange={(e) => setBrokerUrl(e.target.value)}
            placeholder="ex: broker.hivemq.com"
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
          <label>ID Client:</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Nom d'utilisateur (optionnel):</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Laisser vide si non requis"
          />
        </div>

        <div className="form-group">
          <label>Mot de passe (optionnel):</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Laisser vide si non requis"
          />
        </div>

        <button type="submit" disabled={isConnecting}>
          {isConnecting ? 'Connexion...' : 'Se connecter'}
        </button>

        {error && <div className="error-message">{error}</div>}
      </form>
    </div>
  );
};
