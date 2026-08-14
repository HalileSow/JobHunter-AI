/**
 * Ensure deleting a job also deletes its submission log rows at database level.
 * The API still deletes dependencies explicitly for compatibility with older
 * schemas and clearer error handling.
 */
exports.up = async function (knex) {
  const client = knex.client.config.client;
  if (!['pg', 'postgres', 'postgresql'].includes(client)) return;

  await knex.schema.raw('ALTER TABLE job_logs DROP CONSTRAINT IF EXISTS job_logs_job_id_foreign');
  await knex.schema.raw(
    'ALTER TABLE job_logs ADD CONSTRAINT job_logs_job_id_foreign FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE'
  );
};

exports.down = async function (knex) {
  const client = knex.client.config.client;
  if (!['pg', 'postgres', 'postgresql'].includes(client)) return;

  await knex.schema.raw('ALTER TABLE job_logs DROP CONSTRAINT IF EXISTS job_logs_job_id_foreign');
  await knex.schema.raw(
    'ALTER TABLE job_logs ADD CONSTRAINT job_logs_job_id_foreign FOREIGN KEY (job_id) REFERENCES jobs(id)'
  );
};
