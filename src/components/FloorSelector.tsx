import React from 'react';
import type { FloorPlan } from '../types';
import '../styles/FloorSelector.css';

interface FloorSelectorProps {
  floors: FloorPlan[];
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
}

export const FloorSelector: React.FC<FloorSelectorProps> = ({
  floors,
  selectedFloorId,
  onSelectFloor,
}) => {
  return (
    <div className="floor-selector">
      <h3>Floors</h3>
      <div className="floor-buttons">
        {floors.map((floor) => (
          <button
            key={floor.id}
            className={`floor-btn ${
              selectedFloorId === floor.id ? 'active' : ''
            }`}
            onClick={() => onSelectFloor(floor.id)}
          >
            {floor.name}
          </button>
        ))}
      </div>
    </div>
  );
};
