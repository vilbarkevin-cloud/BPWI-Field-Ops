export const defaultStaff = [
  "Kevin Vilbar - Technical Head",
  "Charel Culasino - Water Maintenance",
  "Aladen Pareño - Water Maintenance",
  "Armandico Honorio - Water Maintenance",
  "Jerome Pagsuguiron - Water Maintenance",
  "Gerald Romaldon - Leak Detection",
  "Jose Marie Alipala Jr - Water Supply Specialist",
  "Rheynante Toledo - Water Supply Specialist",
  "Exo John Rogador - Water Supply Specialist",
  "John Paul Valencia - Water Maintenance",
  "L Alave - Water Maintenance",
  "Jasson Salarda - Leak Detection",
  "Franz Justin Grajo - Water Supply Specialist",
  "Ghelson Viejo - Electro Mechanical",
];

export const areasAndSites = [
  { area: "DHP", name: "DHP", sites: ["DHP 1", "DHP 2"] },
  { area: "PRR", name: "PRR", sites: ["Village 1", "Village 2", "Village 3"] },
  { area: "PR2", name: "PR2", sites: ["Phase 1", "Phase 2", "Phase 3"] },
  {
    area: "BAR",
    name: "BAR",
    sites: ["Site 1", "Site 2", "Site 3", "Site 4", "Site 5"],
  },
  {
    area: "LEG",
    name: "LEG",
    sites: ["Site 1", "Site 2", "Site 3", "Site 4", "Site 5"],
  },
  {
    area: "PAVIA",
    name: "Pavia Plant",
    sites: ["Plant 1", "Plant 2", "Filters", "Pumps"],
  },
  {
    area: "WAKEBOARD",
    name: "Wakeboard Plant",
    sites: ["Main Facility", "Pump Area"],
  },
];

export const generateFacilities = () => {
  const facilities = [];
  for (const { area, name, sites } of areasAndSites) {
    for (let i = 1; i <= 5; i++) {
      facilities.push(`${area} - Well ${i}`);
      facilities.push(`${area} - Tank ${i}`);
    }
  }
  return facilities;
};

export const defaultFacilities = generateFacilities();

export const generateSites = () => {
  const sitesList = [];
  for (const { area, sites } of areasAndSites) {
    for (const site of sites) {
      sitesList.push(`${area} - ${site}`);
    }
  }
  return sitesList;
};

export const defaultSites = generateSites();
