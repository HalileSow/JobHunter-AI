/**
 * Journal détaillé des tentatives de candidature automatisée.
 */
exports.up = function (knex) {
    return knex.schema.createTable('application_attempts', (table) => {
        table.increments('id').primary();
        table.integer('job_id').notNullable().references('id').inTable('jobs').onDelete('CASCADE');
        table.string('provider').notNullable();
        table.string('mode').notNullable(); // auto, prepared, manual
        table.string('status').notNullable(); // réussie, échouée, en attente
        table.string('confirmation_id');
        table.string('application_url');
        table.string('tailored_cv_path');
        table.string('letter_path');
        table.text('details');
        table.text('error');
        table.text('payload_json');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('application_attempts');
};
