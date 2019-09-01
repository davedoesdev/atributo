const path = require('path');
const config = require('config');
const db_type = process.env.ATRIBUTO_TEST_DB_TYPE;
const ao_options = Object.assign(
{
    db_filename: path.join(__dirname, 'atributo.sqlite3')
}, config);
if (db_type)
{
    ao_options.db_type = db_type;
}
exports.db_type = db_type;
exports.db_type_name = db_type || 'sqlite';
exports.ao_options = ao_options;
