import React from 'react';
import '../styles/ConnectionStatus.css';

interface ConnectionStatusProps {
  isConnected: boolean;
  error?: string | null;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
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
