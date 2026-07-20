/**
 * Campsites accessible from the river — Lechlade to Henley
 * Includes EA lock campsites and nearby commercial sites.
 * Lock campsites are basic (toilets, water) and first-come-first-served unless noted.
 */
export const campsites = [
  {
    id: 'bridge-house-lechlade',
    name: 'Bridge House Campsite',
    lat: 51.6920,
    lng: -1.6930,
    riverMile: 0.0,
    type: 'commercial',
    notes: 'In Lechlade, right by the river. Full facilities. Good base for starting a trip.',
    bookable: true,
    facilities: ['toilets', 'showers', 'water', 'electric'],
    phone: '01367 252348'
  },
  {
    id: 'rushey-lock-camp',
    name: 'Rushey Lock Campsite',
    lat: 51.6978,
    lng: -1.5341,
    riverMile: 10.0,
    type: 'lock',
    notes: 'EA lock campsite. One of the most peaceful spots on the Thames. Basic facilities. Step off your kayak and pitch.',
    bookable: false,
    facilities: ['toilets', 'water'],
    phone: '01367 870218'
  },
  {
    id: 'shifford-lock-camp',
    name: 'Shifford Lock Campsite',
    lat: 51.7065,
    lng: -1.4659,
    riverMile: 13.5,
    type: 'lock',
    notes: 'EA lock campsite. Very quiet and remote. Basic facilities only.',
    bookable: false,
    facilities: ['toilets', 'water'],
    phone: '01367 870247'
  },
  {
    id: 'northmoor-lock-camp',
    name: 'Northmoor Lock Campsite',
    lat: 51.7160,
    lng: -1.3775,
    riverMile: 16.3,
    type: 'lock',
    notes: 'EA lock campsite in open meadows. Basic but beautiful setting.',
    bookable: false,
    facilities: ['toilets', 'water'],
    phone: '01865 864607'
  },
  {
    id: 'pinkhill-lock-camp',
    name: 'Pinkhill Lock Campsite',
    lat: 51.7609,
    lng: -1.3639,
    riverMile: 22.6,
    type: 'lock',
    notes: 'EA lock campsite. Near Farmoor Reservoir. Can be overgrown in summer.',
    bookable: false,
    facilities: ['toilets', 'water'],
    phone: '01865 881452'
  },
  {
    id: 'eynsham-lock-camp',
    name: 'Eynsham Lock Campsite',
    lat: 51.7743,
    lng: -1.3579,
    riverMile: 24.2,
    type: 'lock',
    notes: 'EA lock campsite. Slightly more accessible than Pinkhill.',
    bookable: false,
    facilities: ['toilets', 'water'],
    phone: '01865 881324'
  },
  {
    id: 'kings-lock-camp',
    name: "King's Lock Campsite",
    lat: 51.7884,
    lng: -1.3084,
    riverMile: 28.9,
    type: 'lock',
    notes: 'Essentially wild camping with minimal facilities. Very basic — toilet only.',
    bookable: false,
    facilities: ['toilets'],
    phone: '01865 553403'
  },
  {
    id: 'days-lock-camp',
    name: "Day's Lock Campsite",
    lat: 51.6383,
    lng: -1.1792,
    riverMile: 47.5,
    type: 'lock',
    notes: 'EA lock campsite. Beautiful spot near Dorchester-on-Thames. Wittenham Clumps nearby.',
    bookable: false,
    facilities: ['toilets', 'water'],
    phone: '01865 407768'
  },
  {
    id: 'swiss-farm',
    name: 'Swiss Farm Touring & Camping',
    lat: 51.5420,
    lng: -0.9040,
    riverMile: 80.0,
    type: 'commercial',
    notes: 'Large, well-equipped campsite near Henley. About 0.5 mile walk from the river. Good end-of-trip option.',
    bookable: true,
    facilities: ['toilets', 'showers', 'water', 'electric', 'shop', 'laundry'],
    phone: '01491 573419'
  }
];
