import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeText,
    normalizeUrl,
    parseSalaryRange,
    matchesSalaryFilter,
    computeDedupHash,
    deduplicateJobs,
    applySearchFilters
} from '../search_engine.js';

describe('normalizeText', () => {
    it('lowercase et supprime accents/ponctuation', () => {
        assert.equal(normalizeText('Développeur Fullstack'), 'developpeurfullstack');
        assert.equal(normalizeText('Paris, Île-de-France'), 'parisiledefrance');
        assert.equal(normalizeText(''), '');
        assert.equal(normalizeText(null), '');
        assert.equal(normalizeText(undefined), '');
    });
});

describe('normalizeUrl', () => {
    it('supprime les paramètres de tracking et le hash', () => {
        const url = 'https://example.com/job/123?utm_source=test&fbclid=abc#section';
        const result = normalizeUrl(url);
        assert.equal(result, 'https://example.com/job/123');
    });

    it('supprime le trailing slash', () => {
        assert.equal(normalizeUrl('https://example.com/job/'), 'https://example.com/job');
    });

    it('retourne la chaîne brute si URL invalide', () => {
        assert.equal(normalizeUrl('not-a-url'), 'not-a-url');
    });

    it('gère les valeurs vides', () => {
        assert.equal(normalizeUrl(''), '');
        assert.equal(normalizeUrl(null), '');
    });
});

describe('computeDedupHash', () => {
    it('génère le même hash pour des offres identiques', () => {
        const job1 = { title: 'Dev Fullstack', company: 'TechCorp', location: 'Paris' };
        const job2 = { title: 'dev fullstack', company: 'techcorp', location: 'paris' };
        assert.equal(computeDedupHash(job1), computeDedupHash(job2));
    });

    it('génère des hash différents pour des offres distinctes', () => {
        const job1 = { title: 'Dev Fullstack', company: 'TechCorp', location: 'Paris' };
        const job2 = { title: 'Data Scientist', company: 'DataInc', location: 'Berlin' };
        assert.notEqual(computeDedupHash(job1), computeDedupHash(job2));
    });
});

describe('parseSalaryRange', () => {
    it('extrait une fourchette numérique depuis un texte salarial', () => {
        assert.deepEqual(parseSalaryRange('45k - 55k'), { min: 45000, max: 55000 });
        assert.deepEqual(parseSalaryRange('60 000 - 80 000 €'), { min: 60000, max: 80000 });
    });
});

describe('matchesSalaryFilter', () => {
  it('conserve les offres dont le salaire n’est pas communiqué', () => {
    assert.equal(matchesSalaryFilter('N/A', { minSalary: '2000', maxSalary: '3000' }), true);
  });
    it('valide une offre quand le salaire correspond au minimum demandé', () => {
        assert.equal(matchesSalaryFilter('45k - 55k', { salary: '50000' }), true);
        assert.equal(matchesSalaryFilter('45k - 55k', { salary: '60000' }), false);
    });
});

describe('deduplicateJobs', () => {
    it('supprime les doublons par hash et fusionne les sources', () => {
        const jobs = [
            { title: 'Dev Fullstack', company: 'TechCorp', location: 'Paris', link: 'https://a.com/1', provider: 'linkedin', provider_name: 'LinkedIn' },
            { title: 'Dev Fullstack', company: 'TechCorp', location: 'Paris', link: 'https://b.com/1', provider: 'indeed', provider_name: 'Indeed' }
        ];
        const result = deduplicateJobs(jobs);
        assert.equal(result.length, 1);
        assert.deepEqual(result[0].providers_list.sort(), ['Indeed', 'LinkedIn']);
    });

    it('supprime les doublons par URL exacte', () => {
        const jobs = [
            { title: 'Job A', company: 'Corp A', link: 'https://same.com/job', provider: 'linkedin', provider_name: 'LinkedIn' },
            { title: 'Job B', company: 'Corp B', link: 'https://same.com/job', provider: 'indeed', provider_name: 'Indeed' }
        ];
        const result = deduplicateJobs(jobs);
        assert.equal(result.length, 1);
    });

    it('conserve les offres uniques', () => {
        const jobs = [
            { title: 'Job A', company: 'Corp A', link: 'https://a.com/1', provider: 'linkedin', provider_name: 'LinkedIn' },
            { title: 'Job B', company: 'Corp B', link: 'https://b.com/2', provider: 'indeed', provider_name: 'Indeed' }
        ];
        const result = deduplicateJobs(jobs);
        assert.equal(result.length, 2);
    });
});

describe('applySearchFilters', () => {
    const sampleJobs = [
        { title: 'Junior Developer', company: 'Startup', location: 'Paris', city: 'Paris', contract_type: 'CDI', experience_level: 'junior', remote: 'on_site', job_type: 'full_time', salary: '35k - 40k' },
        { title: 'Senior Engineer Remote', company: 'BigCorp', location: 'Remote', city: '', contract_type: 'CDI', experience_level: 'senior', remote: 'full_remote', job_type: 'full_time', salary: '70k - 90k' },
        { title: 'Stage Data', company: 'DataInc', location: 'Berlin', city: 'Berlin', contract_type: 'Stage', experience_level: 'junior', remote: 'hybrid', job_type: 'internship', salary: '1200' },
        { title: 'Dev CDD', company: 'TempCo', location: 'Lyon', city: 'Lyon', contract_type: 'CDD', experience_level: 'mid', remote: 'on_site', job_type: 'full_time', salary: '45k' },
        { title: 'Freelance Consultant', company: 'FreeCo', location: 'Paris', city: 'Paris', contract_type: 'Freelance', experience_level: 'senior', remote: 'full_remote', job_type: 'part_time', salary: '50000' }
    ];

    it('ne filtre rien si tous les critères sont vides', () => {
        const result = applySearchFilters(sampleJobs, {});
        assert.equal(result.length, 5);
    });

    it('filtre par ville', () => {
        const result = applySearchFilters(sampleJobs, { city: 'Paris' });
        assert.equal(result.length, 2);
        assert.ok(result.every(j => j.city.toLowerCase().includes('paris')));
    });

    it('filtre par type de contrat CDI', () => {
        const result = applySearchFilters(sampleJobs, { contractType: 'CDI' });
        assert.equal(result.length, 2);
    });

    it('filtre par type de contrat Stage', () => {
        const result = applySearchFilters(sampleJobs, { contractType: 'Stage' });
        assert.equal(result.length, 1);
        assert.equal(result[0].title, 'Stage Data');
    });

    it('filtre par télétravail full_remote', () => {
        const result = applySearchFilters(sampleJobs, { remote: 'full_remote' });
        assert.equal(result.length, 2);
    });

    it('filtre par télétravail on_site', () => {
        const result = applySearchFilters(sampleJobs, { remote: 'on_site' });
        assert.equal(result.length, 2);
    });

    it('filtre par niveau d\'expérience junior', () => {
        const result = applySearchFilters(sampleJobs, { experienceLevel: 'junior' });
        assert.ok(result.length >= 1);
    });

    it('filtre par niveau d\'expérience senior', () => {
        const result = applySearchFilters(sampleJobs, { experienceLevel: 'senior' });
        assert.ok(result.length >= 1);
    });

    it('combine plusieurs filtres', () => {
        const result = applySearchFilters(sampleJobs, { city: 'Paris', contractType: 'CDI' });
        assert.equal(result.length, 1);
        assert.equal(result[0].company, 'Startup');
    });

    it('retourne vide si aucun résultat ne correspond', () => {
        const result = applySearchFilters(sampleJobs, { city: 'Tokyo' });
        assert.equal(result.length, 0);
    });

    it('filtre par salaire minimum', () => {
        const result = applySearchFilters(sampleJobs, { salary: '50000' });
        assert.ok(result.every((job) => matchesSalaryFilter(job.salary, { salary: '50000' })));
        assert.equal(result.some((job) => job.title === 'Stage Data'), false);
    });
});
