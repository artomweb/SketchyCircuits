import { components } from "./main";
import { getDistance } from "./utils";

// Find the nearest node within a given threshold, optionally excluding a component
export function findNearestNode(x, y, excludeComponent = null, threshold = 50) {
  let nearestNode = null;
  let minDistance = Infinity;

  components.forEach((comp) => {
    if (comp !== excludeComponent) {
      if (comp.node1) {
        const d1 = getDistance(comp.node1, { x, y });
        if (d1 < minDistance && d1 < threshold) {
          minDistance = d1;
          nearestNode = comp.node1;
        }
      }
      if (comp.node2) {
        const d2 = getDistance(comp.node2, { x, y });
        if (d2 < minDistance && d2 < threshold) {
          minDistance = d2;
          nearestNode = comp.node2;
        }
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
