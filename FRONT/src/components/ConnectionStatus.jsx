import '../styles/ConnectionStatus.css';

export const ConnectionStatus = ({
  isConnected,
  error,
}) => {
  return (
    <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
      <div className="status-indicator">
        <div className={`status-dot ${isConnected ? 'active' : ''}`} />
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
      {error && <div className="error-text">{error}</div>}
    </div>
  );
};
