import "../styles/ConnectionStatus.css";

export const ConnectionStatus = ({
  isConnected,
  isApiConnected,
  isMqttConnected,
  error,
}) => {
  const getStatusClass = () => {
    if (isApiConnected && isMqttConnected) return "connected";
    if (isApiConnected || isMqttConnected) return "partial";
    return "disconnected";
  };

  const getStatusText = () => {
    if (isApiConnected && isMqttConnected) return "Connecté (API + MQTT)";
    if (isApiConnected) return "API connectée";
    if (isMqttConnected) return "MQTT connecté";
    if (isConnected) return "Connecté";
    return "Déconnecté";
  };

  return (
    <div className={`connection-status ${getStatusClass()}`}>
      <div className="status-indicator">
        <div className="status-dots">
          <div
            className={`status-dot ${isApiConnected ? "active" : ""}`}
            title="API"
          />
          <div
            className={`status-dot mqtt ${isMqttConnected ? "active" : ""}`}
            title="MQTT"
          />
        </div>
        <span>{getStatusText()}</span>
      </div>
      {error && <div className="error-text">{error}</div>}
    </div>
  );
};
