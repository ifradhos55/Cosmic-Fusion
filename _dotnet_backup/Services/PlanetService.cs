using System.Collections.Generic;
using CosmicFusion.Models;

namespace CosmicFusion.Services
{
    public class PlanetService
    {
        public List<Planet> GetPlanets()
        {
            return new List<Planet>
            {
                new Planet {
                    Name = "Mercury", Size = 2, Distance = 35, Color = "#9E9E9E", Type = "rocky", Tilt = 0.03,
                    OrbitalPeriod = 0.24, RotationPeriod = 58.6,
                    Details = new PlanetDetails { Temp = "167°C", Speed = "47.4 km/s", Atmo = "Trace", Wind = "Sun-blasted" }
                },
                new Planet {
                    Name = "Venus", Size = 3.5, Distance = 50, Color = "#D4AF37", Type = "gas", Tilt = 177.3,
                    OrbitalPeriod = 0.61, RotationPeriod = -243,
                    Details = new PlanetDetails { Temp = "464°C", Speed = "35.0 km/s", Atmo = "CO2 (Thick)", Wind = "Acid Clouds" }
                },
                new Planet {
                    Name = "Earth", Size = 4, Distance = 70, Color = "#2E5D9F", Type = "earth", Tilt = 23.5,
                    OrbitalPeriod = 1.0, RotationPeriod = 1.0,
                    Details = new PlanetDetails { Temp = "15°C", Speed = "29.8 km/s", Atmo = "N2, O2", Wind = "Life Sustaining" },
                    Moons = new List<Moon> {
                        new Moon { Name = "The Moon", Size = 1.0, Distance = 12, Color = "#CCCCCC", Speed = 0.1, Details = new PlanetDetails { Temp = "-53°C", Speed = "1.02 km/s", Atmo = "None", Wind = "Tidally Locked" } }
                    }
                },
                new Planet {
                    Name = "Mars", Size = 2.2, Distance = 90, Color = "#B03A2E", Type = "rocky", Tilt = 25.2,
                    OrbitalPeriod = 1.88, RotationPeriod = 1.03,
                    Details = new PlanetDetails { Temp = "-65°C", Speed = "24.1 km/s", Atmo = "CO2 (Thin)", Wind = "Dust Storms" },
                    Moons = new List<Moon> {
                        new Moon { Name = "Phobos", Size = 0.8, Distance = 8.5, Color = "#886655", Speed = 0.3, Details = new PlanetDetails { Temp = "-4°C", Speed = "2.13 km/s", Atmo = "None", Wind = "Doomed Orbit" } },
                        new Moon { Name = "Deimos", Size = 0.8, Distance = 9, Color = "#997766", Speed = 0.15, Details = new PlanetDetails { Temp = "-40°C", Speed = "1.35 km/s", Atmo = "None", Wind = "Asteroid-like" } }
                    }
                },
                new Planet {
                    Name = "Jupiter", Size = 10, Distance = 140, Color = "#C88B3A", Type = "gas", Tilt = 3.1,
                    OrbitalPeriod = 11.86, RotationPeriod = 0.41,
                    Details = new PlanetDetails { Temp = "-110°C", Speed = "13.1 km/s", Atmo = "H2, He", Wind = "Great Red Spot" },
                    Moons = new List<Moon> {
                        new Moon { Name = "Io", Size = 0.8, Distance = 23, Color = "#DDCC55", Speed = 0.2, Details = new PlanetDetails { Temp = "-143°C", Speed = "17 km/s", Atmo = "Sulfur", Wind = "Volcanic" } },
                        new Moon { Name = "Europa", Size = 0.7, Distance = 26, Color = "#AACCFF", Speed = 0.15, Details = new PlanetDetails { Temp = "-160°C", Speed = "13 km/s", Atmo = "Oxygen (Trace)", Wind = "Ice Shell" } },
                        new Moon { Name = "Ganymede", Size = 1.2, Distance = 30, Color = "#998877", Speed = 0.1, Details = new PlanetDetails { Temp = "-163°C", Speed = "10 km/s", Atmo = "Oxygen (Trace)", Wind = "Magnetic Field" } },
                        new Moon { Name = "Callisto", Size = 1.1, Distance = 35, Color = "#665544", Speed = 0.08, Details = new PlanetDetails { Temp = "-171°C", Speed = "8 km/s", Atmo = "CO2 (Trace)", Wind = "Ancient Surface" } }
                    }
                },
                new Planet {
                    Name = "Saturn", Size = 8.5, Distance = 190, Color = "#C5AB6E", Type = "gas", Tilt = 26.7, HasRings = true,
                    OrbitalPeriod = 29.45, RotationPeriod = 0.45,
                    Details = new PlanetDetails { Temp = "-140°C", Speed = "9.7 km/s", Atmo = "H2, He", Wind = "Hexagon Storm" },
                    Moons = new List<Moon> {
                        new Moon { Name = "Titan", Size = 1.1, Distance = 18, Color = "#DDAA44", Speed = 0.1, Details = new PlanetDetails { Temp = "-179°C", Speed = "5.57 km/s", Atmo = "Nitrogen (Thick)", Wind = "Methane Lakes" } },
                        new Moon { Name = "Enceladus", Size = 0.4, Distance = 12, Color = "#EEEEFF", Speed = 0.3, Details = new PlanetDetails { Temp = "-201°C", Speed = "12.6 km/s", Atmo = "Water Vapor", Wind = "Ice Geysers" } }
                    }
                },
                new Planet {
                    Name = "Uranus", Size = 5, Distance = 240, Color = "#4FD0E7", Type = "gas", Tilt = 97.8, HasRings = true,
                    OrbitalPeriod = 84.0, RotationPeriod = -0.72,
                    Details = new PlanetDetails { Temp = "-195°C", Speed = "6.8 km/s", Atmo = "H2, He, CH4", Wind = "Sideways World" },
                    Moons = new List<Moon> {
                        new Moon { Name = "Titania", Size = 0.5, Distance = 8, Color = "#CCCCCC", Speed = 0.1, Details = new PlanetDetails { Temp = "-203°C", Speed = "3.6 km/s", Atmo = "None", Wind = "Canyons" } },
                        new Moon { Name = "Oberon", Size = 0.5, Distance = 10, Color = "#BBBBBB", Speed = 0.08, Details = new PlanetDetails { Temp = "-203°C", Speed = "3.1 km/s", Atmo = "None", Wind = "Craters" } }
                    }
                },
                new Planet {
                    Name = "Neptune", Size = 4.8, Distance = 280, Color = "#2933CF", Type = "gas", Tilt = 28.3,
                    OrbitalPeriod = 164.8, RotationPeriod = 0.67,
                    Details = new PlanetDetails { Temp = "-200°C", Speed = "5.4 km/s", Atmo = "H2, He, CH4", Wind = "Supersonic Winds" },
                    Moons = new List<Moon> {
                        new Moon { Name = "Triton", Size = 0.8, Distance = 8, Color = "#FFDDDD", Speed = -0.1, Details = new PlanetDetails { Temp = "-235°C", Speed = "4.3 km/s", Atmo = "Nitrogen", Wind = "Retrograde Orbit" } }
                    }
                }
            };
        }
    }
}
