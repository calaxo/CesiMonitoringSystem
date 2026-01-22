import React from 'react';
import type { Room, SensorData } from '../types';
import '../styles/BuildingFloorPlan.css';

interface BuildingFloorPlanProps {
  rooms: Room[];
  sensorData: Map<string, SensorData>;
  floorName: string;
}

export const BuildingFloorPlan: React.FC<BuildingFloorPlanProps> = ({
  rooms,
  sensorData,
  floorName,
}) => {
  const getRoomStatus = (roomId: string): SensorData | undefined => {
    return sensorData.get(roomId);
  };

  const getTemperatureColor = (temp: number): string => {
    if (temp < 15) return '#4a90e2'; // Blue - Cold
    if (temp < 18) return '#7ed321'; // Green - Cool
    if (temp < 22) return '#f5a623'; // Orange - Normal
    if (temp < 25) return '#e74c3c'; // Red - Warm
    return '#c0392b'; // Dark Red - Very Hot
  };

  // Calculate canvas dimensions - ENLARGED
  const padding = 10;
  const maxWidth = 1500;
  const maxHeight = 750;
  const roomScale = 40; // Scale factor for rooms

  return (
    <div className="building-floor-plan">
      <h2>{floorName}</h2>
      <div className="plan-container">
        <svg
          className="floor-plan-svg"
          preserveAspectRatio="xMidYMid meet"
          viewBox={`0 0 ${maxWidth} ${maxHeight}`}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Background */}
          <rect width={maxWidth} height={maxHeight} fill="#f5f5f5" />

          {/* Grid lines for reference */}
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path
                d="M 50 0 L 0 0 0 50"
                fill="none"
                stroke="#e0e0e0"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width={maxWidth} height={maxHeight} fill="url(#grid)" />

          {/* Rooms */}
          {rooms.map((room) => {
            const roomData = getRoomStatus(room.id);
            const isOccupied = roomData?.occupied || false;
            const temp = roomData?.temperature || 20;
            const tempColor = getTemperatureColor(temp);

            const x = padding + room.x * roomScale;
            const y = padding + room.y * roomScale;
            const width = room.width * roomScale;
            const height = room.height * roomScale;

            return (
              <g key={room.id} className="room-group">
                {/* Room background */}
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={isOccupied ? '#ffe6e6' : '#f0f0f0'}
                  stroke={isOccupied ? '#e74c3c' : '#999'}
                  strokeWidth="2"
                  className="room-rect"
                />

                {/* Temperature indicator bar */}
                <rect
                  x={x}
                  y={y}
                  width={8}
                  height={height}
                  fill={tempColor}
                  className="temp-indicator"
                />

                {/* Presence indicator */}
                {isOccupied && (
                  <circle
                    cx={x + width / 2}
                    cy={y + height / 2}
                    r="15"
                    fill="none"
                    stroke="#e74c3c"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="presence-indicator"
                  >
                    <animate
                      attributeName="r"
                      from="15"
                      to="20"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Room label */}
                <text
                  x={x + width / 2}
                  y={y + height / 2 - 10}
                  textAnchor="middle"
                  className="room-label"
                  fontSize="16"
                  fontWeight="bold"
                >
                  {room.name}
                </text>

                {/* Temperature text */}
                {roomData && (
                  <text
                    x={x + width / 2}
                    y={y + height / 2 + 15}
                    textAnchor="middle"
                    className="room-temp"
                    fontSize="15"
                    fill={tempColor}
                    fontWeight="bold"
                  >
                    {temp.toFixed(1)}°C
                  </text>
                )}

                {/* Status text */}
                <text
                  x={x + width / 2}
                  y={y + height - 8}
                  textAnchor="middle"
                  className="room-status"
                  fontSize="14"
                  fill={isOccupied ? '#e74c3c' : '#999'}
                >
                  {isOccupied ? '👤 Occupied' : 'Empty'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#4a90e2' }} />
          <span>&lt; 15°C</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#7ed321' }} />
          <span>15 - 18°C</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#f5a623' }} />
          <span>18 - 22°C</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#e74c3c' }} />
          <span>22 - 25°C</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#c0392b' }} />
          <span>&gt; 25°C</span>
        </div>
      </div>
    </div>
  );
};
