using System.Collections.Generic;

namespace CosmicFusion.Models
{
    public class PlanetDetails
    {
        public string Temp { get; set; }
        public string Speed { get; set; }
        public string Atmo { get; set; }
        public string Wind { get; set; }
    }

    public class Moon
    {
        public string Name { get; set; }
        public double Size { get; set; }
        public double Distance { get; set; }
        public string Color { get; set; }
        public double Speed { get; set; }
        public PlanetDetails Details { get; set; }
    }

    public class Planet
    {
        public string Name { get; set; }
        public double Size { get; set; }
        public double Distance { get; set; }
        public string Color { get; set; }
        public string Type { get; set; }
        public double Tilt { get; set; }
        public bool HasRings { get; set; }
        public double OrbitalPeriod { get; set; }
        public double RotationPeriod { get; set; }
        public PlanetDetails Details { get; set; }
        public List<Moon> Moons { get; set; } = new List<Moon>();
    }
}
