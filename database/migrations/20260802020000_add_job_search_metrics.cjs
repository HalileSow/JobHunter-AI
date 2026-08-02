/**
 * Ajoute les champs de suivi de recherche utilisés par le moteur IA.
 */
exports.up = function (knex) {
    return knex.schema.table('jobs', (table) => {
        table.string('search_salary').defaultTo('');
        table.string('search_min_salary').defaultTo('');
        table.string('search_max_salary').defaultTo('');
    });
};

exports.down = function (knex) {
    return knex.schema.table('jobs', (table) => {
        table.dropColumn('search_salary');
        table.dropColumn('search_min_salary');
        table.dropColumn('search_max_salary');
    });
};
