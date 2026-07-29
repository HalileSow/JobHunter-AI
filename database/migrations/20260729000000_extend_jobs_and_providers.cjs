/**
 * Migration to add provider, dedup_hash, auto_apply_supported, prefilled_data to jobs,
 * and create a providers configuration table.
 */
exports.up = function(knex) {
  return knex.schema
    .table('jobs', (table) => {
      table.string('provider').defaultTo('generic');
      table.string('dedup_hash').index();
      table.integer('auto_apply_supported').defaultTo(0);
      table.text('prefilled_data');
    })
    .createTable('providers_config', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('type').notNullable(); // job_board, official_api, company_ats, custom_scraper
      table.integer('enabled').defaultTo(1);
      table.text('config_json');
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('providers_config')
    .table('jobs', (table) => {
      table.dropColumn('provider');
      table.dropColumn('dedup_hash');
      table.dropColumn('auto_apply_supported');
      table.dropColumn('prefilled_data');
    });
};
