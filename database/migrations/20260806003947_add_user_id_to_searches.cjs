exports.up = async function(knex) {
  const tables = ['search_configs', 'scheduled_searches'];
  for (const tableName of tables) {
    await knex.schema.table(tableName, (table) => {
      table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  const tables = ['search_configs', 'scheduled_searches'];
  for (const tableName of tables) {
    await knex.schema.table(tableName, (table) => {
      table.dropColumn('user_id');
    });
  }
};
