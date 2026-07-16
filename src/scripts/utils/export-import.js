/**
 * JSON Room Layout Exporter & Importer Module
 * Allows downloading room layouts as JSON and importing external JSON room files.
 */

export function exportRoomLayoutJSON(state, roomName = 'Coworking Room') {
  const payload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    roomName: roomName,
    gridW: state.gridW || 8,
    gridD: state.gridD || 6,
    floor: state.floor || 'light-wood',
    leftWall: state.leftWall || 'white',
    rightWall: state.rightWall || 'warm-beige',
    items: state.items || [],
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${roomName.toLowerCase().replace(/\s+/g, '-')}-layout.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function openJSONImportPicker(onSuccess, onError) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';

  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.items || !Array.isArray(parsed.items)) {
          throw new Error('Invalid room layout format');
        }
        if (onSuccess) onSuccess(parsed);
      } catch (err) {
        if (onError) onError(err.message || 'Error parsing JSON file');
      }
    };
    reader.readAsText(file);
  };

  input.click();
}
