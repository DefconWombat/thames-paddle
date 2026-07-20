/**
 * Public car parks within short walking distance of the River Thames — Lechlade to Henley.
 * Focused on parking useful for kayakers: near launch/landing sites or riverside pubs.
 */
export const parking = [
  {
    id: 'park-lechlade-riverside',
    name: 'Lechlade Riverside Car Park',
    lat: 51.6915,
    lng: -1.6935,
    riverMile: 0.0,
    type: 'free',
    notes: 'Small free car park by Halfpenny Bridge. Very close to the river — main put-in for the upper Thames.',
    walkMin: 1,
    nearAccess: 'lechlade-halfpenny'
  },
  {
    id: 'park-radcot-layby',
    name: 'Radcot Bridge Layby',
    lat: 51.6935,
    lng: -1.5895,
    riverMile: 6.4,
    type: 'free',
    notes: 'Informal layby near Radcot Bridge. The Swan pub also allows parking for patrons.',
    walkMin: 2,
    nearAccess: 'radcot-bridge'
  },
  {
    id: 'park-tadpole-layby',
    name: 'Tadpole Bridge Layby',
    lat: 51.7025,
    lng: -1.5175,
    riverMile: 10.5,
    type: 'free',
    notes: 'Small roadside layby near Tadpole Bridge. Avoid The Trout pub car park — use the layby instead.',
    walkMin: 2,
    nearAccess: 'tadpole-bridge'
  },
  {
    id: 'park-newbridge',
    name: 'Newbridge Roadside',
    lat: 51.7068,
    lng: -1.4180,
    riverMile: 16.5,
    type: 'free',
    notes: 'Informal roadside parking near Newbridge. Can be busy on sunny weekends. The Maybush pub also has a car park for patrons.',
    walkMin: 2,
    nearAccess: 'newbridge'
  },
  {
    id: 'park-swinford-tollbridge',
    name: 'Swinford Toll Bridge Layby',
    lat: 51.7750,
    lng: -1.3600,
    riverMile: 24.8,
    type: 'free',
    notes: 'Layby near Swinford toll bridge (5p toll). Easy river access from the bridge area.',
    walkMin: 3,
    nearAccess: 'swinford-bridge'
  },
  {
    id: 'park-port-meadow',
    name: 'Wolvercote Car Park (Port Meadow)',
    lat: 51.7758,
    lng: -1.2932,
    riverMile: 28.5,
    type: 'free',
    notes: 'Free car park at Wolvercote Green, gateway to Port Meadow. Short walk across the meadow to the river.',
    walkMin: 8,
    nearAccess: 'port-meadow'
  },
  {
    id: 'park-oxford-folly-bridge',
    name: 'Oxpens Car Park',
    lat: 51.7482,
    lng: -1.2620,
    riverMile: 30.8,
    type: 'pay',
    notes: 'Pay-and-display near Folly Bridge, Oxford. Closest parking to the main Oxford river access. Can fill up.',
    walkMin: 3,
    nearAccess: 'oxford-folly-bridge'
  },
  {
    id: 'park-donnington-bridge',
    name: 'Donnington Bridge Road',
    lat: 51.7358,
    lng: -1.2428,
    riverMile: 31.5,
    type: 'free',
    notes: 'Roadside parking near Donnington Bridge. Residential area, please park considerately.',
    walkMin: 2,
    nearAccess: 'donnington-bridge'
  },
  {
    id: 'park-abingdon-rye-farm',
    name: 'Rye Farm Car Park',
    lat: 51.6690,
    lng: -1.2760,
    riverMile: 39.2,
    type: 'free',
    notes: 'Free car park right by the river in Abingdon. Popular with walkers. Good launch spot.',
    walkMin: 1,
    nearAccess: 'abingdon-bridge'
  },
  {
    id: 'park-clifton-hampden',
    name: 'Clifton Hampden Bridge',
    lat: 51.6548,
    lng: -1.2110,
    riverMile: 45.0,
    type: 'free',
    notes: 'Small amount of parking near Clifton Hampden bridge. The Barley Mow pub is very close.',
    walkMin: 2,
    nearAccess: 'clifton-hampden-bridge'
  },
  {
    id: 'park-days-lock',
    name: "Day's Lock Car Park",
    lat: 51.6390,
    lng: -1.1800,
    riverMile: 47.5,
    type: 'free',
    notes: 'Small EA car park near the lock. Popular with Wittenham Clumps walkers. Can fill early on weekends.',
    walkMin: 3,
    nearAccess: 'days-lock'
  },
  {
    id: 'park-wallingford-thames-st',
    name: 'Thames Street Car Park',
    lat: 51.6010,
    lng: -1.1235,
    riverMile: 52.9,
    type: 'pay',
    notes: 'Council car park in Wallingford, very close to the river. Pay-and-display. Well maintained.',
    walkMin: 2,
    nearAccess: 'wallingford-bridge'
  },
  {
    id: 'park-goring-station',
    name: 'Goring Station Car Park',
    lat: 51.5218,
    lng: -1.1300,
    riverMile: 59.7,
    type: 'pay',
    notes: 'GWR station car park. Also useful for shuttle trips — train back to your car. Short walk to river.',
    walkMin: 5,
    nearAccess: 'goring-bridge'
  },
  {
    id: 'park-pangbourne-meadow',
    name: 'Pangbourne Recreation Ground',
    lat: 51.4865,
    lng: -1.0860,
    riverMile: 63.8,
    type: 'free',
    notes: 'Car park near the recreation ground and Whitchurch Bridge. Easy river access.',
    walkMin: 3,
    nearAccess: 'pangbourne-whitchurch'
  },
  {
    id: 'park-reading-thames-promenade',
    name: 'Hills Meadow Car Park',
    lat: 51.4580,
    lng: -0.9650,
    riverMile: 70.5,
    type: 'pay',
    notes: 'Large car park by the Thames in Reading. Near Caversham Bridge. Pay-and-display.',
    walkMin: 2,
    nearAccess: 'reading-caversham'
  },
  {
    id: 'park-sonning',
    name: 'Sonning Village Car Park',
    lat: 51.4750,
    lng: -0.9158,
    riverMile: 74.2,
    type: 'free',
    notes: 'Small free car park in Sonning. Short walk to the bridge and river.',
    walkMin: 4,
    nearAccess: 'sonning-bridge'
  },
  {
    id: 'park-henley-meadows',
    name: 'Mill Meadows Car Park',
    lat: 51.5355,
    lng: -0.8990,
    riverMile: 80.8,
    type: 'pay',
    notes: 'Council car park right by the river. Perfect for Henley put-in/take-out. Can be very busy during regatta.',
    walkMin: 1,
    nearAccess: 'henley-bridge'
  },
  {
    id: 'park-henley-kings-road',
    name: 'Kings Road Car Park',
    lat: 51.5365,
    lng: -0.9030,
    riverMile: 80.8,
    type: 'pay',
    notes: 'Larger council car park in Henley. Slightly further from the river but more spaces.',
    walkMin: 5,
    nearAccess: 'henley-bridge'
  }
];
