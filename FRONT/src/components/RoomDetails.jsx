import "../styles/RoomDetails.css";

export const RoomDetails = ({
  rooms,
  sensorData,
  isFullscreen = false,
  onFullscreen,
}) => {
  const sortedRooms = [...rooms].sort((a, b) => a.name.localeCompare(b.name));

  // Fonction pour obtenir la classe de couleur selon la température
  const getTempClass = (temp) => {
    if (temp === null || temp === undefined) return "";
    if (temp < 15) return "temp-cold";
    if (temp < 18) return "temp-cool";
    if (temp < 22) return "temp-normal";
    if (temp <= 25) return "temp-warm";
    return "temp-hot";
  };

  return (
    <div className={`room-details ${isFullscreen ? "fullscreen" : ""}`}>
      <div className="room-details-header">
        <h3>Détails des Salles</h3>
        {!isFullscreen && onFullscreen && (
          <button
            className="fullscreen-btn"
            onClick={onFullscreen}
            title="Plein écran"
          >
            ⛶
          </button>
        )}
      </div>
      <div className={`room-list ${isFullscreen ? "compact" : ""}`}>
        {sortedRooms.map((room) => {
          const data = sensorData.get(room.id);
          const temp = data
            ? typeof data.temperature === "number"
              ? data.temperature
              : parseFloat(data.temperature) || null
            : null;

          if (isFullscreen) {
            // Vue compacte pour le plein écran
            return (
              <div
                key={room.id}
                className={`room-card-compact ${getTempClass(temp)}`}
              >
                <div className="compact-name">{room.name}</div>
                <div className="compact-status">
                  <span
                    className={`status-dot ${data?.occupied ? "occupied" : "empty"}`}
                  ></span>
                </div>
                <div className="compact-temp">
                  {temp !== null ? `${temp.toFixed(1)}°C` : "-"}
                </div>
              </div>
            );
          }

          return (
            <div key={room.id} className="room-card">
              <div className="room-header">
                <h4>{room.name}</h4>
                <span
                  className={`status-badge ${
                    data?.occupied ? "occupied" : "empty"
                  }`}
                >
                  {data?.occupied ? "Occupée" : "Vide"}
                </span>
              </div>

              <div className="room-info">
                {data ? (
                  <>
                    <div className="info-item">
                      <span className="label">Température:</span>
                      <span className="value">
                        {(typeof data.temperature === "number"
                          ? data.temperature
                          : parseFloat(data.temperature) || 0
                        ).toFixed(1)}
                        °C
                      </span>
                    </div>
                    {data.humidity && (
                      <div className="info-item">
                        <span className="label">Humidité:</span>
                        <span className="value">{data.humidity}%</span>
                      </div>
                    )}
                    <div className="info-item">
                      <span className="label">Dernière mise à jour:</span>
                      <span className="value">
                        {new Date(data.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="no-data">
                    Aucune donnée de capteur disponible
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
