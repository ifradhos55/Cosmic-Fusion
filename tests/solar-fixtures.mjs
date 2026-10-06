import { readFile } from 'node:fs/promises';
export const observationTime = Date.parse('2026-10-06T12:00:00Z');
export const ephemerisFixture = JSON.parse(await readFile(new URL('../public/data/ephemeris-snapshot.json', import.meta.url)));
export const feedFixture = (feed, data, body = '') => ({ feed, body, data, source: 'https://science.nasa.gov/', fetchedAt: '2026-10-06T11:00:00Z', nextRefreshAt: '2026-10-06T13:00:00Z', stale: false });
export async function mockSolarPositions(page) {
  // The frozen test time falls inside the checked-in, genuine JPL table. CI
  // never shifts orbital samples or consumes public API quota.
  await page.addInitScript(at => { Date.now = () => at; }, observationTime);
  await page.route('**/api/solar?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(ephemerisFixture) }));
}
