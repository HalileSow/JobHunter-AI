/**
 * Migration : Ajout des filtres de recherche avancés
 * - Enrichit la table `jobs` avec city, experience_level, remote, job_type
 * - Enrichit la table `scheduled_searches` avec les mêmes filtres
 * - Crée la table `search_configs` pour les configurations de recherche sauvegardées
 */
exports.up = function (knex) {
    return knex.schema
        .table('jobs', (table) => {
            table.string('city').defaultTo('');
            table.string('experience_level').defaultTo('');
            table.string('remote').defaultTo('');
            table.string('job_type').defaultTo('');
            table.string('search_city').defaultTo('');
            table.string('search_experience_level').defaultTo('');
            table.string('search_remote').defaultTo('');
            table.string('search_contract_type').defaultTo('');
        })
        .table('scheduled_searches', (table) => {
            table.string('city').defaultTo('');
            table.string('experience_level').defaultTo('');
            table.string('remote').defaultTo('');
            table.string('contract_type').defaultTo('');
            table.string('job_type').defaultTo('');
        })
        .createTable('search_configs', (table) => {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.string('country').notNullable();
            table.string('city').defaultTo('');
            table.string('title').notNullable();
            table.string('keywords').defaultTo('');
            table.string('experience_level').defaultTo('');
            table.string('contract_type').defaultTo('');
            table.string('remote').defaultTo('');
            table.string('job_type').defaultTo('');
            table.string('lang').defaultTo('fr');
            table.text('providers_list');
            table.boolean('enabled').defaultTo(true);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('search_configs')
        .table('scheduled_searches', (table) => {
            table.dropColumn('city');
            table.dropColumn('experience_level');
            table.dropColumn('remote');
            table.dropColumn('contract_type');
            table.dropColumn('job_type');
        })
        .table('jobs', (table) => {
            table.dropColumn('city');
            table.dropColumn('experience_level');
            table.dropColumn('remote');
            table.dropColumn('job_type');
            table.dropColumn('search_city');
            table.dropColumn('search_experience_level');
            table.dropColumn('search_remote');
            table.dropColumn('search_contract_type');
        });
};
