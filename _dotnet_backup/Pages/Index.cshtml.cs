using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using CosmicFusion.Services;
using CosmicFusion.Models;

namespace CosmicFusion.Pages;

public class IndexModel : PageModel
{
    private readonly ILogger<IndexModel> _logger;
    private readonly PlanetService _planetService;

    public List<Planet> Planets { get; private set; }

    public IndexModel(ILogger<IndexModel> logger, PlanetService planetService)
    {
        _logger = logger;
        _planetService = planetService;
    }

    public void OnGet()
    {
        Planets = _planetService.GetPlanets();
    }
}
