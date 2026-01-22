import React from 'react';
import type { Room, SensorData } from '../types';
import '../styles/RoomDetails.css';

interface RoomDetailsProps {
  rooms: Room[];
  sensorData: Map<string, SensorData>;
}

export const RoomDetails: React.FC<RoomDetailsProps> = ({
  rooms,
  sensorData,
}) => {
  const sortedRooms = [...rooms].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="room-details">
      <h3>Room Details</h3>
      <div className="room-list">
        {sortedRooms.map((room) => {
          const data = sensorData.get(room.id);
          return (
            <div key={room.id} className="room-card">
              <div className="room-header">
                <h4>{room.name}</h4>
                <span
                  className={`status-badge ${
                    data?.occupied ? 'occupied' : 'empty'
                  }`}
                >
                  {data?.occupied ? '👤 Occupied' : 'Empty'}
                </span>
              </div>

              <div className="room-info">
                {data ? (
                  <>
                    <div className="info-item">
                      <span className="label">Temperature:</span>
                      <span className="value">
                        {data.temperature.toFixed(1)}°C
                      </span>
                    </div>
                    {data.humidity && (
                      <div className="info-item">
                        <span className="label">Humidity:</span>
                        <span className="value">{data.humidity}%</span>
                      </div>
                    )}
                    <div className="info-item">
                      <span className="label">Last Update:</span>
                      <span className="value">
                        {new Date(data.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="no-data">No sensor data available</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
