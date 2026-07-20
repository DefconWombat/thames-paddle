/**
 * Kayak/Canoe Access Points — Thames, Lechlade to Henley
 *
 * vehicleAccess: can you drive a car to or very near the water?
 * footpathOnly:  only reachable on foot (may be fine for inflatables)
 * rigidHull:     suitable for launching a rigid kayak (vehicle access + gentle bank)
 * inflatable:    suitable for inflatable / packable boat
 */
export const accessPoints = [
  {
    id: 'lechlade',
    name: 'Lechlade (Halfpenny Bridge)',
    lat: 51.6924,
    lng: -1.6924,
    riverMile: 0.0,
    type: 'slipway',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '20m',
      parkingNotes: 'Free car park by Riverside Park, just off the A361. Easy access.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'toilets', 'pub', 'shop'],
    notes: 'Excellent start point. Gentle grassy bank. The New Inn and other pubs in town. Official head of navigation for powered craft.'
  },
  {
    id: 'radcot-bridge',
    name: 'Radcot Bridge',
    lat: 51.6931,
    lng: -1.5886,
    riverMile: 6.4,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '30m',
      parkingNotes: 'Small layby/car park near the bridge. Can fill up on busy days.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'pub'],
    notes: 'Access downstream of the old bridge on the south bank. The Swan Hotel right at the bridge. Historic bridge — oldest on the Thames.'
  },
  {
    id: 'tadpole-bridge',
    name: 'Tadpole Bridge',
    lat: 51.7022,
    lng: -1.5166,
    riverMile: 10.5,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '40m',
      parkingNotes: 'Small car park by The Trout Inn.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'pub'],
    notes: 'The Trout Inn is an excellent riverside pub. Gentle bank access near the bridge.'
  },
  {
    id: 'newbridge',
    name: 'Newbridge',
    lat: 51.7060,
    lng: -1.4170,
    riverMile: 16.5,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '30m',
      parkingNotes: 'Car park at The Maybush pub or The Rose Revived.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'pub'],
    notes: 'Two good pubs here. 13th century bridge. Easy launch from grassy bank. Popular starting point.'
  },
  {
    id: 'bablock-hythe',
    name: 'Bablock Hythe',
    lat: 51.7370,
    lng: -1.3750,
    riverMile: 20.2,
    type: 'slipway',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '20m',
      parkingNotes: 'Car park at the old ferry point.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking'],
    notes: 'Historic ferry crossing point. Good concrete slipway. The Ferryman Inn (check opening).'
  },
  {
    id: 'pinkhill-meadow',
    name: 'Farmoor / Pinkhill Meadow',
    lat: 51.7580,
    lng: -1.3680,
    riverMile: 22.6,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '200m',
      parkingNotes: 'Farmoor Reservoir car park (may have charges). Walk to river.'
    },
    suitability: { rigidHull: false, inflatable: true, easyLaunch: false },
    facilities: ['parking', 'toilets'],
    notes: '200m walk from car park to river. Better for inflatables. Farmoor Reservoir café nearby.'
  },
  {
    id: 'swinford',
    name: 'Swinford Bridge',
    lat: 51.7746,
    lng: -1.3596,
    riverMile: 24.2,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '50m',
      parkingNotes: 'Limited roadside parking near the toll bridge.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: false },
    facilities: ['parking'],
    notes: 'Toll bridge (5p for cars!). Bank can be steep. Better access upstream of the bridge on south bank.'
  },
  {
    id: 'wolvercote',
    name: 'Wolvercote (Port Meadow)',
    lat: 51.7750,
    lng: -1.2960,
    riverMile: 28.2,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '150m',
      parkingNotes: 'Wolvercote car park off Godstow Road. Short walk across Port Meadow.'
    },
    suitability: { rigidHull: false, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'pub'],
    notes: 'The Trout Inn at Godstow. Beautiful meadow walk to river. Port Meadow can flood in winter. Cattle and horses roam freely.'
  },
  {
    id: 'oxford-botley',
    name: 'Oxford (Botley Road)',
    lat: 51.7490,
    lng: -1.2710,
    riverMile: 30.6,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '100m',
      parkingNotes: 'Osney Lane or nearby streets. Can be difficult to park in Oxford.'
    },
    suitability: { rigidHull: false, inflatable: true, easyLaunch: false },
    facilities: ['shop', 'pub', 'toilets'],
    notes: 'Central Oxford — lots of facilities but parking is a challenge. Better as an inflatable launch point.'
  },
  {
    id: 'donnington-bridge',
    name: 'Donnington Bridge',
    lat: 51.7356,
    lng: -1.2421,
    riverMile: 32.3,
    type: 'slipway',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '30m',
      parkingNotes: 'Car park at Donnington Bridge Road. Free but can fill up.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking'],
    notes: 'Slipway with vehicle access. Busy with rowers — be aware of rowing traffic especially early morning and evening.'
  },
  {
    id: 'sandford-village',
    name: 'Sandford-on-Thames',
    lat: 51.7085,
    lng: -1.2320,
    riverMile: 34.4,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '80m',
      parkingNotes: 'Village parking near the King\'s Arms pub.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: false },
    facilities: ['parking', 'pub'],
    notes: 'King\'s Arms pub adjacent to the lock. CAUTION: Sandford Weir is extremely dangerous — stay well clear.'
  },
  {
    id: 'abingdon-town',
    name: 'Abingdon',
    lat: 51.6710,
    lng: -1.2740,
    riverMile: 39.2,
    type: 'slipway',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '50m',
      parkingNotes: 'Rye Farm car park or Abbey Meadow car park. Both Pay & Display.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'toilets', 'pub', 'shop', 'cafe'],
    notes: 'Excellent facilities. Abbey Meadow has toilets and café. Multiple pubs. Good slipway near the bridge.'
  },
  {
    id: 'clifton-hampden',
    name: 'Clifton Hampden',
    lat: 51.6546,
    lng: -1.2106,
    riverMile: 45.0,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '60m',
      parkingNotes: 'Small car park near the bridge. The Barley Mow pub has parking for customers.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'pub'],
    notes: 'Picturesque brick bridge. The Barley Mow pub (Jerome K. Jerome drank here). Gentle bank access downstream of bridge.'
  },
  {
    id: 'dorchester',
    name: 'Dorchester-on-Thames (Day\'s Lock)',
    lat: 51.6400,
    lng: -1.1810,
    riverMile: 47.5,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '200m',
      parkingNotes: 'Car park in Dorchester village. Walk to the river via the meadow.'
    },
    suitability: { rigidHull: false, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'pub', 'shop', 'toilets'],
    notes: 'Beautiful historic village. 200m walk to river — fine for inflatables. Wittenham Clumps viewpoint nearby.'
  },
  {
    id: 'shillingford',
    name: 'Shillingford Bridge',
    lat: 51.6242,
    lng: -1.1396,
    riverMile: 50.2,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '30m',
      parkingNotes: 'Shillingford Bridge Hotel car park (for customers) or roadside.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'pub'],
    notes: 'Hotel at the bridge. Gentle bank access on the south side.'
  },
  {
    id: 'wallingford',
    name: 'Wallingford',
    lat: 51.6007,
    lng: -1.1204,
    riverMile: 52.9,
    type: 'slipway',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '50m',
      parkingNotes: 'Riverside car park (Pay & Display). Good access.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'toilets', 'pub', 'shop', 'cafe'],
    notes: 'Market town with excellent facilities. Public slipway. Boat & bike hire available. Good halfway point for Lechlade–Henley trip.'
  },
  {
    id: 'moulsford',
    name: 'Moulsford',
    lat: 51.5540,
    lng: -1.1470,
    riverMile: 56.9,
    type: 'bank_access',
    access: {
      vehicleAccess: false,
      footpathOnly: true,
      distanceFromParking: '400m',
      parkingNotes: 'Limited roadside parking in village. Walk to river via footpath.'
    },
    suitability: { rigidHull: false, inflatable: true, easyLaunch: false },
    facilities: [],
    notes: 'Footpath-only access. The Beetle & Wedge pub (if open). Inflatable boats only.'
  },
  {
    id: 'goring-village',
    name: 'Goring & Streatley',
    lat: 51.5220,
    lng: -1.1340,
    riverMile: 59.7,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '80m',
      parkingNotes: 'Goring station car park or village car park. Short walk to river.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'toilets', 'pub', 'shop', 'cafe', 'train_station'],
    notes: 'Train station — opens up one-way trip options. Good pubs both sides. The Goring Gap is scenic. Popular spot.'
  },
  {
    id: 'pangbourne',
    name: 'Pangbourne',
    lat: 51.4870,
    lng: -1.0870,
    riverMile: 63.8,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '100m',
      parkingNotes: 'Pangbourne Meadow car park. Walk through the meadow to the river.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'toilets', 'pub', 'shop', 'cafe', 'train_station'],
    notes: 'Charming village. Kenneth Grahame (Wind in the Willows) lived here. Train station for one-way trips. Whitchurch toll bridge.'
  },
  {
    id: 'mapledurham-village',
    name: 'Mapledurham',
    lat: 51.4840,
    lng: -1.0420,
    riverMile: 66.2,
    type: 'bank_access',
    access: {
      vehicleAccess: false,
      footpathOnly: true,
      distanceFromParking: '500m',
      parkingNotes: 'Very limited. Footpath access only from the village.'
    },
    suitability: { rigidHull: false, inflatable: true, easyLaunch: false },
    facilities: [],
    notes: 'Historic Mapledurham House and watermill. Footpath-only access — inflatables only. Beautiful but remote.'
  },
  {
    id: 'reading-thames',
    name: 'Reading (Thames-side Promenade)',
    lat: 51.4580,
    lng: -0.9720,
    riverMile: 70.5,
    type: 'slipway',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '100m',
      parkingNotes: 'Various car parks in Reading. King\'s Meadow car park is closest.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'toilets', 'pub', 'shop', 'cafe', 'train_station'],
    notes: 'Major town with all facilities. Slipway near Caversham Bridge. Busy stretch with rowers and boats.'
  },
  {
    id: 'sonning-village',
    name: 'Sonning',
    lat: 51.4757,
    lng: -0.9139,
    riverMile: 74.1,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '80m',
      parkingNotes: 'Small car park in village. Can be busy weekends.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'pub'],
    notes: 'One of the prettiest villages on the Thames. The Bull Inn is excellent. George Clooney reportedly lives here.'
  },
  {
    id: 'wargrave',
    name: 'Wargrave',
    lat: 51.5007,
    lng: -0.8658,
    riverMile: 77.4,
    type: 'bank_access',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '100m',
      parkingNotes: 'Village car park. Walk to river.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'pub', 'shop'],
    notes: 'Quiet village with river access near the church. St George & Dragon pub.'
  },
  {
    id: 'henley',
    name: 'Henley-on-Thames',
    lat: 51.5375,
    lng: -0.9003,
    riverMile: 80.8,
    type: 'slipway',
    access: {
      vehicleAccess: true,
      footpathOnly: false,
      distanceFromParking: '50m',
      parkingNotes: 'Mill Meadows car park (Pay & Display) right by the river. Several other car parks in town.'
    },
    suitability: { rigidHull: true, inflatable: true, easyLaunch: true },
    facilities: ['parking', 'toilets', 'pub', 'shop', 'cafe', 'train_station'],
    notes: 'Excellent end point. Famous for the Royal Regatta. River & Rowing Museum. Many pubs and restaurants. Train station for return journey.'
  }
];
