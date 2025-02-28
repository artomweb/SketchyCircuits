const STORAGE_KEY = "circuitComponents";
// Function to load components from local storage (returns plain objects)
export function loadComponentsFromStorage() {
  const storedData = localStorage.getItem(STORAGE_KEY);
  if (storedData) {
    return JSON.parse(storedData);
  }
  return []; // Return empty array if no data
}

export function saveComponentsToStorage(components) {
  const serializableComponents =
    components?.map((comp) => ({
      type: comp.type,
      subtype: comp.subtype,
      x: comp.x,
      y: comp.y,
      angle: comp.angle,
      seed: comp.seed,
      text: comp.text, // For labels
      node1: comp.node1, // For resistors
      node2: comp.node2, // For resistors
    })) || [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableComponents));
}
