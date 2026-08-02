/**
 * Ajoute les compteurs nécessaires au suivi des recherches planifiées.
 */
exports.up = function (knex) {
    return knex.schema
        .table('search_runs', (table) => {
            table.integer('raw_jobs_count').defaultTo(0);
            table.integer('unique_jobs_count').defaultTo(0);
            table.integer('analyzed_jobs_count').defaultTo(0);
            table.integer('saved_jobs_count').defaultTo(0);
            table.integer('duplicate_jobs_count').defaultTo(0);
        })
        .table('scheduled_searches', (table) => {
            table.string('last_status').defaultTo('queued');
            table.integer('last_raw_jobs_count').defaultTo(0);
            table.integer('last_unique_jobs_count').defaultTo(0);
            table.integer('last_analyzed_jobs_count').defaultTo(0);
            table.integer('last_new_jobs_count').defaultTo(0);
            table.integer('last_duplicate_jobs_count').defaultTo(0);
            table.text('last_error');
        });
};

exports.down = function (knex) {
    return knex.schema
        .table('scheduled_searches', (table) => {
            table.dropColumn('last_status');
            table.dropColumn('last_raw_jobs_count');
            table.dropColumn('last_unique_jobs_count');
            table.dropColumn('last_analyzed_jobs_count');
            table.dropColumn('last_new_jobs_count');
            table.dropColumn('last_duplicate_jobs_count');
            table.dropColumn('last_error');
        })
        .table('search_runs', (table) => {
            table.dropColumn('raw_jobs_count');
            table.dropColumn('unique_jobs_count');
            table.dropColumn('analyzed_jobs_count');
            table.dropColumn('saved_jobs_count');
            table.dropColumn('duplicate_jobs_count');
        });
};
