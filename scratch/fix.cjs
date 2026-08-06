const fs = require('fs');

let content = fs.readFileSync('site/server.mjs', 'utf8');

const replacements = [
    // Schedules
    ["db('scheduled_searches').select('*').orderBy('created_at', 'desc')", "db('scheduled_searches').select('*').where({ user_id: req.user.id }).orderBy('created_at', 'desc')"],
    ["db('scheduled_searches').insert({", "db('scheduled_searches').insert({\n                user_id: req.user.id,"],
    ["db('scheduled_searches').where({ id: req.params.id })", "db('scheduled_searches').where({ id: req.params.id, user_id: req.user.id })"],
    
    // Search Configs
    ["db('search_configs').select('*').orderBy('created_at', 'desc')", "db('search_configs').select('*').where({ user_id: req.user.id }).orderBy('created_at', 'desc')"],
    ["db('search_configs').insert(config)", "db('search_configs').insert({ ...config, user_id: req.user.id })"],
    ["db('search_configs').where({ id: req.params.id })", "db('search_configs').where({ id: req.params.id, user_id: req.user.id })"],
    
    // Jobs
    ["db('jobs').where({ id: req.params.id })", "db('jobs').where({ id: req.params.id, user_id: req.user.id })"],
    
    // CVs
    ["db('cvs').select('id', 'name', 'path', 'is_active', 'created_at')", "db('cvs').select('id', 'name', 'path', 'is_active', 'created_at').where({ user_id: req.user.id })"],
    ["db('cvs').where({ id: req.params.id }).select('id').first()", "db('cvs').where({ id: req.params.id, user_id: req.user.id }).select('id').first()"],
    ["trx('cvs').update({ is_active: 0 });", "trx('cvs').where({ user_id: req.user.id }).update({ is_active: 0 });"],
    ["trx('cvs').where({ id: req.params.id }).update({ is_active: 1 });", "trx('cvs').where({ id: req.params.id, user_id: req.user.id }).update({ is_active: 1 });"],
    
    // Profile
    ["db('profile').where({ id: 1 }).first()", "db('profile').where({ user_id: req.user.id }).first()"],
    ["db('profile')\n                .insert({\n                    id: 1,", "db('profile')\n                .insert({\n                    user_id: req.user.id,"],
    [".onConflict('id')", ".onConflict('user_id')"], // Note: requires user_id to be UNIQUE constraint
    
    // Search runs
    ["db('search_runs').select('*').orderBy('created_at', 'desc')", "db('search_runs').select('*').where({ user_id: req.user.id }).orderBy('created_at', 'desc')"],
    ["db('search_runs').insert({ country, title, keywords, lang, status: 'queued' })", "db('search_runs').insert({ country, title, keywords, lang, status: 'queued', user_id: req.user.id })"],
    ["db('search_runs').insert({\n                    country: config.country,", "db('search_runs').insert({\n                    user_id: req.user.id,\n                    country: config.country,"],
    
    // Admin routes
    ["app.post('/api/admin/backup', async (req, res) => {", "app.post('/api/admin/backup', authorize(['SUPER_ADMIN']), async (req, res) => {"],
];

for (const [search, replace] of replacements) {
    content = content.replaceAll(search, replace);
}

// Add API admin users route
const adminUsersRoute = `
    app.get('/api/admin/users', authorize(['SUPER_ADMIN']), async (req, res) => {
        try {
            const users = await withDb((db) => db('users').select('id', 'email', 'role', 'status', 'created_at'));
            res.json(users);
        } catch {
            res.status(500).json({ error: 'Impossible de charger les utilisateurs.' });
        }
    });

    // Endpoints Providers
`;
content = content.replace('    // Endpoints Providers', adminUsersRoute);

fs.writeFileSync('site/server.mjs', content);
