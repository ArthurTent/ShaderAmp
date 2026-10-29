import { buildVcamScripts, vcamSiteOf, vcamSitePattern } from './vcamSites';

describe('vcamSiteOf', () => {
    it('reduces a URL to scheme://hostname', () => {
        expect(vcamSiteOf('https://teams.microsoft.com/v2/?x=1#y')).toBe('https://teams.microsoft.com');
        expect(vcamSiteOf('http://localhost:5173/demo')).toBe('http://localhost');
    });

    it('rejects non-web and invalid URLs', () => {
        expect(vcamSiteOf('chrome://extensions')).toBeNull();
        expect(vcamSiteOf('file:///tmp/a.html')).toBeNull();
        expect(vcamSiteOf('not a url')).toBeNull();
        expect(vcamSiteOf(undefined)).toBeNull();
    });
});

describe('buildVcamScripts', () => {
    it('registers nothing without sites', () => {
        expect(buildVcamScripts([])).toEqual([]);
    });

    it('registers isolated + MAIN scripts at document_start for the given patterns', () => {
        const patterns = [vcamSitePattern('https://meet.example.org')];
        const scripts = buildVcamScripts(patterns);
        expect(scripts.map(s => [s.world, s.js])).toEqual([
            ['ISOLATED', ['js/vcamContent.js']],
            ['MAIN', ['js/vcamPage.js']],
        ]);
        for (const s of scripts) {
            expect(s.matches).toEqual(['https://meet.example.org/*']);
            expect(s.runAt).toBe('document_start');
            expect(s.allFrames).toBe(true);
        }
    });
});
