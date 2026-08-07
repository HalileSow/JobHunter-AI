exports.up = async function(knex) {
  const hasLang = await knex.schema.hasColumn('cvs', 'lang');
  if (!hasLang) {
    await knex.schema.table('cvs', (table) => {
      table.string('lang', 5).defaultTo('fr');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.table('cvs', (table) => {
    table.dropColumn('lang');
  });
};
