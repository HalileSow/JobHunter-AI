exports.up = async function(knex) {
  // Find SUPER_ADMIN user
  const admin = await knex('users').where({ role: 'SUPER_ADMIN' }).first();
  if (!admin) return; // No admin to assign to
  
  const adminId = admin.id;
  const tables = ['jobs', 'cvs', 'profile', 'search_runs', 'search_configs', 'scheduled_searches'];
  
  for (const tableName of tables) {
      await knex(tableName).whereNull('user_id').update({ user_id: adminId });
  }
};

exports.down = async function(knex) {
  // Cannot easily reverse without keeping track of which were originally null
};
