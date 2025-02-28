import "./style.css";
import rough from "roughjs";
import { getAngle, getDistance } from "./utils";
import { drawResistor, drawLabel, drawTriangleLabel } from "./components";
import { snapToStraightLineWithLength, findNearestNode } from "./snapping";
import {
  loadComponentsFromStorage,
  saveComponentsToStorage,
} from "./loadComponentsFromStorage";

// Main canvas setup
const canvas = document.getElementById("canvas");
export const rc = rough.svg(canvas);
export const svg = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "svg"
);
svg.setAttribute("width", "800");
svg.setAttribute("height", "600");
canvas.appendChild(svg);

// Toolbar setup
const toolbar = document.getElementById("toolbar");
export const toolbarSvg = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "svg"
);
toolbarSvg.setAttribute("width", "100");
toolbarSvg.setAttribute("height", "600");
toolbar.appendChild(toolbarSvg);
const paletteGroup = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "g"
);
toolbarSvg.appendChild(paletteGroup);

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
let selectedTool = { type: "resistor", subtype: "rectangle" };
let editingLabel = null;
const minMoveDist = 25;
let selectedComponent = null;

let deleteButtonGroup;
let deleteHitArea;

const paletteWidth = 100;
const paletteHeight = 600;

const paletteBg = rc.rectangle(0, 0, paletteWidth, paletteHeight, {
  fill: "#f0f0f0",
  stroke: "#ccc",
  strokeWidth: 1,
  roughness: 0,
});
paletteGroup.appendChild(paletteBg);

const tools = [
  {
    type: "resistor",
    subtype: "rectangle",
    x: 50,
    y: 50,
    element: null,
    seed: 12345,
  },
  { type: "label", subtype: "tag", x: 50, y: 90, element: null, seed: 54321 },
  {
    type: "resistor",
    subtype: "zigzag",
    x: 50,
    y: 140,
    element: null,
    seed: 54321,
  },
  { type: "label", subtype: "gnd", x: 50, y: 180, element: null, seed: 54321 },
  {
    type: "label",
    subtype: "positive",
    x: 50,
    y: 220,
    element: null,
    seed: 54321,
  },
];

const componentDrawers = {
  "resistor.rectangle": {
    palette: (rc, x, y, seed) =>
      drawResistor(rc, x - 25, y, x + 25, y, 0, seed, "rectangle"),
    canvas: (rc, startX, startY, endX, endY, angle, seed) =>
      drawResistor(rc, startX, startY, endX, endY, angle, seed, "rectangle"),
  },
  "resistor.zigzag": {
    palette: (rc, x, y, seed) =>
      drawResistor(rc, x - 25, y, x + 25, y, 0, seed, "zigzag"),
    canvas: (rc, startX, startY, endX, endY, angle, seed) =>
      drawResistor(rc, startX, startY, endX, endY, angle, seed, "zigzag"),
  },
  "label.tag": {
    palette: (rc, x, y, seed) =>
      drawLabel(rc, x - 30, y, 60, 20, 0, seed, "Label"),
    canvas: (rc, startX, startY, endX, endY, angle, seed, text) =>
      drawLabel(rc, startX, startY, 60, 20, angle, seed, text || "Label"),
  },
  "label.gnd": {
    palette: (rc, x, y, seed) =>
      drawTriangleLabel(rc, x - 30, y, 0, seed, "gnd"),
    canvas: (rc, startX, startY, endX, endY, angle, seed) =>
      drawTriangleLabel(rc, startX, startY, angle, seed, "gnd"),
  },
  "label.positive": {
    palette: (rc, x, y, seed) =>
      drawTriangleLabel(rc, x - 30, y, 0, seed, "positive"),
    canvas: (rc, startX, startY, endX, endY, angle, seed) =>
      drawTriangleLabel(rc, startX, startY, angle, seed, "positive"),
  },
};

function redrawComponents() {
  while (svg.childNodes.length > 0) {
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
    if (
      selectedTool.type === tool.type &&
      selectedTool.subtype === tool.subtype
    ) {
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
  renderDeleteButton();
}

function handleDrawing(e, isPreview = false, rect) {
  const endPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  const moveDist = getDistance(startPoint, endPoint);
  const absMoveDist = getDistance(absStartPoint, endPoint);

  if (absMoveDist < minMoveDist) {
    if (isPreview && currentPreview && svg.contains(currentPreview.element)) {
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

  const key = `${selectedTool.type}.${selectedTool.subtype}`;
  const drawer = componentDrawers[key];
  if (!drawer) return;

  let component;
  if (selectedTool.type === "resistor") {
    const snappedCoords = snapToStraightLineWithLength(
      startPoint.x,
      startPoint.y,
      snappedAngle,
      length
    );
    component = drawer.canvas(
      rc,
      startPoint.x,
      startPoint.y,
      snappedCoords.x2,
      snappedCoords.y2,
      snappedAngle,
      currentSeed
    );
  } else {
    component = drawer.canvas(
      rc,
      startPoint.x,
      startPoint.y,
      null,
      null,
      snappedAngle,
      currentSeed
    );
  }

  if (isPreview) {
    if (currentPreview && svg.contains(currentPreview.element)) {
      svg.removeChild(currentPreview.element);
    }
    currentPreview = component;
    svg.appendChild(currentPreview.element);
  } else {
    components.push(component);
    if (currentPreview && svg.contains(currentPreview.element)) {
      svg.removeChild(currentPreview.element);
      currentPreview = null;
    }
    redrawComponents();
    saveComponentsToStorage(components);
  }
}

// Main canvas event listeners
canvas.addEventListener("mousedown", (e) => {
  if (editingLabel) return;
  if (e.button === 0) {
    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const clickedComponent = components.find((comp) =>
      isPointInBBox(offsetX, offsetY, comp.bbox)
    );

    if (clickedComponent) {
      selectedComponent = clickedComponent;
      isDragging = true;
      draggedComponent = selectedComponent;
      draggedComponent.offsetX = offsetX - draggedComponent.x;
      draggedComponent.offsetY = offsetY - draggedComponent.y;
      currentSeed = clickedComponent.seed;
      redrawComponents();
    } else {
      if (selectedComponent) {
        selectedComponent = null;
        redrawComponents();
      }
      if (componentDrawers[`${selectedTool.type}.${selectedTool.subtype}`]) {
        isDrawing = true;
        const nearestNode = findNearestNode(components, offsetX, offsetY);
        startPoint = nearestNode
          ? { x: nearestNode.x, y: nearestNode.y }
          : { x: offsetX, y: offsetY };
        absStartPoint = { x: offsetX, y: offsetY };
        currentSeed = Math.floor(Math.random() * 10000);
      }
    }
  }
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;

  if (isDrawing) {
    handleDrawing(e, true, rect);
  } else if (isDragging && draggedComponent) {
    const newX = offsetX - draggedComponent.offsetX;
    const newY = offsetY - draggedComponent.offsetY;

    if (svg.contains(draggedComponent.element)) {
      svg.removeChild(draggedComponent.element);
    }
    const index = components.indexOf(draggedComponent);
    if (index > -1) components.splice(index, 1);

    let newComponent;
    const key = `${draggedComponent.type}.${
      draggedComponent.subtype || "rectangle"
    }`;
    const drawer = componentDrawers[key];
    if (draggedComponent.type === "resistor") {
      const originalDx = draggedComponent.node2.x - draggedComponent.node1.x;
      const originalDy = draggedComponent.node2.y - draggedComponent.node1.y;
      let newX1 = newX - originalDx / 2;
      let newY1 = newY - originalDy / 2;
      let newX2 = newX + originalDx / 2;
      let newY2 = newY + originalDy / 2;
      newComponent = drawer.canvas(
        rc,
        newX1,
        newY1,
        newX2,
        newY2,
        draggedComponent.angle,
        draggedComponent.seed
      );
    } else if (draggedComponent.type === "label") {
      newComponent = drawer.canvas(
        rc,
        newX,
        newY,
        null,
        null,
        draggedComponent.angle,
        draggedComponent.seed,
        draggedComponent.text
      );
    }

    components.push(newComponent);
    draggedComponent = newComponent;
    if (draggedComponent.type === "resistor") {
      draggedComponent.offsetX = offsetX - draggedComponent.x;
      draggedComponent.offsetY = offsetY - draggedComponent.y;
    } else if (draggedComponent.type === "label") {
      draggedComponent.offsetX = offsetX - newX;
      draggedComponent.offsetY = offsetY - newY;
    }
    selectedComponent = draggedComponent;
    redrawComponents();
    saveComponentsToStorage(components);
  }

  const overComponent = components.find((comp) =>
    isPointInBBox(offsetX, offsetY, comp.bbox)
  );
  if (overComponent) {
    canvas.style.cursor = "move";
  } else {
    canvas.style.cursor = "crosshair";
  }
});

canvas.addEventListener("mouseup", (e) => {
  const rect = canvas.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;

  if (isDrawing) {
    isDrawing = false;
    handleDrawing(e, false, rect);
  } else if (isDragging && draggedComponent) {
    const key = `${draggedComponent.type}.${
      draggedComponent.subtype || "rectangle"
    }`;
    const drawer = componentDrawers[key];
    if (draggedComponent.type === "resistor") {
      const node1 = draggedComponent.node1;
      const node2 = draggedComponent.node2;
      const closeThreshold = 20;

      const snapNode1 = findNearestNode(
        components,
        node1.x,
        node1.y,
        draggedComponent,
        closeThreshold
      );
      const snapNode2 = findNearestNode(
        components,
        node2.x,
        node2.y,
        draggedComponent,
        closeThreshold
      );

      if (snapNode1 || snapNode2) {
        if (svg.contains(draggedComponent.element)) {
          svg.removeChild(draggedComponent.element);
        }
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

        const newResistor = drawer.canvas(
          rc,
          newX1,
          newY1,
          newX2,
          newY2,
          snappedAngle,
          draggedComponent.seed
        );
        components.push(newResistor);
        draggedComponent = newResistor;
        selectedComponent = draggedComponent;
      }
    } else if (draggedComponent.type === "label") {
      const closeThreshold = 30;
      const notchX = draggedComponent.x;
      const notchY = draggedComponent.y;

      const snapNode = findNearestNode(
        components,
        notchX,
        notchY,
        draggedComponent,
        closeThreshold
      );

      if (snapNode) {
        if (svg.contains(draggedComponent.element)) {
          svg.removeChild(draggedComponent.element);
        }
        const index = components.indexOf(draggedComponent);
        if (index > -1) components.splice(index, 1);

        const newNotchX = snapNode.x;
        const newNotchY = snapNode.y;
        const newLabel = drawer.canvas(
          rc,
          newNotchX,
          newNotchY,
          null,
          null,
          draggedComponent.angle || 0,
          draggedComponent.seed,
          draggedComponent.text || "Label"
        );
        components.push(newLabel);
        draggedComponent = newLabel;
        selectedComponent = draggedComponent;
      }
    }
    isDragging = false;
    draggedComponent = null;
    redrawComponents();
    saveComponentsToStorage(components);
  }
});

// Toolbar event listeners
toolbar.addEventListener("mousedown", (e) => {
  const rect = toolbar.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;

  const clickedTool = tools.find(
    (tool) => Math.abs(offsetX - tool.x) < 35 && Math.abs(offsetY - tool.y) < 20
  );

  if (clickedTool) {
    selectedTool = { type: clickedTool.type, subtype: clickedTool.subtype };
    selectedComponent = null;
    redrawComponents();
  }
});

toolbar.addEventListener("mousemove", (e) => {
  const rect = toolbar.getBoundingClientRect();
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;

  const overTool = tools.find(
    (tool) => Math.abs(offsetX - tool.x) < 35 && Math.abs(offsetY - tool.y) < 20
  );
  toolbar.style.cursor = overTool ? "pointer" : "default";
});

canvas.addEventListener("dblclick", (e) => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const scale = parseInt(svg.getAttribute("width")) / 800; // Scaling factor based on original 800px width
  const adjustedX = (e.clientX - rect.left) / scale;
  const adjustedY = (e.clientY - rect.top) / scale;

  const clickedComponent = components.find((comp) =>
    isPointInBBox(adjustedX, adjustedY, comp.bbox)
  );

  if (clickedComponent && clickedComponent.type === "label") {
    const textElement = clickedComponent.element.querySelector("text");
    const currentText = textElement ? textElement.textContent : "Label";

    const index = components.indexOf(clickedComponent);
    if (index > -1) {
      if (svg.contains(clickedComponent.element)) {
        svg.removeChild(clickedComponent.element);
      }
      components.splice(index, 1);
    }

    const foreignObject = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "foreignObject"
    );

    // Adjust position based on scale and angle
    const labelWidth = 60; // Original width
    const labelHeight = 20; // Original height
    const angle = clickedComponent.angle || 0;
    let xOffset = angle === 180 ? -labelWidth - 10 : -10; // Adjust for left or right alignment
    const scaledX = clickedComponent.x * scale + xOffset * scale + 20;
    const scaledY = clickedComponent.y * scale - (labelHeight / 2) * scale;

    foreignObject.setAttribute("x", scaledX);
    foreignObject.setAttribute("y", scaledY);
    foreignObject.setAttribute("width", labelWidth * scale);
    foreignObject.setAttribute("height", labelHeight * scale);
    foreignObject.setAttribute(
      "transform",
      `rotate(${angle} ${scaledX + (labelWidth * scale) / 2} ${
        scaledY + (labelHeight * scale) / 2
      })`
    );

    const input = document.createElement("input");
    input.type = "text";
    input.value = currentText;
    input.style.width = "100%";
    input.style.height = "100%";
    input.style.fontSize = `${12 * scale}px`; // Scale font size
    input.style.textAlign = "center";
    input.style.border = "none";
    input.style.background = "transparent";
    input.style.outline = "1px solid #000"; // Add outline for visibility
    foreignObject.appendChild(input);
    svg.appendChild(foreignObject);
    input.focus();

    editingLabel = {
      component: clickedComponent,
      foreignObject: foreignObject,
      input: input,
      index: index,
      isFinished: false,
    };

    const finishEditing = () => {
      if (!editingLabel || editingLabel.isFinished) return;
      editingLabel.isFinished = true;

      const newText = input.value.trim();
      const key = `${clickedComponent.type}.${clickedComponent.subtype}`;
      const drawer = componentDrawers[key];
      const newLabel = drawer.canvas(
        rc,
        clickedComponent.x, // Use original unscaled coordinates
        clickedComponent.y,
        null,
        null,
        clickedComponent.angle || 0,
        clickedComponent.seed,
        newText || "Label"
      );
      newLabel.text = newText || "Label";
      components.splice(index, 0, newLabel);
      redrawComponents();
      saveComponentsToStorage(components);

      if (svg.contains(foreignObject)) {
        svg.removeChild(foreignObject);
      }
      editingLabel = null;
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") finishEditing();
    });
    input.addEventListener("blur", finishEditing);
  }
});

function drawPalette() {
  const toolHeight = 40;
  const verticalSpacing = 10;
  const startY = 50;
  const xPos = paletteWidth / 2;

  tools.forEach((tool, index) => {
    const yPos = startY + index * (toolHeight + verticalSpacing);
    const key = `${tool.type}.${tool.subtype}`;
    const drawer = componentDrawers[key];

    if (drawer && !tool.element) {
      const component = drawer.palette(rc, xPos, yPos, tool.seed);
      tool.element = component.element;
      tool.x = xPos;
      tool.y = yPos;
      paletteGroup.appendChild(tool.element);

      tool.hitArea = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      tool.hitArea.setAttribute("x", xPos - 35);
      tool.hitArea.setAttribute("y", yPos - 20);
      tool.hitArea.setAttribute("width", "70");
      tool.hitArea.setAttribute("height", "40");
      tool.hitArea.setAttribute("fill", "transparent");
      tool.hitArea.style.cursor = "pointer";
      paletteGroup.appendChild(tool.hitArea);
    }
  });

  const clearButtonX = 20;
  const clearButtonY = 550;
  const clearButtonWidth = 60;
  const clearButtonHeight = 30;

  const clearButtonRect = rc.rectangle(
    clearButtonX,
    clearButtonY,
    clearButtonWidth,
    clearButtonHeight,
    {
      fill: "#ff9696",
      stroke: "#ccc",
      strokeWidth: 1,
      roughness: 0,
    }
  );

  const clearButtonText = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text"
  );
  clearButtonText.setAttribute("x", clearButtonX + clearButtonWidth / 2);
  clearButtonText.setAttribute("y", clearButtonY + clearButtonHeight / 2 + 5);
  clearButtonText.setAttribute("text-anchor", "middle");
  clearButtonText.setAttribute("font-size", "18");
  clearButtonText.setAttribute("fill", "black");
  clearButtonText.textContent = "Clear";

  const clearButtonGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g"
  );
  clearButtonGroup.appendChild(clearButtonRect);
  clearButtonGroup.appendChild(clearButtonText);

  const clearHitArea = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect"
  );
  clearHitArea.setAttribute("x", clearButtonX);
  clearHitArea.setAttribute("y", clearButtonY);
  clearHitArea.setAttribute("width", clearButtonWidth);
  clearHitArea.setAttribute("height", clearButtonHeight);
  clearHitArea.setAttribute("fill", "transparent");
  clearHitArea.style.cursor = "pointer";
  clearButtonGroup.appendChild(clearHitArea);

  paletteGroup.appendChild(clearButtonGroup);

  clearHitArea.addEventListener("click", () => {
    components = [];
    selectedComponent = null;
    redrawComponents();
    saveComponentsToStorage();
  });

  renderDeleteButton();
}

function renderDeleteButton() {
  const deleteButtonX = 35;
  const deleteButtonY = 500;
  const deleteButtonSize = 30;

  if (deleteButtonGroup && paletteGroup.contains(deleteButtonGroup)) {
    paletteGroup.removeChild(deleteButtonGroup);
  }

  const deleteButtonRect = rc.rectangle(
    deleteButtonX,
    deleteButtonY,
    deleteButtonSize,
    deleteButtonSize,
    {
      fill: selectedComponent ? "#ff4444" : "#cccccc",
      stroke: "#ccc",
      strokeWidth: 1,
      roughness: 0,
    }
  );

  const xLine1 = rc.line(
    deleteButtonX + 5,
    deleteButtonY + 5,
    deleteButtonX + deleteButtonSize - 5,
    deleteButtonY + deleteButtonSize - 5,
    { stroke: "black", strokeWidth: 2, roughness: 0 }
  );
  const xLine2 = rc.line(
    deleteButtonX + deleteButtonSize - 5,
    deleteButtonY + 5,
    deleteButtonX + 5,
    deleteButtonY + deleteButtonSize - 5,
    { stroke: "black", strokeWidth: 2, roughness: 0 }
  );

  deleteButtonGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g"
  );
  deleteButtonGroup.appendChild(deleteButtonRect);
  deleteButtonGroup.appendChild(xLine1);
  deleteButtonGroup.appendChild(xLine2);

  deleteHitArea = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect"
  );
  deleteHitArea.setAttribute("x", deleteButtonX);
  deleteHitArea.setAttribute("y", deleteButtonY);
  deleteHitArea.setAttribute("width", deleteButtonSize);
  deleteHitArea.setAttribute("height", deleteButtonSize);
  deleteHitArea.setAttribute("fill", "transparent");
  deleteHitArea.addEventListener("click", () => {
    if (selectedComponent) deleteComponent(selectedComponent);
  });

  deleteHitArea.style.cursor = selectedComponent ? "pointer" : "default";
  deleteButtonGroup.appendChild(deleteHitArea);

  paletteGroup.appendChild(deleteButtonGroup);
}

document.addEventListener("DOMContentLoaded", () => {
  drawPalette();
  const storedComponents = loadComponentsFromStorage();
  components = storedComponents
    .map((compData) => createComponentFromData(compData))
    .filter((comp) => comp !== null);
  components.forEach((comp) => svg.appendChild(comp.element));
  if (components.length === 0) {
    const centerX = 400;
    const centerY = 300;
    currentSeed = Math.floor(Math.random() * 10000);
    const resistor = componentDrawers["resistor.rectangle"].canvas(
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
    saveComponentsToStorage(components);
  }
  redrawComponents();
});

// document.getElementById("export-svg").addEventListener("click", () => {
//   const svgContent = new XMLSerializer().serializeToString(svg);
//   const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
//   const url = URL.createObjectURL(blob);
//   const link = document.createElement("a");
//   link.href = url;
//   link.download = "circuit-diagram.svg";
//   document.body.appendChild(link);
//   link.click();
//   document.body.removeChild(link);
//   URL.revokeObjectURL(url);
// });

document.getElementById("export-png").addEventListener("click", () => {
  const svgContent = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = parseInt(svg.getAttribute("width"));
  canvas.height = parseInt(svg.getAttribute("height"));

  // Add white background
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);

  img.onload = () => {
    context.drawImage(img, 0, 0);
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "circuit-diagram.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  img.src =
    "data:image/svg+xml;base64," +
    btoa(
      encodeURIComponent(svgContent).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
});

function createComponentFromData(compData) {
  const subtype = compData.subtype || "rectangle";
  const key = `${compData.type}.${subtype}`;
  const drawer = componentDrawers[key];
  if (!drawer) {
    console.error(`No drawer found for ${key}`);
    return null;
  }

  if (compData.type === "resistor") {
    return drawer.canvas(
      rc,
      compData.node1.x,
      compData.node1.y,
      compData.node2.x,
      compData.node2.y,
      compData.angle,
      compData.seed
    );
  } else if (compData.type === "label") {
    return drawer.canvas(
      rc,
      compData.x,
      compData.y,
      null,
      null,
      compData.angle,
      compData.seed,
      compData.text || "Label"
    );
  }
  return null;
}
function isPointInBBox(x, y, bbox) {
  return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY;
}

function deleteComponent(component) {
  svg.removeChild(component.element);
  const index = components.indexOf(component);
  if (index > -1) components.splice(index, 1);
  if (selectedComponent === component) selectedComponent = null;
  redrawComponents();
  saveComponentsToStorage(components);
}
