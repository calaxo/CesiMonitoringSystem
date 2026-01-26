import "../styles/RoomDetails.css";

export const RoomDetails = ({ rooms, sensorData }) => {
  const sortedRooms = [...rooms].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="room-details">
      <h3>Détails des Salles</h3>
      <div className="room-list">
        {sortedRooms.map((room) => {
          const data = sensorData.get(room.id);
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
