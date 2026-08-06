exports.up = async function(knex) {
  await knex.schema.alterTable('profile', (table) => {
    table.unique('user_id');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('profile', (table) => {
    table.dropUnique('user_id');
  });
};
