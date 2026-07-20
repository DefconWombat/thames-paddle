/**
 * EA gauging stations on the Thames between Lechlade and Henley.
 * Station references verified against the EA Flood Monitoring API.
 * typicalRange: [low, high] in metres — approximate normal operating range.
 */
export const thamesGauges = [
  {
    id: 'st-johns',
    name: "St John's Lock (Lechlade)",
    stationRef: '0701TH',
    lat: 51.68931,
    lng: -1.678796,
    riverMile: 0.5,
    typicalRange: [0.10, 0.60]
  },
  {
    id: 'buscot',
    name: 'Buscot Lock',
    stationRef: '0898TH',
    lat: 51.68119,
    lng: -1.668729,
    riverMile: 2.0,
    typicalRange: [0.00, 0.35]
  },
  {
    id: 'radcot',
    name: 'Radcot Lock',
    stationRef: '0902TH',
    lat: 51.699764,
    lng: -1.573094,
    riverMile: 10.0,
    typicalRange: [0.00, 0.32]
  },
  {
    id: 'northmoor',
    name: 'Northmoor Lock',
    stationRef: '1099TH',
    lat: 51.716858,
    lng: -1.374624,
    riverMile: 22.0,
    typicalRange: [0.10, 0.50]
  },
  {
    id: 'eynsham',
    name: 'Eynsham Lock',
    stationRef: '1201TH',
    lat: 51.774692,
    lng: -1.356854,
    riverMile: 25.0,
    typicalRange: [0.04, 0.37]
  },
  {
    id: 'godstow',
    name: 'Godstow Lock',
    stationRef: '1302TH',
    lat: 51.776669,
    lng: -1.298428,
    riverMile: 28.2,
    typicalRange: [0.10, 0.50]
  },
  {
    id: 'osney',
    name: 'Osney Lock (Oxford)',
    stationRef: '1303TH',
    lat: 51.74909,
    lng: -1.272781,
    riverMile: 30.0,
    typicalRange: [0.15, 0.55]
  },
  {
    id: 'iffley',
    name: 'Iffley Lock',
    stationRef: '1501TH',
    lat: 51.72955,
    lng: -1.239792,
    riverMile: 32.5,
    typicalRange: [0.15, 0.55]
  },
  {
    id: 'sandford',
    name: 'Sandford Lock',
    stationRef: '1502TH',
    lat: 51.708312,
    lng: -1.232825,
    riverMile: 34.4,
    typicalRange: [0.15, 0.60]
  },
  {
    id: 'abingdon',
    name: 'Abingdon Lock',
    stationRef: '1503TH',
    lat: 51.670388,
    lng: -1.268257,
    riverMile: 39.2,
    typicalRange: [0.10, 0.50]
  },
  {
    id: 'days-lock',
    name: "Day's Lock",
    stationRef: '1899TH',
    lat: 51.638206,
    lng: -1.179444,
    riverMile: 47.5,
    typicalRange: [0.00, 0.40]
  },
  {
    id: 'benson',
    name: 'Benson Lock',
    stationRef: '2001TH',
    lat: 51.617191,
    lng: -1.116011,
    riverMile: 50.5,
    typicalRange: [0.10, 0.50]
  },
  {
    id: 'goring',
    name: 'Goring Lock',
    stationRef: '2003TH',
    lat: 51.523317,
    lng: -1.141252,
    riverMile: 59.7,
    typicalRange: [0.05, 0.22]
  },
  {
    id: 'mapledurham',
    name: 'Mapledurham Lock',
    stationRef: '2199TH',
    lat: 51.486033,
    lng: -1.039654,
    riverMile: 65.0,
    typicalRange: [0.10, 0.50]
  },
  {
    id: 'caversham',
    name: 'Caversham Lock (Reading)',
    stationRef: '2201TH',
    lat: 51.460811,
    lng: -0.963635,
    riverMile: 70.5,
    typicalRange: [0.10, 0.50]
  },
  {
    id: 'sonning',
    name: 'Sonning Lock',
    stationRef: '2301TH',
    lat: 51.473138,
    lng: -0.917727,
    riverMile: 74.2,
    typicalRange: [0.10, 0.50]
  },
  {
    id: 'shiplake',
    name: 'Shiplake Lock',
    stationRef: '2302TH',
    lat: 51.501042,
    lng: -0.886307,
    riverMile: 76.5,
    typicalRange: [0.10, 0.50]
  },
  {
    id: 'marsh',
    name: 'Marsh Lock (Henley)',
    stationRef: '2495TH',
    lat: 51.528776,
    lng: -0.885703,
    riverMile: 79.0,
    typicalRange: [0.10, 0.50]
  }
];
