/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.hasTable('jobs').then(exists => {
    if (!exists) return;
    return knex.schema.table('jobs', async (table) => {
      const hasProvider = await knex.schema.hasColumn('jobs', 'provider');
      if (!hasProvider) {
        table.string('provider');
      }
      const hasExternalId = await knex.schema.hasColumn('jobs', 'external_job_id');
      if (!hasExternalId) {
        table.string('external_job_id');
      }
      const hasSubmittedAt = await knex.schema.hasColumn('jobs', 'submitted_at');
      if (!hasSubmittedAt) {
        table.timestamp('submitted_at');
      }
      // Index creation might fail if it already exists, so we might need a try-catch or check existence
      try {
        await knex.schema.table('jobs', (table) => {
          table.index(['provider', 'external_job_id']);
        });
      } catch (e) {
        // Index likely exists
      }
    });
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('jobs', (table) => {
    table.dropIndex(['provider', 'external_job_id']);
    table.dropColumn('submitted_at');
    table.dropColumn('external_job_id');
    table.dropColumn('provider');
  });
};
