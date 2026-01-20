#!/usr/bin/env node

/**
 * MQTT Test Publisher
 * 
 * Publishes simulated sensor data to test the Building Monitoring System
 * 
 * Installation:
 * npm install mqtt
 * 
 * Usage:
 * node mqtt-test-publisher.js
 */

const mqtt = require('mqtt');

// Configuration
const BROKER_URL = 'mqtt://broker.hivemq.com'; // Change this to your broker
const ROOMS = [
  { id: 'room1', floor: 'floor1', name: 'Reception' },
  { id: 'room2', floor: 'floor1', name: 'Meeting Room' },
  { id: 'room3', floor: 'floor1', name: 'Office 1' },
  { id: 'room4', floor: 'floor1', name: 'Office 2' },
  { id: 'room5', floor: 'floor1', name: 'Conference Room' },
  { id: 'room6', floor: 'floor1', name: 'Kitchen' },
  { id: 'room7', floor: 'floor2', name: 'Office 3' },
  { id: 'room8', floor: 'floor2', name: 'Office 4' },
  { id: 'room9', floor: 'floor2', name: 'Lab' },
  { id: 'room10', floor: 'floor2', name: 'Storage' },
];

// Connect to MQTT broker
const client = mqtt.connect(BROKER_URL, {
  clientId: `mqtt-test-${Math.random().toString(36).substr(2, 9)}`,
  reconnectPeriod: 1000,
});

client.on('connect', () => {
  console.log('✓ Connected to MQTT broker:', BROKER_URL);
  console.log('Publishing sensor data every 5 seconds...\n');

  // Publish sensor data every 5 seconds
  setInterval(() => {
    ROOMS.forEach((room) => {
      const topic = `building/${room.floor}/${room.id}/sensor`;
      
      // Simulate sensor readings
      const occupied = Math.random() > 0.5; // Random occupancy
      const baseTemp = 20 + Math.random() * 5; // Temperature between 20-25°C
      const temp = occupied ? baseTemp + 2 : baseTemp; // Higher if occupied
      const humidity = 30 + Math.random() * 40; // Humidity between 30-70%

      const payload = {
        occupied,
        temperature: parseFloat(temp.toFixed(1)),
        humidity: parseFloat(humidity.toFixed(1)),
        timestamp: Date.now(),
      };

      client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
          console.error(`Error publishing to ${topic}:`, err);
        } else {
          const status = occupied ? '👤' : '🔲';
          console.log(
            `${status} ${room.name.padEnd(18)} | ${payload.temperature}°C | H: ${payload.humidity.toFixed(0)}%`
          );
        }
      });
    });
    console.log('---');
  }, 5000);
});

client.on('error', (error) => {
  console.error('Connection error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nDisconnecting...');
  client.end();
  process.exit(0);
});
