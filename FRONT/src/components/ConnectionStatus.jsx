import "../styles/ConnectionStatus.css";

export const ConnectionStatus = ({ isConnected, isApiConnected, error }) => {
  const getStatusClass = () => {
    if (isApiConnected) return "connected";
    if (isConnected) return "partial";
    return "disconnected";
  };

  const getStatusText = () => {
    if (isApiConnected) return "API connectée";
    if (isConnected) return "Connecté";
    return "Déconnecté";
  };

  return (
    <div className={`connection-status ${getStatusClass()}`}>
      <div className="status-indicator">
        <div
          className={`status-dot ${isApiConnected ? "active" : ""}`}
          title="API"
        />
        <span>{getStatusText()}</span>
      </div>
      {error && <div className="error-text">{error}</div>}
    </div>
  );
};
