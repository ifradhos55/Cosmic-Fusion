export const planetData = [
    {
        name: "Mercury", size: 2, distance: 35, color: "#9E9E9E", type: "rocky", tilt: 0.03,
        orbitalPeriod: 0.24, rotationPeriod: 58.6,
        details: { temp: "167°C", speed: "47.4 km/s", atmo: "Trace", wind: "Sun-blasted" },
        moons: []
    },
    {
        name: "Venus", size: 3.5, distance: 50, color: "#D4AF37", type: "gas", tilt: 177.3,
        orbitalPeriod: 0.61, rotationPeriod: -243,
        details: { temp: "464°C", speed: "35.0 km/s", atmo: "CO2 (Thick)", wind: "Acid Clouds" },
        moons: []
    },
    {
        name: "Earth", size: 4, distance: 70, color: "#2E5D9F", type: "earth", tilt: 23.5,
        orbitalPeriod: 1.0, rotationPeriod: 1.0,
        details: { temp: "15°C", speed: "29.8 km/s", atmo: "N2, O2", wind: "Life Sustaining" },
        moons: [
            { name: "The Moon", size: 1.0, distance: 12, color: "#CCCCCC", speed: 0.1, details: { temp: "-53°C", speed: "1.02 km/s", atmo: "None", wind: "Tidally Locked" } }
        ]
    },
    {
        name: "Mars", size: 2.2, distance: 90, color: "#B03A2E", type: "rocky", tilt: 25.2,
        orbitalPeriod: 1.88, rotationPeriod: 1.03,
        details: { temp: "-65°C", speed: "24.1 km/s", atmo: "CO2 (Thin)", wind: "Dust Storms" },
        moons: [
            { name: "Phobos", size: 0.8, distance: 6.5, color: "#886655", speed: 0.3, details: { temp: "-4°C", speed: "2.13 km/s", atmo: "None", wind: "Doomed Orbit" } },
            { name: "Deimos", size: 0.8, distance: 7, color: "#997766", speed: 0.15, details: { temp: "-40°C", speed: "1.35 km/s", atmo: "None", wind: "Asteroid-like" } }
        ]
    },
    {
        name: "Jupiter", size: 10, distance: 140, color: "#C88B3A", type: "gas", tilt: 3.1,
        orbitalPeriod: 11.86, rotationPeriod: 0.41,
        details: { temp: "-110°C", speed: "13.1 km/s", atmo: "H2, He", wind: "Great Red Spot" },
        moons: [
            { name: "Io", size: 0.8, distance: 23, color: "#DDCC55", speed: 0.2, details: { temp: "-143°C", speed: "17 km/s", atmo: "Sulfur", wind: "Volcanic" } },
            { name: "Europa", size: 0.7, distance: 26, color: "#AACCFF", speed: 0.15, details: { temp: "-160°C", speed: "13 km/s", atmo: "Oxygen (Trace)", wind: "Ice Shell" } },
            { name: "Ganymede", size: 1.2, distance: 30, color: "#998877", speed: 0.1, details: { temp: "-163°C", speed: "10 km/s", atmo: "Oxygen (Trace)", wind: "Magnetic Field" } },
            { name: "Callisto", size: 1.1, distance: 35, color: "#665544", speed: 0.08, details: { temp: "-171°C", speed: "8 km/s", atmo: "CO2 (Trace)", wind: "Ancient Surface" } }
        ]
    },
    {
        name: "Saturn", size: 8.5, distance: 190, color: "#C5AB6E", type: "gas", tilt: 26.7, hasRings: true,
        orbitalPeriod: 29.45, rotationPeriod: 0.45,
        details: { temp: "-140°C", speed: "9.7 km/s", atmo: "H2, He", wind: "Hexagon Storm" },
        moons: [
            { name: "Titan", size: 1.1, distance: 18, color: "#DDAA44", speed: 0.1, details: { temp: "-179°C", speed: "5.57 km/s", atmo: "Nitrogen (Thick)", wind: "Methane Lakes" } },
            { name: "Enceladus", size: 0.4, distance: 12, color: "#EEEEFF", speed: 0.3, details: { temp: "-201°C", speed: "12.6 km/s", atmo: "Water Vapor", wind: "Ice Geysers" } }
        ]
    },
    {
        name: "Uranus", size: 5, distance: 240, color: "#4FD0E7", type: "gas", tilt: 97.8, hasRings: true,
        orbitalPeriod: 84.0, rotationPeriod: -0.72,
        details: { temp: "-195°C", speed: "6.8 km/s", atmo: "H2, He, CH4", wind: "Sideways World" },
        moons: [
            { name: "Titania", size: 0.5, distance: 8, color: "#CCCCCC", speed: 0.1, details: { temp: "-203°C", speed: "3.6 km/s", atmo: "None", wind: "Canyons" } },
            { name: "Oberon", size: 0.5, distance: 10, color: "#BBBBBB", speed: 0.08, details: { temp: "-203°C", speed: "3.1 km/s", atmo: "None", wind: "Craters" } }
        ]
    },
    {
        name: "Neptune", size: 4.8, distance: 280, color: "#2933CF", type: "gas", tilt: 28.3,
        orbitalPeriod: 164.8, rotationPeriod: 0.67,
        details: { temp: "-200°C", speed: "5.4 km/s", atmo: "H2, He, CH4", wind: "Supersonic Winds" },
        moons: [
            { name: "Triton", size: 0.8, distance: 8, color: "#FFDDDD", speed: -0.1, details: { temp: "-235°C", speed: "4.3 km/s", atmo: "Nitrogen", wind: "Retrograde Orbit" } } // Retrograde
        ]
    }
];
