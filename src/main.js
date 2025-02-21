import "./style.css";
import rough from "roughjs";
import { getAngle, getDistance } from "./utils";
import { drawResistor } from "./components";
import { snapToStraightLineWithLength, findNearestNode } from "./snapping";
const canvas = document.getElementById("canvas");
export const rc = rough.svg(canvas);

// Create an SVG element for drawing
const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
svg.setAttribute("width", "800");
svg.setAttribute("height", "600");
canvas.appendChild(svg);

// State management
let isDrawing = false;
let startPoint = null;
let absStartPoint = null;
export let components = [];
let currentPreview = null;
let currentSeed = null;
let isDragging = false;
let draggedComponent = null;
let isDraggingFromPalette = false;
let selectedTool = "resistor";
let selectedComponent = null;

const minMoveDist = 10;

// Define palette dimensions and position (on right)
const paletteWidth = 100;
const paletteHeight = 600;
const paletteX = 700;
const paletteY = 0;

// Create palette group
const paletteGroup = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "g"
);
svg.appendChild(paletteGroup);

// Draw palette background
const paletteBg = rc.rectangle(
  paletteX,
  paletteY,
  paletteWidth,
  paletteHeight,
  {
    fill: "#f0f0f0",
    stroke: "#ccc",
    strokeWidth: 1,
    roughness: 0,
  }
);
paletteGroup.appendChild(paletteBg);

// Tool definitions
const tools = [
  {
    type: "resistor",
    x: paletteX + 50,
    y: paletteY + 50,
    element: null,
    seed: 12345, // Fixed seed for consistency
  },
];

// Draw tools in palette
function drawPalette() {
  tools.forEach((tool) => {
    if (tool.type === "resistor" && !tool.element) {
      // Draw only once
      const resistor = drawResistor(
        rc,
        tool.x - 25,
        tool.y,
        tool.x + 25,
        tool.y,
        0,
        tool.seed
      );
      tool.element = resistor.element;
      paletteGroup.appendChild(tool.element);
    }

    // Update selection indicator
    const existingSelection = paletteGroup.querySelector(".selection-rect");
    if (existingSelection) paletteGroup.removeChild(existingSelection);

    if (selectedTool === tool.type) {
      const selectionRect = rc.rectangle(tool.x - 35, tool.y - 20, 70, 40, {
        stroke: "blue",
        strokeWidth: 2,
        fill: "none",
        roughness: 0,
      });
      selectionRect.classList.add("selection-rect");
      paletteGroup.appendChild(selectionRect);
    }
  });
}

function redrawComponents() {
  while (svg.childNodes.length > 1) {
    svg.removeChild(svg.lastChild);
  }
  components.forEach((comp) => {
    svg.appendChild(comp.element);
    if (comp === selectedComponent) {
      const bbox = comp.bbox;
      const selectionRect = rc.rectangle(
        bbox.minX,
        bbox.minY,
        bbox.maxX - bbox.minX,
        bbox.maxY - bbox.minY,
        {
          stroke: "green",
          strokeWidth: 2,
          fill: "none",
          roughness: 0,
        }
      );
      selectionRect.classList.add("component-selection");
      svg.appendChild(selectionRect);
    }
  });
  const existingSelection = paletteGroup.querySelector(".selection-rect");
  if (existingSelection) paletteGroup.removeChild(existingSelection);
  tools.forEach((tool) => {
    if (selectedTool === tool.type) {
      const selectionRect = rc.rectangle(tool.x - 35, tool.y - 20, 70, 40, {
        stroke: "blue",
        strokeWidth: 2,
        fill: "none",
        roughness: 0,
      });
      selectionRect.classList.add("selection-rect");
      paletteGroup.appendChild(selectionRect);
    }
  });
}

function handleDrawing(e, isPreview = false) {
  const endPoint = { x: e.offsetX, y: e.offsetY };
  const moveDist = getDistance(startPoint, endPoint);
  const absMoveDist = getDistance(absStartPoint, endPoint);

  if (absMoveDist < minMoveDist) {
    if (isPreview && currentPreview) {
      svg.removeChild(currentPreview.element);
      currentPreview = null;
    }
    return;
  }

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = moveDist;
  const angle = getAngle(dx, dy);
  let snappedAngle = Math.round(angle / 90) * 90;
  if (snappedAngle === 360) snappedAngle = 0;

  const snappedCoords = snapToStraightLineWithLength(
    startPoint.x,
    startPoint.y,
    snappedAngle,
    length
  );

  const resistor = drawResistor(
    rc,
    startPoint.x,
    startPoint.y,
    snappedCoords.x2,
    snappedCoords.y2,
    snappedAngle,
    currentSeed
  );

  if (isPreview) {
    if (currentPreview) svg.removeChild(currentPreview.element);
    currentPreview = resistor;
    svg.appendChild(currentPreview.element);
  } else {
    components.push(resistor);
    if (currentPreview) {
      svg.removeChild(currentPreview.element);
      currentPreview = null;
    }
    redrawComponents();
  }
}

// Mouse event handlers
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    redrawComponents(); // Ensure canvas is updated before any action

    const clickedComponent = components.find(
      (comp) =>
        comp.type === "resistor" &&
        isPointInBBox(e.offsetX, e.offsetY, comp.bbox)
    );
    const clickedTool = tools.find(
      (tool) =>
        Math.abs(e.offsetX - tool.x) < 35 && Math.abs(e.offsetY - tool.y) < 20
    );

    if (clickedComponent && e.offsetX < paletteX) {
      selectedComponent =
        clickedComponent === selectedComponent
          ? clickedComponent
          : clickedComponent; // Always select, no toggle
      isDragging = true;
      draggedComponent = selectedComponent;
      draggedComponent.offsetX = e.offsetX - draggedComponent.x;
      draggedComponent.offsetY = e.offsetY - draggedComponent.y;
      currentSeed = Math.floor(Math.random() * 10000); // Reset seed for new drawing
    } else if (clickedTool) {
      selectedTool = clickedTool.type;
      selectedComponent = null; // Deselect component when selecting tool
      redrawComponents();
    } else if (e.offsetX > paletteX) {
      isDraggingFromPalette = true;
      paletteDragStart = { x: e.offsetX, y: e.offsetY };
      currentSeed = Math.floor(Math.random() * 10000);
    } else if (selectedTool === "resistor") {
      if (selectedComponent && e.offsetX < paletteX) {
        selectedComponent = null; // Deselect if clicking empty space
        redrawComponents();
      }
      isDrawing = true;
      const nearestNode = findNearestNode(e.offsetX, e.offsetY);
      startPoint = nearestNode
        ? { x: nearestNode.x, y: nearestNode.y }
        : { x: e.offsetX, y: e.offsetY };
      absStartPoint = { x: e.offsetX, y: e.offsetY };
      currentSeed = Math.floor(Math.random() * 10000);
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (isDrawing) {
    handleDrawing(e, true);
  } else if (isDragging && draggedComponent) {
    const newX = e.offsetX - draggedComponent.offsetX;
    const newY = e.offsetY - draggedComponent.offsetY;

    const originalDx = draggedComponent.node2.x - draggedComponent.node1.x;
    const originalDy = draggedComponent.node2.y - draggedComponent.node1.y;

    let newX1 = newX - originalDx / 2;
    let newY1 = newY - originalDy / 2;
    let newX2 = newX + originalDx / 2;
    let newY2 = newY + originalDy / 2;

    const snapNode1 = findNearestNode(newX1, newY1, draggedComponent);
    const snapNode2 = findNearestNode(newX2, newY2, draggedComponent);

    if (snapNode1) {
      newX1 = snapNode1.x;
      newY1 = snapNode1.y;
      newX2 = newX1 + originalDx;
      newY2 = newY1 + originalDy;
    } else if (snapNode2) {
      newX2 = snapNode2.x;
      newY2 = snapNode2.y;
      newX1 = newX2 - originalDx;
      newY1 = newY2 - originalDy;
    } else {
      newX1 = newX - originalDx / 2;
      newY1 = newY - originalDy / 2;
      newX2 = newX + originalDx / 2;
      newY2 = newY + originalDy / 2;
    }

    svg.removeChild(draggedComponent.element);
    const index = components.indexOf(draggedComponent);
    if (index > -1) components.splice(index, 1);

    const angle = getAngle(originalDx, originalDy);
    const snappedAngle = Math.round(angle / 90) * 90;
    const newResistor = drawResistor(
      rc,
      newX1,
      newY1,
      newX2,
      newY2,
      snappedAngle,
      currentSeed
    );

    components.push(newResistor);
    draggedComponent = newResistor;
    draggedComponent.offsetX = e.offsetX - draggedComponent.x;
    draggedComponent.offsetY = e.offsetY - draggedComponent.y;
    selectedComponent = draggedComponent; // Keep selected during drag
    redrawComponents();
  } else if (isDraggingFromPalette && paletteDragStart) {
    const dx = e.offsetX - paletteDragStart.x;
    const dy = e.offsetY - paletteDragStart.y;
    const angle = getAngle(dx, dy);
    let snappedAngle = Math.round(angle / 90) * 90;
    if (snappedAngle === 360) snappedAngle = 0;

    const length = getDistance(paletteDragStart, {
      x: e.offsetX,
      y: e.offsetY,
    });
    const snappedCoords = snapToStraightLineWithLength(
      paletteDragStart.x,
      paletteDragStart.y,
      snappedAngle,
      length
    );

    if (currentPreview) svg.removeChild(currentPreview.element);
    currentPreview = drawResistor(
      rc,
      paletteDragStart.x,
      paletteDragStart.y,
      snappedCoords.x2,
      snappedCoords.y2,
      snappedAngle,
      currentSeed
    );
    svg.appendChild(currentPreview.element);
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (isDrawing) {
    isDrawing = false;
    handleDrawing(e, false);
  } else if (isDragging && draggedComponent) {
    const node1 = draggedComponent.node1;
    const node2 = draggedComponent.node2;
    const closeThreshold = 30;

    const snapNode1 = findNearestNode(
      node1.x,
      node1.y,
      draggedComponent,
      closeThreshold
    );
    const snapNode2 = findNearestNode(
      node2.x,
      node2.y,
      draggedComponent,
      closeThreshold
    );

    if (snapNode1 || snapNode2) {
      svg.removeChild(draggedComponent.element);
      const index = components.indexOf(draggedComponent);
      if (index > -1) components.splice(index, 1);

      let newX1 = node1.x;
      let newY1 = node1.y;
      let newX2 = node2.x;
      let newY2 = node2.y;

      if (snapNode1) {
        newX1 = snapNode1.x;
        newY1 = snapNode1.y;
        newX2 = newX1 + (node2.x - node1.x);
        newY2 = newY1 + (node2.y - node1.y);
      } else if (snapNode2) {
        newX2 = snapNode2.x;
        newY2 = snapNode2.y;
        newX1 = newX2 - (node2.x - node1.x);
        newY1 = newY2 - (node2.y - node1.y);
      }

      const dx = newX2 - newX1;
      const dy = newY2 - newY1;
      const angle = getAngle(dx, dy);
      const snappedAngle = Math.round(angle / 90) * 90;

      const newResistor = drawResistor(
        rc,
        newX1,
        newY1,
        newX2,
        newY2,
        snappedAngle,
        currentSeed
      );

      components.push(newResistor);
      draggedComponent = newResistor;
      selectedComponent = draggedComponent;
    }
    isDragging = false;
    draggedComponent = null;
    redrawComponents();
  } else if (isDraggingFromPalette && currentPreview) {
    if (e.offsetX < paletteX) {
      components.push(currentPreview);
      currentPreview = null;
      redrawComponents();
    } else if (currentPreview) {
      svg.removeChild(currentPreview.element);
      currentPreview = null;
    }
    isDraggingFromPalette = false;
    paletteDragStart = null;
  }
});

// Function to delete a component
function deleteComponent(component) {
  svg.removeChild(component.element);
  const index = components.indexOf(component);
  if (index > -1) components.splice(index, 1);
  if (selectedComponent === component) selectedComponent = null;
  redrawComponents();
}

// Check if a point is inside a bounding box
function isPointInBBox(x, y, bbox) {
  return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY;
}

// Handle right-click event (context menu)
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  drawPalette();
  const centerX = 400;
  const centerY = 300;
  currentSeed = Math.floor(Math.random() * 10000);
  const resistor = drawResistor(
    rc,
    centerX - 50,
    centerY,
    centerX + 50,
    centerY,
    0,
    currentSeed
  );
  components.push(resistor);
  svg.appendChild(resistor.element);
});
