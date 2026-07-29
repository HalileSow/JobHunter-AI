/**
 * Migration : Table des recherches planifiées (Cron intégré)
 */
exports.up = function (knex) {
    return knex.schema.createTable('scheduled_searches', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('country').notNullable();
        table.string('title').notNullable();
        table.string('keywords').defaultTo('');
        table.string('lang').defaultTo('fr');
        table.string('cron_expression').notNullable().defaultTo('0 */6 * * *');
        table.boolean('enabled').defaultTo(true);
        table.timestamp('last_run_at').nullable();
        table.timestamp('next_run_at').nullable();
        table.integer('total_runs').defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('scheduled_searches');
};
