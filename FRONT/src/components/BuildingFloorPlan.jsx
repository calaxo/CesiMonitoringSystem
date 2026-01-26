import { useState, useEffect, useRef } from "react";
import "../styles/BuildingFloorPlan.css";

export const BuildingFloorPlan = ({
  rooms,
  sensorData,
  floorName,
  onFullscreen,
  isFullscreen,
  floors,
  selectedFloorId,
  onSelectFloor,
}) => {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const planContainerRef = useRef(null);
  const svgRef = useRef(null);

  const getRoomStatus = (roomId) => {
    return sensorData.get(roomId);
  };

  const getTemperatureColor = (temp) => {
    if (temp < 15) return "#4a90e2"; // Blue - Cold
    if (temp < 18) return "#7ed321"; // Green - Cool
    if (temp < 22) return "#f5a623"; // Orange - Normal
    if (temp < 25) return "#e74c3c"; // Red - Warm
    return "#c0392b"; // Dark Red - Very Hot
  };

  // Calculate canvas dimensions - ENLARGED
  const padding = 10;
  const maxWidth = 1500;
  const maxHeight = 750;
  const roomScale = 40; // Scale factor for rooms

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleResetZoom = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Handle mouse down for drag
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  // Handle mouse move for pan
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle Ctrl + wheel zoom
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          // Scroll up - zoom in
          handleZoomIn();
        } else {
          // Scroll down - zoom out
          handleZoomOut();
        }
      }
    };

    const container = planContainerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => {
        container.removeEventListener("wheel", handleWheel);
      };
    }
  }, [zoom]);

  // Add mouse move and up listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  return (
    <div className="building-floor-plan">
      <div className="floor-plan-header">
        <div className="header-left">
          <div className="floor-buttons">
            {floors &&
              floors.map((floor) => (
                <button
                  key={floor.id}
                  className={`floor-btn ${selectedFloorId === floor.id ? "active" : ""}`}
                  onClick={() => onSelectFloor(floor.id)}
                >
                  {floor.name}
                </button>
              ))}
          </div>
        </div>
        <div className="header-controls">
          {onFullscreen && !isFullscreen && (
            <button
              className="fullscreen-btn"
              onClick={onFullscreen}
              title="Fullscreen"
            >
              ⛶
            </button>
          )}
        </div>
      </div>
      <div
        className={`plan-container ${isDragging ? "dragging" : ""}`}
        ref={planContainerRef}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <svg
          ref={svgRef}
          className="floor-plan-svg"
          preserveAspectRatio="xMidYMid meet"
          viewBox={`0 0 ${maxWidth} ${maxHeight}`}
          style={{
            width: "100%",
            height: "100%",
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: "top center",
            transition: isDragging ? "none" : "transform 0.2s ease-out",
          }}
        >
          {/* Background */}
          <rect width={maxWidth} height={maxHeight} fill="#f5f5f5" />

          {/* Grid lines for reference */}
          <defs>
            <pattern
              id="grid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
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
            const rawTemp = roomData?.temperature ?? room.temperature ?? 20;
            const temp =
              typeof rawTemp === "number" ? rawTemp : parseFloat(rawTemp) || 20;
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
                  fill={isOccupied ? "#ffe6e6" : "#f0f0f0"}
                  stroke={isOccupied ? "#e74c3c" : "#999"}
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
                  fill={isOccupied ? "#e74c3c" : "#999"}
                >
                  {isOccupied ? "Occupée" : "Vide"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="legend">
        <div className="legend-item">
          <div
            className="legend-color"
            style={{ backgroundColor: "#4a90e2" }}
          />
          <span>&lt; 15°C</span>
        </div>
        <div className="legend-item">
          <div
            className="legend-color"
            style={{ backgroundColor: "#7ed321" }}
          />
          <span>15 - 18°C</span>
        </div>
        <div className="legend-item">
          <div
            className="legend-color"
            style={{ backgroundColor: "#f5a623" }}
          />
          <span>18 - 22°C</span>
        </div>
        <div className="legend-item">
          <div
            className="legend-color"
            style={{ backgroundColor: "#e74c3c" }}
          />
          <span>22 - 25°C</span>
        </div>
        <div className="legend-item">
          <div
            className="legend-color"
            style={{ backgroundColor: "#c0392b" }}
          />
          <span>&gt; 25°C</span>
        </div>
        <div className="legend-spacer"></div>
        <div className="legend-controls">
          <button
            className="legend-zoom-btn"
            onClick={handleZoomOut}
            title="Zoom out"
            disabled={zoom <= 0.5}
          >
            −
          </button>
          <span className="legend-zoom-display">{Math.round(zoom * 100)}%</span>
          <button
            className="legend-zoom-btn"
            onClick={handleZoomIn}
            title="Zoom in"
            disabled={zoom >= 3}
          >
            +
          </button>
          <button
            className="legend-zoom-btn reset"
            onClick={handleResetZoom}
            title="Reset zoom and pan"
          >
            ⟲
          </button>
        </div>
      </div>
    </div>
  );
};
