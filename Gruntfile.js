'use strict';

const test_cmd = 'npx mocha --bail';
const c8 = `npx c8 -x Gruntfile.js -x 'test/**'`;

module.exports = function (grunt)
{
    grunt.initConfig(
    {
        eslint: {
            target: [
                'Gruntfile.js',
                'index.js',
                'doc-extra.js',
                'test/**/*.js' ,
                '!test/node_modules/atributo.js'
            ]
        },

        copy: {
            sqlite_db: {
                src: 'atributo.empty.sqlite3',
                dest: 'test/atributo.sqlite3'
            }
        },

        env: {
            pg: {
                // Note: On Ubuntu, this requires adding a mapping to
                // /etc/postgresql/11/main/pg_ident.conf, for example:
                //
                // foo foo postgres
                //
                // and specifying the map in etc/postgresql/11/main/pg_hba.conf:
                //
                // local all postgres peer map=foo
                ATRIBUTO_TEST_DB_TYPE: 'pg'
            }
        },

        exec: Object.fromEntries(Object.entries({
            test: {
                cmd: `${test_cmd} test/test.js`
            },

            test_multi_sp: {
                cmd: `${test_cmd} test/multi_sp.js`
            },

            test_multi_mp: {
                cmd: `${test_cmd} test/multi_mp.js`
            },

            test_example: {
                cmd: `${test_cmd} test/run_example.js`
            },

            test_example2: {
                cmd: `${test_cmd} test/run_example2.js`
            },

            cover: {
                cmd: `${c8} npx grunt test-all-db"`
            },

            cover_report: {
                cmd: `${c8} report -r lcov`
            },

            cover_check: {
                cmd: `${c8} check-coverage --statements 100 --branches 100 --functions 100 --lines 100`
            },

            documentation: {
                cmd: [
                    'npx documentation build -c documentation.yml -f html -o docs index.js doc-extra.js',
                    'asciidoc -b docbook -o - README.adoc | pandoc -f docbook -t gfm -o README.md'
                ].join('&&')
            },

            clear_pg: {
                cmd: "psql -U postgres -d atributo -c \"DELETE FROM allocations;\" -c \"DELETE from instances;\""
            }
        }).map(([k, v]) => [k, { stdio: 'inherit', ...v }]))
    });

    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-env');

    grunt.registerTask('reset', 'Reset DB', function ()
    {
        let task;

        switch (process.env.ATRIBUTO_TEST_DB_TYPE)
        {
        case 'pg':
            task = 'exec:clear_pg';
            break;

        default:
            task = 'copy:sqlite_db'
            break;
        }

        grunt.task.run(task);
    });

    grunt.registerTask('lint', 'eslint');
    grunt.registerTask('test', ['reset',
                                'exec:test']);
    grunt.registerTask('test-multi', ['reset',
                                      'exec:test_multi_sp',
                                      'reset',
                                      'exec:test_multi_mp']);
    grunt.registerTask('test-example', ['reset',
                                        'exec:test_example',
                                        'reset',
                                        'exec:test_example2']);
    grunt.registerTask('test-all', ['test', 'test-multi', 'test-example']);
    grunt.registerTask('test-all-db', ['test-all',
                                       'env:pg',
                                       'test-all']);
    grunt.registerTask('test-all-pg', ['env:pg', 'test-all']);
    grunt.registerTask('coverage', ['exec:cover',
                                    'exec:cover_report',
                                    'exec:cover_check']);
    grunt.registerTask('coveralls', 'exec:coveralls');
    grunt.registerTask('docs', 'exec:documentation');
    grunt.registerTask('default', ['lint', 'test']);
};
