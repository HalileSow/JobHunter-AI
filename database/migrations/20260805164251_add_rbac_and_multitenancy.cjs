
exports.up = async function(knex) {
  // 1. Update Users table with role and status
  await knex.schema.table('users', (table) => {
    table.string('role').defaultTo('USER').notNullable();
    table.string('status').defaultTo('ACTIVE').notNullable();
  });

  // 2. Add user_id to user-specific tables
  const tables = ['jobs', 'cvs', 'profile', 'search_runs'];
  for (const tableName of tables) {
    await knex.schema.table(tableName, (table) => {
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  // Rollback user_id
  const tables = ['jobs', 'cvs', 'profile', 'search_runs'];
  for (const tableName of tables) {
    await knex.schema.table(tableName, (table) => {
      table.dropColumn('user_id');
    });
  }

  // Rollback user changes
  await knex.schema.table('users', (table) => {
    table.dropColumn('role');
    table.dropColumn('status');
  });
};
