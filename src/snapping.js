import { getDistance } from "./utils";

export function findNearestNode(
  components,
  x,
  y,
  excludeComponent,
  threshold = 20
) {
  let nearestNode = null;
  let minDistance = threshold;

  components.forEach((component) => {
    if (component === excludeComponent) return; // Skip the dragged component

    // Check resistor nodes
    if (component.type === "resistor" || component.type === "resistorZigZag") {
      const node1 = component.node1;
      const node2 = component.node2;

      const dist1 = getDistance({ x, y }, node1);
      if (dist1 < minDistance) {
        minDistance = dist1;
        nearestNode = node1;
      }

      const dist2 = getDistance({ x, y }, node2);
      if (dist2 < minDistance) {
        minDistance = dist2;
        nearestNode = node2;
      }
    }
    // Add label notch point
    if (component.type === "label") {
      const notch = { x: component.x, y: component.y }; // Label's notch point
      const dist = getDistance({ x, y }, notch);
      if (dist < minDistance) {
        minDistance = dist;
        nearestNode = notch;
      }
    }
  });

  return nearestNode;
}
// Define allowed lengths for snapping
const allowedLengths = [50, 100, 150, 200]; // Allowed lengths in pixels

// Function to find the nearest allowed length to snap to
function getSnappedLength(length) {
  let closestLength = allowedLengths[0];
  let minDifference = Math.abs(length - allowedLengths[0]);

  for (let i = 1; i < allowedLengths.length; i++) {
    const difference = Math.abs(length - allowedLengths[i]);
    if (difference < minDifference) {
      closestLength = allowedLengths[i];
      minDifference = difference;
    }
  }

  return closestLength;
}
// Modified function to handle both angle and length snapping
export function snapToStraightLineWithLength(x1, y1, snappedAngle, distance) {
  const snappedLength = getSnappedLength(distance);
  let x2 = x1;
  let y2 = y1;

  switch (snappedAngle) {
    case 0:
      x2 = x1 + snappedLength;
      y2 = y1;
      break;
    case 90:
      x2 = x1;
      y2 = y1 + snappedLength;
      break;
    case 180:
      x2 = x1 - snappedLength;
      y2 = y1;
      break;
    case 270:
      x2 = x1;
      y2 = y1 - snappedLength;
      break;
  }

  return { x2, y2 };
}
