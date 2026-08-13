/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Repair 'submitted_at'
  const hasSubmittedAt = await knex.schema.hasColumn('jobs', 'submitted_at');
  if (!hasSubmittedAt) {
    await knex.schema.table('jobs', table => {
        table.timestamp('submitted_at');
    });
    console.log('Repaired: Added missing submitted_at column to jobs table.');
  }

  // Repair 'external_job_id'
  const hasExternalJobId = await knex.schema.hasColumn('jobs', 'external_job_id');
  if (!hasExternalJobId) {
    await knex.schema.table('jobs', table => {
        table.string('external_job_id');
    });
    console.log('Repaired: Added missing external_job_id column to jobs table.');
  }
  
  // Repair 'provider'
  const hasProvider = await knex.schema.hasColumn('jobs', 'provider');
  if (!hasProvider) {
    await knex.schema.table('jobs', table => {
        table.string('provider');
    });
    console.log('Repaired: Added missing provider column to jobs table.');
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // No-op to be safe.
};
