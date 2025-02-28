import { rotatePoint } from "./utils";

// Merged drawResistor function with optional subtype parameter
export function drawResistor(
  rc,
  x1,
  y1,
  snappedX,
  snappedY,
  angle,
  seed,
  subtype = "rectangle" // Default to rectangle, can be "zigzag"
) {
  const dx = snappedX - x1;
  const dy = snappedY - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const midX = (x1 + snappedX) / 2;
  const midY = (y1 + snappedY) / 2;
  const resistorLength = length / 2;

  let resistorElement;
  let allPoints = []; // For bounding box calculation

  if (subtype === "zigzag") {
    const resistorHeight = length * 0.15; // Height of zigzag
    const numZigs = 4; // Number of zigzag peaks

    // Calculate zigzag points
    const step = resistorLength / numZigs;
    const points = [];
    const startX = midX - resistorLength / 2;
    const startY = midY;
    for (let i = 0; i <= numZigs * 2; i++) {
      const x = startX + (i * resistorLength) / (numZigs * 2);
      const y =
        startY + (i % 2 === 0 ? 0 : (i % 4 === 1 ? -1 : 1) * resistorHeight);
      const rotated = rotatePoint(x, y, midX, midY, angle);
      points.push(rotated);
    }

    // Create the zigzag path
    const pathData = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
    resistorElement = rc.path(pathData, {
      stroke: "black",
      strokeWidth: 2,
      roughness: 2,
      preserveVertices: true,
      seed,
    });

    allPoints = points; // Use zigzag points for bounding box
  } else {
    // Default to rectangle
    const resistorHeight = length * 0.1;
    const resistorBoxLength = resistorLength;

    resistorElement = rc.rectangle(
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
    resistorElement.setAttribute(
      "transform",
      `rotate(${angle} ${midX} ${midY})`
    );

    // Corners of the resistor rectangle before rotation
    const rectCorners = [
      { x: midX - resistorBoxLength / 2, y: midY - resistorHeight / 2 }, // Top-left
      { x: midX + resistorBoxLength / 2, y: midY - resistorHeight / 2 }, // Top-right
      { x: midX + resistorBoxLength / 2, y: midY + resistorHeight / 2 }, // Bottom-right
      { x: midX - resistorBoxLength / 2, y: midY + resistorHeight / 2 }, // Bottom-left
    ];
    // Rotate corners around midX, midY
    allPoints = rectCorners.map((corner) =>
      rotatePoint(corner.x, corner.y, midX, midY, angle)
    );
  }

  // Wires (common to both subtypes)
  const wireStartX = midX - resistorLength / 2;
  const wireStartY = midY;
  const wireEndX = midX + resistorLength / 2;
  const wireEndY = midY;

  const rotatedStart = rotatePoint(wireStartX, wireStartY, midX, midY, angle);
  const rotatedEnd = rotatePoint(wireEndX, wireEndY, midX, midY, angle);

  const wire1 = rc.line(x1, y1, rotatedStart.x, rotatedStart.y, {
    stroke: "black",
    strokeWidth: 2,
    roughness: 1,
    preserveVertices: true,
    seed,
  });
  const wire2 = rc.line(snappedX, snappedY, rotatedEnd.x, rotatedEnd.y, {
    stroke: "black",
    strokeWidth: 2,
    roughness: 1,
    preserveVertices: true,
    seed,
  });

  // Nodes (common to both subtypes)
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

  // Bounding box (excluding nodes, common to both)
  const widthPadding = 10;
  const lengthPadding = 5;
  const angleRad = (angle * Math.PI) / 180;
  const cosAngle = Math.abs(Math.cos(angleRad));
  const sinAngle = Math.abs(Math.sin(angleRad));

  // Include wire endpoints in bounding box
  allPoints.push(rotatedStart, rotatedEnd);

  const minX =
    Math.min(...allPoints.map((p) => p.x)) -
    lengthPadding * cosAngle -
    widthPadding * sinAngle;
  const maxX =
    Math.max(...allPoints.map((p) => p.x)) +
    lengthPadding * cosAngle +
    widthPadding * sinAngle;
  const minY =
    Math.min(...allPoints.map((p) => p.y)) -
    lengthPadding * sinAngle -
    widthPadding * cosAngle;
  const maxY =
    Math.max(...allPoints.map((p) => p.y)) +
    lengthPadding * sinAngle +
    widthPadding * cosAngle;

  const bbox = { minX, maxX, minY, maxY };

  // Optional bounding box rectangle (commented out as in original)
  // const bboxRect = rc.rectangle(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY, {
  //   stroke: "blue",
  //   strokeWidth: 1,
  //   fill: "none",
  //   roughness: 0,
  //   seed,
  // });

  // Group all elements
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.appendChild(resistorElement);
  group.appendChild(wire1);
  group.appendChild(wire2);
  // group.appendChild(node1);
  // group.appendChild(node2);
  // group.appendChild(bboxRect);

  return {
    angle,
    type: "resistor",
    subtype: subtype, // Include subtype in returned object
    x: midX,
    y: midY,
    element: group,
    node1: { x: x1, y: y1 },
    node2: { x: snappedX, y: snappedY },
    bbox,
    seed,
  };
}

// drawLabel remains unchanged
export function drawLabel(
  rc,
  x,
  y,
  width,
  height,
  angle,
  seed,
  text = "Label"
) {
  // ... (existing drawLabel code remains unchanged)
  // Define dimensions
  const pointOffset = height / 2; // Distance from the apex to the top/bottom of the notch
  const halfHeight = height / 2;
  const wireLength = 5; // Distance to offset the label from the node

  // Calculate the direction vector for the wire (based on angle)
  const radAngle = (angle * Math.PI) / 180;

  // New starting point for the label shape (shifted from the node)
  const labelStartX = x + wireLength;
  const labelStartY = y;

  // Define points for the label shape starting at (labelStartX, labelStartY)
  const points = [
    { x: labelStartX + pointOffset, y: labelStartY - halfHeight }, // Top point of the notch
    { x: labelStartX + width, y: labelStartY - halfHeight }, // Top-right corner
    { x: labelStartX + width, y: labelStartY + halfHeight }, // Bottom-right corner
    { x: labelStartX + pointOffset, y: labelStartY + halfHeight }, // Bottom point of the notch
    { x: labelStartX, y: labelStartY }, // Apex of the notch (shifted point)
  ];

  // Define center for rotation (center of the rectangular part)
  const centerX = x + (width + pointOffset) / 2;
  const centerY = y;

  // Rotate points around the original node point (x, y)
  const rotatedPoints = points.map((point) =>
    rotatePoint(point.x, point.y, x, y, angle)
  );

  // Draw the label as a path with yellow fill and light blue stroke
  const pathData = [
    `M ${rotatedPoints[0].x} ${rotatedPoints[0].y}`,
    `L ${rotatedPoints[1].x} ${rotatedPoints[1].y}`,
    `L ${rotatedPoints[2].x} ${rotatedPoints[2].y}`,
    `L ${rotatedPoints[3].x} ${rotatedPoints[3].y}`,
    `L ${rotatedPoints[4].x} ${rotatedPoints[4].y}`,
    "Z",
  ].join(" ");

  const labelShape = rc.path(pathData, {
    stroke: "#ADD8E6",
    strokeWidth: 2,
    fill: "#FFFFE0",
    roughness: 1,
    seed,
  });

  // Calculate the center of the rotated rectangular part for text placement
  const rectCenter = rotatePoint(centerX, centerY, x, y, angle);

  // Add text inside the label
  const textElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text"
  );
  textElement.setAttribute("x", rectCenter.x);
  textElement.setAttribute("y", rectCenter.y + 2);
  textElement.setAttribute("text-anchor", "middle");
  textElement.setAttribute("dominant-baseline", "middle");

  let textAngle = angle;
  if (angle > 90 && angle <= 270) {
    textAngle += 180;
  }
  textElement.setAttribute(
    "transform",
    `rotate(${textAngle} ${rectCenter.x} ${rectCenter.y})`
  );
  textElement.setAttribute("font-size", "14");
  textElement.setAttribute("fill", "black");
  textElement.textContent = text;
  textElement.style.pointerEvents = "none";

  // Calculate bounding box for the label shape and wire only (exclude the node)
  const padding = 5;
  const shapePoints = rotatedPoints.slice(0, 4); // Exclude apex for shape-only bbox
  const minX = Math.min(...shapePoints.map((p) => p.x)) - padding;
  const maxX = Math.max(...shapePoints.map((p) => p.x)) + padding;
  const minY = Math.min(...shapePoints.map((p) => p.y)) - padding;
  const maxY = Math.max(...shapePoints.map((p) => p.y)) + padding;

  const bbox = {
    minX,
    maxX,
    minY,
    maxY,
  };

  const node1 = rc.circle(x, y, 10, {
    fill: "red",
    stroke: "black",
    strokeWidth: 1,
    seed,
  });

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.appendChild(labelShape);
  group.appendChild(textElement);
  group.appendChild(node1);

  return {
    text,
    angle,
    type: "label",
    subtype: "tag",
    x,
    y,
    element: group,
    bbox: bbox,
    seed: seed,
  };
}
// Updated drawTriangleLabel function excluding node from bbox
export function drawTriangleLabel(rc, x, y, angle, seed, subtype = "gnd") {
  const wireLength = 30; // Length of the initial line
  const baseWidth = 20; // Width of the triangle's base
  const height = 15; // Height of the triangle from base to apex

  // End of the wire (line) based on angle
  const wireEndX = x + wireLength * Math.cos((angle * Math.PI) / 180);
  const wireEndY = y + wireLength * Math.sin((angle * Math.PI) / 180);
  const wire = rc.line(x, y, wireEndX, wireEndY, {
    stroke: "black",
    strokeWidth: 2,
    roughness: 1,
    preserveVertices: true,
    seed,
  });

  // Triangle base is perpendicular to the wire at its end
  const halfBase = baseWidth / 2;
  const perpAngle = angle + 90; // Perpendicular to the wire direction
  const baseStartX =
    wireEndX + halfBase * Math.cos((perpAngle * Math.PI) / 180);
  const baseStartY =
    wireEndY + halfBase * Math.sin((perpAngle * Math.PI) / 180);
  const baseEndX = wireEndX - halfBase * Math.cos((perpAngle * Math.PI) / 180);
  const baseEndY = wireEndY - halfBase * Math.sin((perpAngle * Math.PI) / 180);

  // Triangle apex extends away from the wire in the same direction as the angle
  const apexX = wireEndX + height * Math.cos((angle * Math.PI) / 180);
  const apexY = wireEndY + height * Math.sin((angle * Math.PI) / 180);

  const points = [
    { x: baseStartX, y: baseStartY },
    { x: baseEndX, y: baseEndY },
    { x: apexX, y: apexY },
  ];
  const pathData = [
    `M ${points[0].x} ${points[0].y}`,
    `L ${points[1].x} ${points[1].y}`,
    `L ${points[2].x} ${points[2].y}`,
    "Z",
  ].join(" ");
  const triangle = rc.path(pathData, {
    stroke: "black",
    strokeWidth: 2,
    fill: subtype === "positive" ? "red" : "black",
    roughness: 1,
    fillWeight: 3,
    hachureGap: 4,
    seed,
  });

  // Node circle at the start (still drawn, but excluded from bbox)
  const node = rc.circle(x, y, 10, {
    fill: "red",
    stroke: "black",
    strokeWidth: 1,
    seed,
  });

  // Bounding box excludes the node, only includes wire end and triangle
  const allPoints = [
    { x: wireEndX, y: wireEndY }, // Wire end
    ...points, // Triangle points
  ];
  const padding = 5;
  const minX = Math.min(...allPoints.map((p) => p.x)) - padding;
  const maxX = Math.max(...allPoints.map((p) => p.x)) + padding;
  const minY = Math.min(...allPoints.map((p) => p.y)) - padding;
  const maxY = Math.max(...allPoints.map((p) => p.y)) + padding;
  const bbox = { minX, maxX, minY, maxY };

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.appendChild(wire);
  group.appendChild(triangle);
  // group.appendChild(node);

  return {
    angle,
    type: "label",
    subtype: subtype === "positive" ? "positive" : "gnd",
    x,
    y,
    element: group,
    node1: { x, y }, // Connection point at the start of the wire
    bbox,
    seed,
  };
}
