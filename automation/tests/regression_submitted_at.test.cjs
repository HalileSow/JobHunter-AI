const knex = require('knex');
const knexfile = require('../../knexfile.cjs');
const assert = require('assert');

async function runTest() {
  const db = knex(knexfile.test);
  console.log('Running migration check...');
  
  try {
    // 1. Run all migrations to ensure the repair runs
    await db.migrate.latest();
    console.log('Migrations applied.');

    // 2. Insert a dummy job
    const [jobId] = await db('jobs').insert({
      title: 'Test Job',
      company: 'Test Co'
    });
    console.log(`Inserted job with id: ${jobId}`);

    // 3. Update the job with submitted_at (the operation that was failing)
    await db('jobs')
      .where({ id: jobId })
      .update({
        status: 'Soumis',
        submitted_at: new Date()
      });
    
    console.log('Successfully updated submitted_at.');

    // 4. Verify
    const job = await db('jobs').where({ id: jobId }).first();
    assert.strictEqual(job.status, 'Soumis');
    assert.ok(job.submitted_at, 'submitted_at should exist');
    
    console.log('Regression test passed!');
  } catch (err) {
    console.error('Regression test failed:', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

runTest();
