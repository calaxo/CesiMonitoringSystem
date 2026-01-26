import '../styles/FloorSelector.css';

export const FloorSelector = ({
  floors,
  selectedFloorId,
  onSelectFloor,
}) => {
  return (
    <div className="floor-selector">
      <h3>Étages</h3>
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
