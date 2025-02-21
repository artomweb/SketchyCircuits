// Utility function to calculate distance between two points
export function getDistance(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// Utility function to calculate angle and adjust to 0-360 degree range
export function getAngle(dx, dy) {
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle < 0) {
    angle += 360;
  }
  return angle;
}
// Rotate a point around a given center by a specific angle

export function rotatePoint(x, y, centerX, centerY, angle) {
  const radians = (angle * Math.PI) / 180;
  const cosA = Math.cos(radians);
  const sinA = Math.sin(radians);

  const rotatedX = cosA * (x - centerX) - sinA * (y - centerY) + centerX;
  const rotatedY = sinA * (x - centerX) + cosA * (y - centerY) + centerY;

  return { x: rotatedX, y: rotatedY };
}
