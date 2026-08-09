/**
 * Add backup_settings table for configurable automatic backups.
 */

exports.up = async function (knex) {
    const hasTable = await knex.schema.hasTable('backup_settings');
    if (!hasTable) {
        await knex.schema.createTable('backup_settings', (table) => {
            table.increments('id');
            table.integer('interval_hours').notNullable().defaultTo(12);
            table.integer('retention_max').notNullable().defaultTo(14);
            table.boolean('enabled').notNullable().defaultTo(1);
            table.datetime('last_run_at').nullable();
            table.string('last_backup_path').nullable();
            table.string('last_error').nullable();
            table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
            table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
        });

        // Default row
        await knex('backup_settings').insert({
            interval_hours: 12,
            retention_max: 14,
            enabled: 1
        });
    }
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('backup_settings');
};
