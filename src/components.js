import { rotatePoint } from "./utils";

// Updated drawResistor to include bounding box info
export function drawResistor(rc, x1, y1, snappedX, snappedY, angle, seed) {
  const dx = snappedX - x1;
  const dy = snappedY - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const midX = (x1 + snappedX) / 2;
  const midY = (y1 + snappedY) / 2;
  const resistorHeight = length * 0.1;
  const resistorBoxLength = length / 2;

  const resistorRect = rc.rectangle(
    midX - resistorBoxLength / 2,
    midY - resistorHeight / 2,
    resistorBoxLength,
    resistorHeight,
    {
      stroke: "black",
      strokeWidth: 2,
      roughness: 1,
      seed,
    }
  );
  resistorRect.setAttribute("transform", `rotate(${angle} ${midX} ${midY})`);

  const wireStartX = midX - resistorBoxLength / 2;
  const wireStartY = midY;
  const wireEndX = midX + resistorBoxLength / 2;
  const wireEndY = midY;

  const rotatedStart = rotatePoint(wireStartX, wireStartY, midX, midY, angle);
  const rotatedEnd = rotatePoint(wireEndX, wireEndY, midX, midY, angle);

  const wire1 = rc.line(x1, y1, rotatedStart.x, rotatedStart.y, {
    stroke: "black",
    strokeWidth: 2,
    roughness: 1,
    seed,
  });
  const wire2 = rc.line(snappedX, snappedY, rotatedEnd.x, rotatedEnd.y, {
    stroke: "black",
    strokeWidth: 2,
    roughness: 1,
    seed,
  });

  const node1 = rc.circle(x1, y1, 10, {
    fill: "red",
    stroke: "black",
    strokeWidth: 1,
    seed,
  });
  const node2 = rc.circle(snappedX, snappedY, 10, {
    fill: "red",
    stroke: "black",
    strokeWidth: 1,
    seed,
  });

  const padding = 10;
  const bbox = {
    minX: Math.min(x1, snappedX) - padding,
    maxX: Math.max(x1, snappedX) + padding,
    minY: Math.min(y1, snappedY) - resistorHeight / 2 - padding,
    maxY: Math.max(y1, snappedY) + resistorHeight / 2 + padding,
  };

  const bboxRect = rc.rectangle(
    bbox.minX,
    bbox.minY,
    bbox.maxX - bbox.minX,
    bbox.maxY - bbox.minY,
    {
      stroke: "blue",
      strokeWidth: 1,
      fill: "none",
      roughness: 0,
      seed,
    }
  );

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.appendChild(resistorRect);
  group.appendChild(wire1);
  group.appendChild(wire2);
  group.appendChild(node1);
  group.appendChild(node2);
  //   group.appendChild(bboxRect);
  const resistor = {
    type: "resistor",
    x: midX,
    y: midY,
    element: group,
    node1: { x: x1, y: y1 },
    node2: { x: snappedX, y: snappedY },
    bbox: bbox,
  };

  return resistor;
}
