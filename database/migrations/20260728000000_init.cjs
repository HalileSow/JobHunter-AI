/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    .createTable('jobs', (table) => {
      table.increments('id');
      table.string('title');
      table.string('company');
      table.string('link');
      table.string('country');
      table.integer('score');
      table.text('letter');
      table.text('analysis');
      table.string('status').defaultTo('Enregistré');
      table.string('salary');
      table.string('contract_type');
      table.string('date_posted');
      table.integer('selected_cv_id');
      table.string('pdf_path');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('cvs', (table) => {
      table.increments('id');
      table.string('name');
      table.string('path');
      table.integer('is_active').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('profile', (table) => {
      table.integer('id').primary();
      table.string('first_name');
      table.string('last_name');
      table.string('dob');
      table.string('nationality');
      table.string('address');
      table.string('phone');
      table.string('email');
      table.string('photo_path');
      table.text('languages');
      table.text('skills');
      table.text('experience');
      table.text('education');
      table.string('availability');
    })
    .createTable('search_runs', (table) => {
      table.increments('id');
      table.string('country').notNullable();
      table.string('title').notNullable();
      table.string('keywords').defaultTo('');
      table.string('lang').notNullable().defaultTo('fr');
      table.string('status').notNullable().defaultTo('queued');
      table.text('error');
      table.timestamp('started_at');
      table.timestamp('finished_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('search_runs')
    .dropTableIfExists('profile')
    .dropTableIfExists('cvs')
    .dropTableIfExists('jobs');
};
