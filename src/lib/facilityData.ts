export const facilityEquipment: Record<string, string[]> = {
  "Pavia Plant": ["Clarifier Sub-Tank A", "Clarifier Sub-Tank B", "Intake Pump 1", "Intake Pump 2", "Genset PV-01"],
  "PR2 Plant": ["PR2 Main Tank", "PR2 Booster Pump 1", "PR2 Booster Pump 2", "Genset PR-02"],
  "Wakeboard": ["Wakeboard Reservoir", "Wakeboard Pump 1", "Genset WB-01"],
  "BAR": ["BAR Delivery Pump 1", "BAR Generator"],
  "DHP: Phase 1": ["DHP Phase 1 Overhead Tank", "DHP Well Pump 1"],
  "DHP: Phase 2": ["DHP Phase 2 Overhead Tank", "DHP Well Pump 2"],
};

export const facilitiesList = Object.keys(facilityEquipment);

export const facilityCoordinates: Record<string, [number, number]> = {
  "Pavia Plant": [10.7252, 122.5621],
  "PR2 Plant": [10.7052, 122.5821],
  "Wakeboard": [10.6902, 122.5321],
  "BAR": [10.7452, 122.5621],
  "DHP: Phase 1": [10.7652, 122.5521],
  "DHP: Phase 2": [10.7552, 122.5421],
};
