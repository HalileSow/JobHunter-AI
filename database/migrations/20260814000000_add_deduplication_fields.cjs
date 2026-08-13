/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasJobs = await knex.schema.hasTable('jobs');
  if (!hasJobs) return;

  const columnsToAdd = [];
  if (!(await knex.schema.hasColumn('jobs', 'provider'))) columnsToAdd.push('provider');
  if (!(await knex.schema.hasColumn('jobs', 'external_job_id'))) columnsToAdd.push('external_job_id');
  if (!(await knex.schema.hasColumn('jobs', 'submitted_at'))) columnsToAdd.push('submitted_at');

  for (const col of columnsToAdd) {
    await knex.schema.table('jobs', (table) => {
      if (col === 'provider') table.string('provider');
      if (col === 'external_job_id') table.string('external_job_id');
      if (col === 'submitted_at') table.timestamp('submitted_at');
    });
  }

  // Index creation
  try {
    await knex.schema.table('jobs', (table) => {
      table.index(['provider', 'external_job_id']);
    });
  } catch (e) {
    // Ignore error if index exists
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.table('jobs', (table) => {
    table.dropIndex(['provider', 'external_job_id']);
    table.dropColumn('submitted_at');
    table.dropColumn('external_job_id');
    table.dropColumn('provider');
  });
};
